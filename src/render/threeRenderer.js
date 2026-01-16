import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js';
import { VERT_FULLSCREEN, FRAG_ANAGLYPH } from './shaders.js';

export function createThreeRenderer({ host, plateUrl }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  let contentAspect = 1; // default; update after texture load
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTex:   { value: null },
      uLInf:  { value: new THREE.Vector2(0.5, 0.5) },
      uRInf:  { value: new THREE.Vector2(0.5, 0.5) },
      uTheta: { value: 0.0 },
    },
    vertexShader: VERT_FULLSCREEN,
    fragmentShader: FRAG_ANAGLYPH,
  });

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), mat));

    async function loadTexture(url) {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const tex = await new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));

    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;

    mat.uniforms.uTex.value = tex;

    // Plate is left+right; anaglyph content is a half
    const plateW = tex.image.width;
    const plateH = tex.image.height;
    const halfW  = Math.floor(plateW / 2);
    contentAspect = halfW / plateH; // preserve square pixels

    resize(); // recompute viewport
    }


  function setUniforms({ uLInf, uRInf, theta }) {
    if (uLInf) mat.uniforms.uLInf.value.set(uLInf.u, uLInf.v);
    if (uRInf) mat.uniforms.uRInf.value.set(uRInf.u, uRInf.v);
    if (typeof theta === 'number') mat.uniforms.uTheta.value = theta;
    render();
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

  return { loadTexture, setUniforms, resize, render };
}
