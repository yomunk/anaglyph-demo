import { CONFIG } from './config.js';
import { createState, nextPickName, allPicksDone, resetPicks } from './state.js';
import { createUICanvas } from './ui/uiCanvas.js';
import { createThreeRenderer } from './render/threeRenderer.js';
import { getSlvIiifImageUrl } from './iiif_slv.js';
import { attachCropBox } from './ui/cropBox.js';

const statusEl = document.getElementById('status');
const uiCanvasEl = document.getElementById('uiCanvas');
const glHostEl = document.getElementById('glHost');
const overlayEl = document.getElementById('cropOverlay');



const state = createState();

const IE = getIeFromUrl(CONFIG.IE);
ensureIeInUrl(IE);

function setStatus(msg) { statusEl.textContent = msg; }

function getIeFromUrl(defaultIe) {
  const url = new URL(window.location.href);
  const ie = url.searchParams.get('ie');
  return (ie && ie.trim().length) ? ie.trim() : defaultIe;
}

function ensureIeInUrl(ie) {
  const url = new URL(window.location.href);

  if (!url.searchParams.has('ie')) {
    url.searchParams.set('ie', ie);
    window.history.replaceState({}, '', url);
  }
}

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
    const uLStat = state.picks.L_stat ? state.picks.L_stat : null;
    const uRStat = state.picks.R_stat ? state.picks.R_stat : null;

    three.setUniforms({ uLStat, uRStat });

    setStatus(allPicksDone(state)
      ? `All points set.`
      : `Picked ${name}. Next: ${nextPickName(state)}`
    );
  },
});

attachCropBox(overlayEl, {
  onChange: (cropN) => three.setCropNormalized(cropN),
  initial: { x0: 0.2, y0: 0.2, x1: 0.8, y1: 0.8 },
});


window.addEventListener('keydown', (ev) => {
  if (ev.key === 'r' || ev.key === 'R') {
    resetPicks(state);
    ui.draw();
    three.setUniforms({ uLStat: null, uRStat: null });
    setStatus(`Reset. Next: ${nextPickName(state)}`);
  }
  if (ev.key === '1') three.setMode('anaglyph');
  if (ev.key === '2') three.setMode('wiggle');
  if (ev.key === '+' ) three.setUniforms({ wiggleHz: 5.0 });
  if (ev.key === '-' ) three.setUniforms({ wiggleHz: state.wiggleHz = Math.max(0.5, state.wiggleHz - 0.5) });
});

async function init() {
  try {
    setStatus(`Resolving IIIF for ${IE}…`);

    // Choose a preview size for responsiveness; bump to "max" for full-res
    const plateUrl = await getSlvIiifImageUrl(IE, {
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

    setStatus(`Loaded ${IE}. Pick: ${nextPickName(state)}`);
  } catch (err) {
    console.error(err);
    setStatus(`Failed: ${err?.message ?? String(err)}`);
  }
}

init();

