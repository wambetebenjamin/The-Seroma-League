/**
 * Software-render any game scene to a PNG so the pitches can be inspected
 * without a GPU. Flattens meshes (instancing, groups, materials) into triangles
 * and rasterises them with a z-buffer and a simple sun term.
 *
 *   node tools/scene-shot.mjs football out.png [camX camY camZ lookX lookY lookZ]
 */
import '../smoke-helpers.mjs';
import * as THREE from 'three';
import zlib from 'node:zlib';
import fs from 'node:fs';

const [sport = 'football', out = 'tools/shot.png', ...rest] = process.argv.slice(2);
const games = {
  football: (await import('../src/games/football.js')).FootballGame,
  basketball: (await import('../src/games/basketball.js')).BasketballGame,
  swimming: (await import('../src/games/swimming.js')).SwimmingGame,
};
const game = new games[sport]({ appendChild() {}, clientWidth: 900, clientHeight: 600 }, {
  homeTeam: 'gaucho', awayTeam: 'theos', onEvent() {},
});
await game.init();
// let the world settle a beat
for (let i = 0; i < 30; i++) {
  try { game.update?.(1 / 60, { consumeLook: () => ({ x: 0, y: 0 }), consumeActions: () => new Set(), moveVector: () => ({ x: 0, y: 0 }) }); } catch {}
}

const W = 1100, H = 640;
const buf = new Float32Array(W * H * 3);
const depth = new Float32Array(W * H).fill(Infinity);

const cam = new THREE.PerspectiveCamera(58, W / H, 0.1, 900);
const defaults = {
  football: [[0, 16, 52], [0, 0, -4]],
  basketball: [[0, 9, 26], [0, 2, -8]],
  swimming: [[0, 6, 16], [0, 0, -14]],
};
const [pos, look] = rest.length >= 6
  ? [rest.slice(0, 3).map(Number), rest.slice(3, 6).map(Number)]
  : defaults[sport] || defaults.football;
cam.position.set(...pos);
cam.lookAt(new THREE.Vector3(...look));
cam.updateMatrixWorld();
const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);

const sun = new THREE.Vector3(0.45, 0.82, 0.35).normalize();
const v = new THREE.Vector3();
const nrm = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const triWorld = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
let tris = 0;

const projected = [];
const pushTri = (a, b, c, color, shade) => {
  const s = [a, b, c].map(([x, y, z]) => {
    const p = new THREE.Vector4(x, y, z, 1).applyMatrix4(vp);
    if (p.w <= 0.01) return null;
    return [((p.x / p.w) * 0.5 + 0.5) * W, (1 - ((p.y / p.w) * 0.5 + 0.5)) * H, p.z / p.w];
  });
  if (s.some((p) => !p)) return;
  projected.push([s, color, shade]);
  tris++;
};

const meshList = [];
game.scene.updateMatrixWorld(true);
game.scene.traverse((o) => {
  if (!o.isMesh || o.visible === false) return;
  if (o.material && o.material.visible === false) return;
  const mat0 = Array.isArray(o.material) ? o.material[0] : o.material;
  // the sky dome wraps the camera and would paint over everything
  if (mat0 && mat0.side === THREE.BackSide) return;
  if (mat0 && /sky|cloud|dome/i.test(o.name || '')) return;
  if (o.userData?.noPreview) return;
  meshList.push(o);
});

for (const m of meshList) {
  const geo = m.geometry;
  const posAttr = geo.attributes.position;
  if (!posAttr) continue;
  const idx = geo.index;
  const count = idx ? idx.count : posAttr.count;
  // skip ground planes larger than the world: they hide everything behind
  let mat = Array.isArray(m.material) ? m.material[0] : m.material;
  let baseCol = mat.color ? [mat.color.r, mat.color.g, mat.color.b] : [0.7, 0.7, 0.7];
  // flat alpha planes (blob shadows, nets, netting) are not solid surfaces
  if (mat.map && mat.transparent && !mat.color?.getHex) baseCol = [0.5, 0.5, 0.5];
  const opacity = mat.transparent ? (mat.opacity ?? 1) : 1;
  if (opacity < 0.35) continue;
  const instCount = m.isInstancedMesh ? m.count : 1;
  for (let inst = 0; inst < instCount; inst++) {
    if (m.isInstancedMesh) {
      m.getMatrixAt(inst, tmpM);
      tmpM.premultiply(m.matrixWorld);
      if (m.instanceColor) {
        baseCol = [m.instanceColor.getX(inst), m.instanceColor.getY(inst), m.instanceColor.getZ(inst)];
      }
    } else tmpM.copy(m.matrixWorld);
    for (let t = 0; t < count; t += 3) {
      for (let k = 0; k < 3; k++) {
        const i = idx ? idx.getX(t + k) : t + k;
        v.fromBufferAttribute(posAttr, i).applyMatrix4(tmpM);
        triWorld[k][0] = v.x; triWorld[k][1] = v.y; triWorld[k][2] = v.z;
      }
      // face normal for shading
      const a = triWorld[0], b = triWorld[1], c = triWorld[2];
      nrm.set(
        (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
        (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
      );
      const nl = nrm.length() || 1;
      nrm.divideScalar(nl);
      const lam = Math.abs(nrm.dot(sun));
      const shade = 0.42 + 0.72 * lam;
      pushTri(a, b, c, baseCol, shade);
    }
  }
}

const d = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
for (const [s, color, shade] of projected) {
  const area = d(s[0], s[1], s[2]);
  if (Math.abs(area) < 1e-7) continue;
  const minX = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0])));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])));
  const minY = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1])));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])));
  if (minX > maxX || minY > maxY) continue;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p = [x + 0.5, y + 0.5];
      const w0 = d(s[1], s[2], p) / area;
      const w1 = d(s[2], s[0], p) / area;
      const w2 = d(s[0], s[1], p) / area;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const i = y * W + x;
      const z = w0 * s[0][2] + w1 * s[1][2] + w2 * s[2][2];
      if (z >= depth[i]) continue;
      depth[i] = z;
      buf[i * 3] = color[0] * shade * 255;
      buf[i * 3 + 1] = color[1] * shade * 255;
      buf[i * 3 + 2] = color[2] * shade * 255;
    }
  }
}

for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 3;
  if (depth[y * W + x] !== Infinity) continue;
  const t = y / H;
  buf[i] = 172 + 60 * (1 - t); buf[i + 1] = 205 + 40 * (1 - t); buf[i + 2] = 228;
}

const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++)
    raw[y * (W * 3 + 1) + 1 + x * 3 + c] = Math.max(0, Math.min(255, buf[(y * W + x) * 3 + c]));
}
const crcT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const chunk = (type, body) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const tt = Buffer.from(type, 'ascii');
  let crc = -1; for (const bb of Buffer.concat([tt, body])) crc = crcT[(crc ^ bb) & 255] ^ (crc >>> 8);
  const cc = Buffer.alloc(4); cc.writeUInt32BE((crc ^ -1) >>> 0);
  return Buffer.concat([len, tt, body, cc]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(out, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]));
console.log(`${sport}: ${meshList.length} meshes, ${tris} triangles -> ${out}`);
process.exit(0);
