/* Small helpers shared by every game mode. */
import * as THREE from 'three';

export const IS_TOUCH =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 1);

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const angleDelta = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Set by tests: () => renderer | null. */
let rendererFactory = null;
export function setRendererFactory(fn) {
  rendererFactory = fn;
}

export function createRenderer(canvas) {
  if (rendererFactory) {
    const r = rendererFactory(canvas);
    if (r) finishRenderer(r, canvas);
    return r;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !IS_TOUCH,
      powerPreference: 'high-performance',
      alpha: false,
    });
  } catch (err) {
    console.error('WebGL unavailable', err);
    return null;
  }
  finishRenderer(renderer, canvas);
  return renderer;
}

/** Extra renderer setup, split out so it can be stubbed in tests. */
function finishRenderer(renderer, canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 2 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setSize(
    canvas.clientWidth || window.innerWidth,
    canvas.clientHeight || window.innerHeight,
    false
  );
  renderer.shadowMap.enabled = !IS_TOUCH;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

/** Simple vertical-gradient sky dome so every venue sits in a Mukono afternoon. */
export function makeSky(top = '#1a4f8a', mid = '#8fc7e8', bottom = '#f3e2bd') {
  const geo = new THREE.SphereGeometry(400, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      mid: { value: new THREE.Color(mid) },
      bottom: { value: new THREE.Color(bottom) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
      void main(){
        float h = normalize(vP).y;
        vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.75, h))
                          : mix(bottom, mid, smoothstep(-0.15, 0.12, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

export function makeLights(scene, intensity = 1) {
  const hemi = new THREE.HemisphereLight(0xbfe0ff, 0x5a6b3a, 1.05 * intensity);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.1 * intensity);
  sun.position.set(38, 52, 22);
  sun.castShadow = !IS_TOUCH;
  if (sun.castShadow) {
    sun.shadow.mapSize.set(1024, 1024);
    const c = sun.shadow.camera;
    c.left = -60;
    c.right = 60;
    c.top = 60;
    c.bottom = -60;
    c.far = 180;
    sun.shadow.bias = -0.0008;
  }
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe9ff, 0.35 * intensity);
  fill.position.set(-30, 24, -28);
  scene.add(fill);
  return { hemi, sun, fill };
}

export function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        Object.keys(m).forEach((k) => {
          const v = m[k];
          if (v && v.isTexture) v.dispose();
        });
        m.dispose();
      });
    }
  });
  scene.clear();
}
