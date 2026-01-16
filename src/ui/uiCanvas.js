import { PICK_ORDER } from '../state.js';
import { fullUVToHalfUV, halfUVToFullUV } from '../math.js';

export function createUICanvas({ canvas, onPick, getState, setStatus }) {
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';

  let plateW = 0, plateH = 0;
  let drawRect = null;

  function resize() {
    const r = canvas.getBoundingClientRect();
    canvas.width  = Math.floor(r.width * devicePixelRatio);
    canvas.height = Math.floor(r.height * devicePixelRatio);
    draw();
  }

  function fitRect() {
    const cw = canvas.width, ch = canvas.height;
    const scale = Math.min(cw / plateW, ch / plateH);
    const drawW = plateW * scale;
    const drawH = plateH * scale;
    const ox = (cw - drawW) * 0.5;
    const oy = (ch - drawH) * 0.5;
    drawRect = { ox, oy, drawW, drawH, scale };
  }

  function draw() {
    if (!plateW) return;

    fitRect();
    const { ox, oy, drawW, drawH } = drawRect;

    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(img, ox, oy, drawW, drawH);

    // Midline
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(ox + drawW * 0.5, oy);
    ctx.lineTo(ox + drawW * 0.5, oy + drawH);
    ctx.stroke();

    // Picks overlay
    const state = getState();
    const radius = 6 * devicePixelRatio;

    for (const k of PICK_ORDER) {
      const p = state.picks[k];
      if (!p) continue;

      const isLeft = k.startsWith('L_');
      const full = halfUVToFullUV(isLeft, p.u, p.v);

      const { x, y } = fullUVToCanvasXY(full, drawRect);

      ctx.fillStyle = isLeft ?  'rgba(255,0,0,0.95)' : 'rgba(0,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `${12 * devicePixelRatio}px system-ui`;
      ctx.fillText(k, x + 10 * devicePixelRatio, y - 10 * devicePixelRatio);
    }
  }

  function pointerToFullUV(ev) {
    if (!drawRect) return null;
    const r = canvas.getBoundingClientRect();
    const xCss = ev.clientX - r.left;
    const yCss = ev.clientY - r.top;

    const x = xCss * devicePixelRatio;
    const y = yCss * devicePixelRatio;

    const { ox, oy, drawW, drawH } = drawRect;
    if (x < ox || y < oy || x > ox + drawW || y > oy + drawH) return null;

    const u = (x - ox) / drawW;
    const v = 1.0 - (y - oy) / drawH; // convert for three.js
    return { u, v };
  }

  function fullUVToCanvasXY({ u, v }, drawRect) {
    const { ox, oy, drawW, drawH } = drawRect;

    const x = ox + u * drawW;
    const y = oy + (1.0 - v) * drawH; // <-- flip BACK for canvas

    return { x, y };
    }


  function onPointerDown(ev) {
    const uvFull = pointerToFullUV(ev);
    if (!uvFull) return;

    const state = getState();
    const next = (() => {
      for (const k of PICK_ORDER) if (!state.picks[k]) return k;
      return null;
    })();
    if (!next) return;

    const { isLeft, u, v } = fullUVToHalfUV(uvFull.u, uvFull.v);

    // Enforce half selection by key prefix
    if (next.startsWith('L_') && !isLeft) {
      setStatus(`Pick ${next} on LEFT half.`);
      return;
    }
    if (next.startsWith('R_') && isLeft) {
      setStatus(`Pick ${next} on RIGHT half.`);
      return;
    }

    onPick(next, { u, v }); // half-UV
    draw();
  }

function load(url) {
  return new Promise((resolve, reject) => {
    img.onload = () => {
      plateW = img.naturalWidth;
      plateH = img.naturalHeight;
      resolve({ plateW, plateH });
      draw();
    };
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', resize);

  return { load, resize, draw };
}
