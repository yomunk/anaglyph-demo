import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js';
import { VERT_FULLSCREEN, FRAG_ANAGLYPH, FRAG_WIGGLE } from './shaders.js';

export function createThreeRenderer({ host }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  let contentAspect = 1; // default; update after texture load

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // One uniform object shared by both materials
  const uniforms = {
    uTex: { value: null },
    uLInf: { value: new THREE.Vector2(0.5, 0.5) },
    uRInf: { value: new THREE.Vector2(0.5, 0.5) },
    uTime: { value: 0.0 },
    uWiggleHz: { value: 5.0 },       // default: 2 flips/sec
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

  function render() {
    const r = host.getBoundingClientRect();
    const W = Math.floor(r.width);
    const H = Math.floor(r.height);

    // Compute centered viewport that preserves contentAspect
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

    // Render content in letterboxed viewport
    renderer.setViewport(vpX, vpY, vpW, vpH);
    renderer.setScissor(vpX, vpY, vpW, vpH);
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
  };
}
