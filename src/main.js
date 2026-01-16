import { CONFIG } from './config.js';
import { createState, nextPickName, allPicksDone, resetPicks } from './state.js';
import { computeThetaFromPicks } from './math.js';
import { createUICanvas } from './ui/uiCanvas.js';
import { createThreeRenderer } from './render/threeRenderer.js';
import { getSlvIiifImageUrl } from './iiif_slv.js';

const statusEl = document.getElementById('status');
const uiCanvasEl = document.getElementById('uiCanvas');
const glHostEl = document.getElementById('glHost');

const state = createState();

function setStatus(msg) { statusEl.textContent = msg; }

const three = createThreeRenderer({
  host: glHostEl
});

const ui = createUICanvas({
  canvas: uiCanvasEl,
  getState: () => state,
  setStatus,
  onPick: (name, halfUV) => {
    state.picks[name] = halfUV;

    // Update three.js uniforms incrementally
    const uLInf = state.picks.L_inf ? state.picks.L_inf : null;
    const uRInf = state.picks.R_inf ? state.picks.R_inf : null;

    let theta = 0;
    // if (allPicksDone(state)) theta = computeThetaFromPicks(state.picks);

    three.setUniforms({ uLInf, uRInf, theta });

    setStatus(allPicksDone(state)
      ? `All points set.`
      : `Picked ${name}. Next: ${nextPickName(state)}`
    );
  },
});

window.addEventListener('keydown', (ev) => {
  if (ev.key === 'r' || ev.key === 'R') {
    resetPicks(state);
    ui.draw();
    three.setUniforms({ uLInf: null, uRInf: null, theta: 0.0 });
    setStatus(`Reset. Next: ${nextPickName(state)}`);
  }
});

async function init() {
  try {
    setStatus(`Resolving IIIF for ${CONFIG.IE}…`);

    // Choose a preview size for responsiveness; bump to "max" for full-res
    const plateUrl = await getSlvIiifImageUrl(CONFIG.IE, {
      // quality: "gray",     // optional; if supported
      //size: "!3000,3000",     // good preview; adjust as needed
      size: "max",
      format: "jpg",
    });

    setStatus(`Loading image…`);

    await Promise.all([
      ui.load(plateUrl),
      three.loadTexture(plateUrl),
    ]);

    ui.resize();
    three.resize();

    setStatus(`Loaded ${CONFIG.IE}. Pick: ${nextPickName(state)}`);
  } catch (err) {
    console.error(err);
    setStatus(`Failed: ${err?.message ?? String(err)}`);
  }
}

init();
