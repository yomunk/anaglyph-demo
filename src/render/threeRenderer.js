import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js';
import { VERT_FULLSCREEN, FRAG_ANAGLYPH, FRAG_WIGGLE } from './shaders.js';


export function createThreeRenderer({ host }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  let contentAspect = 1; // default; update after texture load

  // Normalized in host/canvas space (0..1), y is TOP-down (DOM coords)
  let cropN = null;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // One uniform object shared by both materials
  const uniforms = {
    uTex: { value: null },
    uLInf: { value: new THREE.Vector2(0.5, 0.5) },
    uRInf: { value: new THREE.Vector2(0.5, 0.5) },
    uTime: { value: 0.0 },
    uWiggleHz: { value: 4.0 },       // default: 2 flips/sec
    uWiggleBlend: { value: 0.0 },    // default: hard switch
  };

  const matAnaglyph = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT_FULLSCREEN,
    fragmentShader: FRAG_ANAGLYPH,
  });

  const matWiggle = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT_FULLSCREEN,
    fragmentShader: FRAG_WIGGLE,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matAnaglyph);
  scene.add(mesh);

  let mode = 'anaglyph'; // or 'wiggle'
  const clock = new THREE.Clock();
  let animating = false;

  function setMode(newMode) {
    if (newMode === mode) return;
    mode = newMode;
    mesh.material = (mode === 'wiggle') ? matWiggle : matAnaglyph;

    // Start/stop animation loop
    if (mode === 'wiggle') startAnimation();
    else stopAnimationAndRenderOnce();
  }

  function startAnimation() {
    if (animating) return;
    animating = true;
    clock.start();
    tick();
  }

  function stopAnimationAndRenderOnce() {
    animating = false;
    // Keep last time value; or reset to 0 if you prefer
    render();
  }

  function tick() {
    if (!animating) return;
    uniforms.uTime.value = clock.getElapsedTime();
    render();
    requestAnimationFrame(tick);
  }

  async function loadTexture(url) {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const tex = await new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));

    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;

    uniforms.uTex.value = tex;

    // Plate is left+right; anaglyph content is a half
    const plateW = tex.image.width;
    const plateH = tex.image.height;
    const halfW  = Math.floor(plateW / 2);
    contentAspect = halfW / plateH; // preserve square pixels

    resize(); // recompute viewport
  }


  function setUniforms({ uLInf, uRInf, wiggleHz, wiggleBlend }) {
    if (uLInf) uniforms.uLInf.value.set(uLInf.u, uLInf.v);
    if (uRInf) uniforms.uRInf.value.set(uRInf.u, uRInf.v);
    if (typeof wiggleHz === 'number') uniforms.uWiggleHz.value = wiggleHz;
    if (typeof wiggleBlend === 'number') uniforms.uWiggleBlend.value = wiggleBlend;

    // In anaglyph mode, we render on-demand.
    // In wiggle mode, the animation loop will render anyway.
    if (mode !== 'wiggle') render();
  }

  function resize() {
    const r = host.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    render();
  }

  function setCropNormalized(rectN) {
    cropN = rectN;   // {x0,y0,x1,y1} or null
    render();
  }

  function render() {
    // CSS size (for normalization only, if needed)
    const r = host.getBoundingClientRect();
    const cssW = r.width;
    const cssH = r.height;

    // Drawing buffer size (THIS is what viewport/scissor use)
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    const W = Math.floor(buf.x);
    const H = Math.floor(buf.y);

    // Compute centered viewport that preserves contentAspect IN BUFFER PIXELS
    let vpW = W;
    let vpH = Math.floor(vpW / contentAspect);

    if (vpH > H) {
      vpH = H;
      vpW = Math.floor(vpH * contentAspect);
    }

    const vpX = Math.floor((W - vpW) / 2);
    const vpY = Math.floor((H - vpH) / 2);

    renderer.setScissorTest(true);

    // Clear full panel to black
    renderer.setViewport(0, 0, W, H);
    renderer.setScissor(0, 0, W, H);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, false, false);

    // Default: scissor to full viewport
    let scX = vpX, scY = vpY, scW = vpW, scH = vpH;

    if (cropN) {
      // cropN is normalized in CSS coords (top-left origin).
      // Convert to buffer pixels using W/H (buffer), not cssW/cssH.
      const x0 = Math.min(cropN.x0, cropN.x1) * W;
      const x1 = Math.max(cropN.x0, cropN.x1) * W;
      const y0 = Math.min(cropN.y0, cropN.y1) * H;
      const y1 = Math.max(cropN.y0, cropN.y1) * H;

      // Convert viewport to top-left origin coords for intersection
      const vpTopY = H - (vpY + vpH);

      const ix0 = Math.max(x0, vpX);
      const ix1 = Math.min(x1, vpX + vpW);
      const iy0 = Math.max(y0, vpTopY);
      const iy1 = Math.min(y1, vpTopY + vpH);

      const iw = Math.max(0, ix1 - ix0);
      const ih = Math.max(0, iy1 - iy0);

      scX = Math.floor(ix0);
      scW = Math.floor(iw);
      scH = Math.floor(ih);
      scY = Math.floor(H - (iy0 + ih)); // back to bottom-left
    }

    // Render content in letterboxed viewport (viewport stays the same)
    renderer.setViewport(vpX, vpY, vpW, vpH);
    renderer.setScissor(scX, scY, scW, scH);
    renderer.render(scene, camera);

    renderer.setScissorTest(false);
  }

  window.addEventListener('resize', resize);

  return {
    loadTexture,
    setUniforms,
    setMode,
    getMode: () => mode,
    resize,
    render,
    setCropNormalized,
  };
}
