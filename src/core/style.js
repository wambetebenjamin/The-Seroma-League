/**
 * One art direction for the whole game, matching the stylized 3D renders used
 * across the site: bright saturated daylight, soft global-illumination feel,
 * smooth low-noise surfaces, rounded geometry and puffy cumulus skies.
 *
 * Everything visual pulls its colours and material response from here so the
 * world, the players and the artwork on the marketing screens look like they
 * came out of the same renderer.
 */
import * as THREE from 'three';

export const PALETTE = {
  skyTop: '#2f7ed0',
  skyMid: '#8ecbf0',
  skyLow: '#dceffe',
  cloudLight: '#ffffff',
  cloudShade: '#cfdcea',
  grass: '#63ab3c',
  grassDark: '#549a32',
  grassLight: '#71b746',
  dirt: '#b26234',
  track: '#8d4a3a',
  terracotta: '#d1783f',
  terracottaDeep: '#b96230',
  cream: '#e9dfc7',
  roofGreen: '#a8c6a4',
  roofGreenDeep: '#8fb28c',
  concrete: '#cfc8bb',
  concreteWarm: '#d8c7ae',
  glass: '#2a4b58',
  wood: '#8a5a35',
  water: '#31b6d4',
  waterDeep: '#1b8fb0',
};

/** Vivid, slightly glossy "rendered" surface. */
export function stdMat(color, opts = {}) {
  const { roughness = 0.62, metalness = 0.0, flat = false, ...rest } = opts;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
    flatShading: flat,
    ...rest,
  });
}

/** Painted plastic / metal for roofs and sports equipment. */
export function glossyMat(color, opts = {}) {
  return stdMat(color, { roughness: 0.34, metalness: 0.22, ...opts });
}

/** Matte fabric, used for kit, awnings and banners. */
export function fabricMat(color, opts = {}) {
  return stdMat(color, { roughness: 0.87, ...opts });
}

/* ------------------------------ sky & light ------------------------------ */

const CLOUD_FRAG = `
  uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cLow;
  uniform vec3 cLight; uniform vec3 cShade;
  varying vec3 vP;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  void main(){
    vec3 dir = normalize(vP);
    float h = dir.y;

    // gradient body of the sky
    vec3 sky = h > 0.1
      ? mix(cMid, cTop, smoothstep(0.1, 0.72, h))
      : mix(cLow, cMid, smoothstep(-0.15, 0.1, h));

    // cumulus band: flat-bottomed puffs, lit from the sun side
    if (h > 0.015) {
      vec2 uv = dir.xz / max(h + 0.16, 0.16);
      float n = fbm(uv * 1.05 + vec2(11.0, 4.0));
      float puffs = smoothstep(0.56, 0.80, n + 0.06 * fbm(uv * 2.6));
      float fade = smoothstep(0.015, 0.26, h);
      puffs *= fade;
      float lit = smoothstep(0.42, 0.95, fbm(uv * 1.35 + vec2(2.0, 7.0)));
      vec3 cloud = mix(cShade, cLight, clamp(lit * 1.25, 0.0, 1.0));
      sky = mix(sky, cloud, puffs * 0.92);
    }

    gl_FragColor = vec4(sky, 1.0);
  }
`;

/**
 * Sky dome with real puffy clouds. Same look as the big cumulus skies in the
 * promo renders; costs one noise shader and no textures.
 */
export function makeCloudSky(top = PALETTE.skyTop, mid = PALETTE.skyMid, low = PALETTE.skyLow) {
  const geo = new THREE.SphereGeometry(420, 40, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      cTop: { value: new THREE.Color(top) },
      cMid: { value: new THREE.Color(mid) },
      cLow: { value: new THREE.Color(low) },
      cLight: { value: new THREE.Color(PALETTE.cloudLight) },
      cShade: { value: new THREE.Color(PALETTE.cloudShade) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: CLOUD_FRAG,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

/** Bright three-point daylight: warm key, blue sky bounce, cool rim. */
export function makeRenderLights(scene, intensity = 1) {
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7f9a5e, 1.25 * intensity);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff4dc, 2.35 * intensity);
  sun.position.set(34, 46, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -52;
  c.right = 52;
  c.top = 52;
  c.bottom = -52;
  c.far = 170;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(sun);

  const bounce = new THREE.DirectionalLight(0xdceaff, 0.5 * intensity);
  bounce.position.set(-26, 18, -30);
  scene.add(bounce);

  const rim = new THREE.DirectionalLight(0xffe9c2, 0.42 * intensity);
  rim.position.set(-12, 10, 34);
  scene.add(rim);

  return { hemi, sun, bounce, rim };
}

/* ---------------------------- contact shadows ---------------------------- */

let shadowTex = null;

/** Soft radial blob used under feet so everyone sits on the ground. */
export function contactShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(20,30,18,0.52)');
  grad.addColorStop(0.55, 'rgba(20,30,18,0.26)');
  grad.addColorStop(1, 'rgba(20,30,18,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  shadowTex = new THREE.CanvasTexture(c);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  return shadowTex;
}

/**
 * A blob shadow that always lies flat under a moving object. Cheap enough to
 * keep on phones where real shadow maps are switched off.
 */
export function addContactShadow(parent, radius = 0.62, opacity = 0.85) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2.6, radius * 2.6),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.022;
  mesh.renderOrder = 2;
  parent.add(mesh);
  return mesh;
}

/** Warmer, slightly boosted tone mapping for the rendered look. */
export function applyRenderLook(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

/** Distant hills as smooth rounded shapes, framing every venue. */
export function addHills(scene, {
  radius = 210,
  count = 16,
  colors = ['#7fae5b', '#93bd6a', '#6f9f52'],
} = {}) {
  const grp = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 16, 10);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.13;
    const r = radius + (i % 3) * 22;
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(colors[i % colors.length]),
        roughness: 0.95,
        fog: true,
      })
    );
    const s = 44 + (i % 4) * 16;
    m.scale.set(s * 1.6, s * 0.42, s);
    m.position.set(Math.cos(a) * r, -s * 0.24, Math.sin(a) * r);
    grp.add(m);
  }
  scene.add(grp);
  return grp;
}

/** Rounded hedge / flower-bed blocks, like the planters around the renders. */
export function addHedge(scene, x, z, { w = 6, d = 1.4, rot = 0, color = '#3f8b3a' } = {}) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.92, flatShading: false });
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), new THREE.MeshStandardMaterial({ color: 0xd6d0c4, roughness: 0.9 }));
  base.position.y = 0.25;
  grp.add(base);
  const n = Math.max(2, Math.round(w / 0.9));
  const leaf = new THREE.SphereGeometry(0.52, 10, 8);
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(leaf, mat);
    b.position.set(-w / 2 + 0.5 + (i * (w - 1)) / Math.max(1, n - 1), 0.66, 0);
    b.scale.setScalar(0.85 + Math.random() * 0.3);
    b.castShadow = true;
    grp.add(b);
  }
  grp.position.set(x, 0, z);
  grp.rotation.y = rot;
  scene.add(grp);
  return grp;
}
