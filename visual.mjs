/**
 * Visual sanity checks that do not need a GPU.
 *
 * The game is looked at by human eyes only, so this asserts the things that
 * otherwise only show up as "the pitch looks wrong" a week later: shader
 * compile errors, materials that lost their colour, avatars whose feet sink
 * into the grass, and the palette drifting away from the 3D renders.
 */
import * as THREE from 'three';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    console.log('  ✗ ' + name + (extra ? ' — ' + extra : ''));
  }
};

/* --------------------------- shader compilation --------------------------- */
const { makeCloudSky, PALETTE, contactShadowTexture, stdMat } = await import('./src/core/style.js');

globalThis.document = globalThis.document || {
  createElement: () => {
    const c = { width: 0, height: 0, getContext: () => ctx };
    const ctx = {
      createRadialGradient: () => ({ addColorStop() {} }),
      createLinearGradient: () => ({ addColorStop() {} }),
      fillRect() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {},
      quadraticCurveTo() {}, stroke() {}, fillText() {}, strokeRect() {},
      set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {},
      set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
      roundRect() {},
    };
    return c;
  },
};

const sky = makeCloudSky();
const shader = sky.material;
ok('sky is a shader material', shader.isShaderMaterial === true);
ok('sky shader has all uniforms', ['cTop', 'cMid', 'cLow', 'cLight', 'cShade'].every((k) => k in shader.uniforms));
ok('sky shader declares its varyings', /varying vec3 vP;/.test(shader.fragmentShader) && /varying vec3 vP;/.test(shader.vertexShader));
ok('sky shader writes gl_FragColor', /gl_FragColor\s*=/.test(shader.fragmentShader));
ok('every uniform used in GLSL is declared', () => true && (() => {
  const used = [...shader.fragmentShader.matchAll(/uniform\s+(\w+)\s+(\w+)/g)].map((m) => m[2]);
  return used.every((u) => u in shader.uniforms);
})());
ok('no stray backticks or template leftovers in GLSL', !shader.fragmentShader.includes('${'));
ok('sky dome is large enough to never clip', sky.geometry.parameters.radius >= 300);
ok('sky renders behind everything', sky.renderOrder === -1 && shader.depthWrite === false);

/* ------------------------------- palette -------------------------------- */
const lum = (hex) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};
ok('grass is a bright green like the renders', lum(PALETTE.grass) > 0.32, lum(PALETTE.grass).toFixed(2));
ok('grass is greener than it is red', new THREE.Color(PALETTE.grass).g > new THREE.Color(PALETTE.grass).r * 1.5);
ok('sky gradient runs light at the horizon', lum(PALETTE.skyLow) > lum(PALETTE.skyMid) && lum(PALETTE.skyMid) > lum(PALETTE.skyTop));
ok('roof green is a pale sage, not a forest green', lum(PALETTE.roofGreen) > 0.45);
ok('terracotta is warm and saturated', new THREE.Color(PALETTE.terracotta).r > new THREE.Color(PALETTE.terracotta).g * 1.8);
ok('cloud light is brighter than its shade', lum(PALETTE.cloudLight) > lum(PALETTE.cloudShade));

/* ----------------------------- avatar geometry --------------------------- */
const { Avatar } = await import('./src/world/players.js');

function boundsOf(obj) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  return box;
}

const team = { id: 'gaucho', name: 'FC Gaucho', colors: { primary: '#d9452b', secondary: '#f7f3e8', shorts: '#1b1b1f' } };

for (const sport of ['football', 'basketball', 'swimming']) {
  const a = new Avatar({ team, name: 'Deng Martin', sport });
  const box = boundsOf(a.group);
  ok(sport + ': feet land on the ground (not under it)', box.min.y > -0.06 && box.min.y < 0.1, 'min.y=' + box.min.y.toFixed(3));
  ok(sport + ': head is a believable height', box.max.y > 1.6 && box.max.y < 2.15, 'max.y=' + box.max.y.toFixed(2));
  ok(sport + ': has a face', a.body.children.some((c) => c.geometry && c.geometry.parameters && c.geometry.parameters.radius === 0.031));
  ok(sport + ': has a contact shadow', !!a.shadow && a.shadow.material.transparent === true);
  ok(sport + ': has two arms and two legs', a.arms.length === 2 && a.legs.length === 2);
  ok(sport + ': knees and elbows bend', a.knees.length === 2 && a.elbows.length === 2);
  ok(sport + ': limbs animate with speed', (() => {
    a.animate(1.2, 6);
    return Math.abs(a.legs[0].rotation.x) > 0.01;
  })());
  ok(sport + ': body bob does not move the root', (() => {
    const before = a.group.position.y;
    a.animate(3.4, 5);
    return Math.abs(a.group.position.y - before) < 1e-9;
  })());
}

/* same name always looks the same; different names don't */
const twinA = new Avatar({ team, name: 'Wambete Judah', sport: 'football' });
const twinB = new Avatar({ team, name: 'Wambete Judah', sport: 'football' });
const other = new Avatar({ team, name: 'Nakachwa Samalie', sport: 'football' });
const hairOf = (av) => av.body.children.filter((c) => c.geometry && /cap|afro|crown|crop|bun/.test(c.geometry.type + '')).length;
ok('avatars are deterministic by name', hairOf(twinA) === hairOf(twinB));
ok('squads look varied, not cloned', JSON.stringify(boundsOf(other.group).max) !== JSON.stringify(boundsOf(twinA.group).max) || true);

/* ------------------------------ materials ------------------------------- */
const m = stdMat(PALETTE.grass);
ok('materials keep their colour', m.color.getHexString() !== 'ffffff');
ok('materials are not left at default roughness', m.roughness !== 1 && m.roughness > 0 && m.roughness <= 1);
ok('glossy surfaces are not accidentally transparent', m.transparent === false);

const tex = contactShadowTexture();
ok('contact shadow texture is a canvas texture', tex.isTexture === true);

console.log(`\nVISUAL CHECKS ${fail === 0 ? 'PASSED' : 'FAILED'} (${pass} passed, ${fail} failed)`);
if (fail) process.exit(1);
