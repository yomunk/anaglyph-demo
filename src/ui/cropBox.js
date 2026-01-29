// src/ui/cropBox.js
export function attachCropBox(overlayEl, {
  onChange,
  initial = { x0: 0.15, y0: 0.15, x1: 0.85, y1: 0.85 }, // normalized, top-left origin
  minPx = 24,
} = {}) {
  // Current rect in *pixel* coords (top-left origin) relative to overlayEl
  let rectPx = null;

  // Drag state
  let mode = null; // 'move' | 'nw' | 'ne' | 'sw' | 'se'
  let start = null; // {x,y, rectPxSnapshot}

  // DOM elements
  const rectEl = document.createElement('div');
  rectEl.className = 'cropRect';
  overlayEl.appendChild(rectEl);

  const handles = {};
  for (const k of ['nw','ne','sw','se']) {
    const h = document.createElement('div');
    h.className = `cropHandle ${k}`;
    h.dataset.handle = k;
    rectEl.appendChild(h);
    handles[k] = h;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function getOverlayRect() {
    return overlayEl.getBoundingClientRect();
  }

  function pxFromNorm(n) {
    const r = getOverlayRect();
    const x0 = n.x0 * r.width;
    const y0 = n.y0 * r.height;
    const x1 = n.x1 * r.width;
    const y1 = n.y1 * r.height;
    return normToOrderedPx({ x0, y0, x1, y1 });
  }

  function normFromPx(p) {
    const r = getOverlayRect();
    return {
      x0: p.x0 / r.width,
      y0: p.y0 / r.height,
      x1: p.x1 / r.width,
      y1: p.y1 / r.height,
    };
  }

  function normToOrderedPx({ x0, y0, x1, y1 }) {
    const ox0 = Math.min(x0, x1);
    const oy0 = Math.min(y0, y1);
    const ox1 = Math.max(x0, x1);
    const oy1 = Math.max(y0, y1);
    return { x0: ox0, y0: oy0, x1: ox1, y1: oy1 };
  }

  function setRectPx(p, emit = true) {
    const r = getOverlayRect();

    // enforce min size
    let x0 = p.x0, y0 = p.y0, x1 = p.x1, y1 = p.y1;
    let w = x1 - x0;
    let h = y1 - y0;

    if (w < minPx) {
      const cx = (x0 + x1) * 0.5;
      x0 = cx - minPx * 0.5;
      x1 = cx + minPx * 0.5;
      w = minPx;
    }
    if (h < minPx) {
      const cy = (y0 + y1) * 0.5;
      y0 = cy - minPx * 0.5;
      y1 = cy + minPx * 0.5;
      h = minPx;
    }

    // clamp to overlay bounds
    const dx0 = clamp(x0, 0, r.width);
    const dy0 = clamp(y0, 0, r.height);
    const dx1 = clamp(x1, 0, r.width);
    const dy1 = clamp(y1, 0, r.height);

    rectPx = normToOrderedPx({ x0: dx0, y0: dy0, x1: dx1, y1: dy1 });
    drawRect();

    if (emit) onChange?.(normFromPx(rectPx));
  }

  function drawRect() {
    if (!rectPx) return;
    const x = rectPx.x0;
    const y = rectPx.y0;
    const w = rectPx.x1 - rectPx.x0;
    const h = rectPx.y1 - rectPx.y0;

    rectEl.style.left = `${x}px`;
    rectEl.style.top = `${y}px`;
    rectEl.style.width = `${w}px`;
    rectEl.style.height = `${h}px`;
  }

  function localPoint(ev) {
    const r = getOverlayRect();
    return {
      x: ev.clientX - r.left,
      y: ev.clientY - r.top,
      w: r.width,
      h: r.height
    };
  }

  function hitTestMode(ev) {
    // If pointer is on a handle, return that handle key. Otherwise 'move' if inside rect.
    const t = ev.target;
    const handle = t?.dataset?.handle;
    if (handle) return handle;

    // Only start moving if click is inside the rect (not just anywhere on overlay)
    const p = localPoint(ev);
    if (!rectPx) return null;
    if (p.x >= rectPx.x0 && p.x <= rectPx.x1 && p.y >= rectPx.y0 && p.y <= rectPx.y1) return 'move';
    return null;
  }

  function onDown(ev) {
    const m = hitTestMode(ev);
    if (!m) return; // ignore clicks outside rect (keeps widget stable)
    overlayEl.setPointerCapture(ev.pointerId);
    mode = m;
    const p = localPoint(ev);
    start = { x: p.x, y: p.y, rect: { ...rectPx } };
    ev.preventDefault();
  }

  function onMove(ev) {
    if (!mode || !start) return;
    const p = localPoint(ev);
    const dx = p.x - start.x;
    const dy = p.y - start.y;

    const base = start.rect;
    let next = { ...base };

    if (mode === 'move') {
      const w = base.x1 - base.x0;
      const h = base.y1 - base.y0;

      next.x0 = base.x0 + dx;
      next.y0 = base.y0 + dy;
      next.x1 = next.x0 + w;
      next.y1 = next.y0 + h;
    } else if (mode === 'nw') {
      next.x0 = base.x0 + dx;
      next.y0 = base.y0 + dy;
    } else if (mode === 'ne') {
      next.x1 = base.x1 + dx;
      next.y0 = base.y0 + dy;
    } else if (mode === 'sw') {
      next.x0 = base.x0 + dx;
      next.y1 = base.y1 + dy;
    } else if (mode === 'se') {
      next.x1 = base.x1 + dx;
      next.y1 = base.y1 + dy;
    }

    setRectPx(next, true);
    ev.preventDefault();
  }

  function onUp(ev) {
    if (!mode) return;
    mode = null;
    start = null;
    ev.preventDefault();
  }

  function onResize() {
    // Recompute pixel rect from last normalized rect when overlay size changes.
    // If we have rectPx, convert to normalized, then back to px with new dimensions.
    if (!rectPx) return;
    const n = normFromPx(rectPx);
    setRectPx(pxFromNorm(n), true);
  }

  // Attach listeners
  overlayEl.addEventListener('pointerdown', onDown);
  overlayEl.addEventListener('pointermove', onMove);
  overlayEl.addEventListener('pointerup', onUp);
  overlayEl.addEventListener('pointercancel', onUp);

  // Initialize to default rect
  rectPx = pxFromNorm(initial);
  drawRect();
  onChange?.(normFromPx(rectPx));

  // Optional: keep it stable if the panel resizes
  window.addEventListener('resize', onResize);

  function setNormalized(n) { setRectPx(pxFromNorm(n), true); }
  function getNormalized() { return rectPx ? normFromPx(rectPx) : null; }

  return {
    setNormalized,
    getNormalized,
    destroy() {
      window.removeEventListener('resize', onResize);
      overlayEl.removeEventListener('pointerdown', onDown);
      overlayEl.removeEventListener('pointermove', onMove);
      overlayEl.removeEventListener('pointerup', onUp);
      overlayEl.removeEventListener('pointercancel', onUp);
      rectEl.remove();
    }
  };
}
