/**
 * Render the grandstand crowd to a PNG by reading its instance matrices.
 * Uses a tiny software rasteriser (no GPU in the sandbox).
 */
import * as THREE from 'three';
import zlib from 'node:zlib';
import fs from 'node:fs';
import { addCrowd } from '../src/world/crowd.js';

const scene = new THREE.Scene();
const crowd = addCrowd(scene, { rows: 5, length: 30, colors: ['#d9452b', '#f7f3e8'] });
// calm crowd: just sitting and breathing
crowd.setExcitement(0);
for (let i = 0; i < 120; i++) crowd.update(1 / 60, i / 60);

const W = 1000, H = 420;
const buf = new Float32Array(W * H * 3).fill(0);
const depth = new Float32Array(W * H).fill(Infinity);
const lift = (arr) => { for (let i = 0; i < arr.length; i += 3) { buf[i] *= 1; } };

// gather instances into triangles
const meshes = [];
scene.traverse((o) => { if (o.isInstancedMesh) meshes.push(o); });

const cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 200);
cam.position.set(0, 5.5, 16);
cam.lookAt(0, 3.0, -3);
cam.updateMatrixWorld();
const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);

const world = new THREE.Matrix4();
const v = new THREE.Vector3();
let tris = 0;
for (const m of meshes) {
  const geo = m.geometry;
  const posAttr = geo.attributes.position;
  const idx = geo.index;
  const col = m.instanceColor;
  for (let inst = 0; inst < m.count; inst++) {
    m.getMatrixAt(inst, world);
    const wx = m.matrixWorld.clone().multiply(world);
    let cr = 0.7, cg = 0.7, cb = 0.7;
    if (col) { cr = col.getX(inst); cg = col.getY(inst); cb = col.getZ(inst); }
    const tri = idx ? idx.count / 3 : posAttr.count / 3;
    for (let t = 0; t < tri; t++) {
      const pts = [];
      for (let k = 0; k < 3; k++) {
        const i = idx ? idx.getX(t * 3 + k) : t * 3 + k;
        v.fromBufferAttribute(posAttr, i).applyMatrix4(wx);
        pts.push([v.x, v.y, v.z]);
      }
      drawTri(pts, [cr, cg, cb], 0.55 + 0.45 * Math.max(0, pts[0][1] / 6));
      tris++;
    }
  }
}

function drawTri(P, color, shade) {
  const s = P.map(([x, y, z]) => {
    const p = new THREE.Vector4(x, y, z, 1).applyMatrix4(vp);
    return [((p.x / p.w) * 0.5 + 0.5) * W, (1 - ((p.y / p.w) * 0.5 + 0.5)) * H, p.z / p.w];
  });
  const minX = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0])));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])));
  const minY = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1])));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])));
  if (minX > maxX || minY > maxY) return;
  const d = (a, b, c) => (a[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (a[1] - c[1]);
  const area = d(s[0], s[1], s[2]);
  if (Math.abs(area) < 1e-6) return;
  const zAvg = (s[0][2] + s[1][2] + s[2][2]) / 3;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p = [x + 0.5, y + 0.5];
      const w0 = d(s[1], s[2], p) / area;
      const w1 = d(s[2], s[0], p) / area;
      const w2 = d(s[0], s[1], p) / area;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const i = y * W + x;
      if (zAvg >= depth[i]) continue;
      depth[i] = zAvg;
      buf[i * 3] = color[0] * shade * 255;
      buf[i * 3 + 1] = color[1] * shade * 255;
      buf[i * 3 + 2] = color[2] * shade * 255;
    }
  }
}

// background
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 3;
  if (depth[y * W + x] !== Infinity) continue;
  const t = y / H;
  buf[i] = 150 + 80 * (1 - t); buf[i + 1] = 190 + 50 * (1 - t); buf[i + 2] = 225;
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
  const t = Buffer.from(type, 'ascii');
  let crc = -1; for (const b of Buffer.concat([t, body])) crc = crcT[(crc ^ b) & 255] ^ (crc >>> 8);
  const c = Buffer.alloc(4); c.writeUInt32BE((crc ^ -1) >>> 0);
  return Buffer.concat([len, t, body, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync('tools/crowd-calm.png', Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]));
console.log('crowd instances:', crowd.count, 'triangles:', tris, '-> tools/crowd.png');
