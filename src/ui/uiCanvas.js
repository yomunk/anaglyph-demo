import { PICK_ORDER } from '../state.js';
import { fullUVToHalfUV, halfUVToFullUV } from '../math.js';

export function createUICanvas({ canvas, onPick, getState, setStatus }) {
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';

  let plateW = 0, plateH = 0;
  let drawRect = null;

  // --- Loupe state ---
  let loupeActive = false;
  let loupeSrcX = 0;     // source image pixel coords (integer)
  let loupeSrcY = 0;
  let hasLoupePos = false;

  const LOUPE_KEY = ' ';          // Space
  const LOUPE_SIZE_CSS = 220;     // size of loupe on screen (CSS px)
  const LOUPE_BORDER_CSS = 2;

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

    if (loupeActive) drawLoupe();

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

  function onKeyDown(ev) {
    if (ev.key === LOUPE_KEY) {
      if (!loupeActive) {
        loupeActive = true;
        draw();
      }
      ev.preventDefault();
    }
  }

  function onKeyUp(ev) {
    if (ev.key === LOUPE_KEY) {
      loupeActive = false;
      draw();
      ev.preventDefault();
    }
  }

  // Use window so key works even if canvas isn't focused
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function updateLoupeFromPointer(ev) {
    const uvFull = pointerToFullUV(ev);
    if (!uvFull || !img || !drawRect) {
      hasLoupePos = false;
      return;
    }

    // uvFull.u is left->right, uvFull.v is bottom->top (because you flipped for three)
    const sx = uvFull.u * plateW;
    const sy = (1.0 - uvFull.v) * plateH; // convert back to top-left origin

    // Snap to integer source pixels so it feels "pixel-accurate"
    loupeSrcX = Math.max(0, Math.min(plateW - 1, Math.round(sx)));
    loupeSrcY = Math.max(0, Math.min(plateH - 1, Math.round(sy)));
    hasLoupePos = true;
  }

  function drawLoupe() {
    if (!hasLoupePos || !img) return;

    const dpr = devicePixelRatio || 1;

    // Work in canvas internal pixels (device pixels)
    const loupeSize = Math.floor(LOUPE_SIZE_CSS * dpr);  
    const border = Math.floor(LOUPE_BORDER_CSS * dpr);

    // Pixel-for-pixel means: source region size == destination size (in canvas pixels)
    const srcW = loupeSize;
    const srcH = loupeSize;

    // Source rect centered on (loupeSrcX, loupeSrcY)
    let sx0 = Math.floor(loupeSrcX - srcW / 2);
    let sy0 = Math.floor(loupeSrcY - srcH / 2);

    // Clamp source rect to image bounds
    sx0 = Math.max(0, Math.min(plateW - srcW, sx0));
    sy0 = Math.max(0, Math.min(plateH - srcH, sy0));

    // Place loupe near the cursor if you have it; simplest: top-right corner
    // If you prefer near cursor, store last pointer position and offset it.
    const pad = Math.floor(12 * dpr);
    let dx0 = canvas.width - loupeSize - pad;
    let dy0 = pad;

    // Disable smoothing so pixels are crisp
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Backplate
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(dx0 - border, dy0 - border, loupeSize + 2 * border, loupeSize + 2 * border);

    // Draw the source crop 1:1
    ctx.drawImage(img, sx0, sy0, srcW, srcH, dx0, dy0, loupeSize, loupeSize);

    // Crosshair at loupe center
    const cx = dx0 + (loupeSrcX - sx0);
    const cy = dy0 + (loupeSrcY - sy0);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(cx - 10 * dpr, cy);
    ctx.lineTo(cx + 10 * dpr, cy);
    ctx.moveTo(cx, cy - 10 * dpr);
    ctx.lineTo(cx, cy + 10 * dpr);
    ctx.stroke();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = border;
    ctx.strokeRect(dx0, dy0, loupeSize, loupeSize);

    ctx.restore();
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

  canvas.addEventListener('pointermove', (ev) => {
    if (!loupeActive) return;
    updateLoupeFromPointer(ev);
    draw();
  });


  return { load, resize, draw };
}
