/**
 * Proves the crowd and the players move smoothly rather than vibrating.
 * Compares consecutive frames: a well-behaved animation changes by a small,
 * consistent amount each frame. The old `sin(t * cadence)` bug produced huge
 * frame-to-frame jumps whenever speed changed.
 */
import * as THREE from 'three';

// minimal canvas stub so texture helpers work headless
globalThis.document = {
  createElement: () => {
    const ctx = {
      createRadialGradient: () => ({ addColorStop() {} }),
      createLinearGradient: () => ({ addColorStop() {} }),
      fillRect() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {},
      quadraticCurveTo() {}, bezierCurveTo() {}, stroke() {}, fillText() {}, strokeRect() {},
      roundRect() {}, save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
      clearRect() {}, set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {},
      set font(v) {}, set textAlign(v) {}, set textBaseline(v) {}, getImageData: () => ({ data: [] }),
      putImageData() {}, drawImage() {},
    };
    return { width: 128, height: 128, getContext: () => ctx };
  },
};

import { addCrowd } from '../src/world/crowd.js';
import { Avatar } from '../src/world/players.js';

const scene = new THREE.Scene();
const crowd = addCrowd(scene, { rows: 4, length: 20 });
crowd.setExcitement(1);

const snap = (mesh, k) => {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(k, m);
  return new Float32Array(m.elements);
};
const torso = [];
scene.traverse((o) => { if (o.isInstancedMesh && o.geometry.type === 'CapsuleGeometry') torso.push(o); });
const body = torso[0];

const frames = [];
for (let f = 0; f < 30; f++) {
  crowd.update(1 / 60, f / 60);
  frames.push(snap(body, 3));
}
let maxJump = 0;
let total = 0;
for (let f = 1; f < frames.length; f++) {
  let d = 0;
  for (let i = 0; i < 16; i++) d += Math.abs(frames[f][i] - frames[f - 1][i]);
  maxJump = Math.max(maxJump, d);
  total += d;
}
const avg = total / (frames.length - 1);
console.log('crowd: avg per-frame change', avg.toFixed(5), 'max', maxJump.toFixed(5));
console.log('crowd motion is smooth (no snap):', maxJump < avg * 3 + 0.01, 'ratio', (maxJump / (avg || 1)).toFixed(2));

/* ---- players: sweep the speed like the AI does, then check for snapping ---- */
const team = { id: 'gaucho', name: 'FC Gaucho', colors: { primary: '#d9452b', secondary: '#f7f3e8', shorts: '#1b1b1f' } };
const a = new Avatar({ team, name: 'Deng Martin', sport: 'football' });
const angles = [];
let t = 0;
for (let f = 0; f < 240; f++) {
  // speed jitters every frame, exactly the situation that used to vibrate
  const speed = 1.2 + Math.sin(f * 0.7) * 1.1 + Math.random() * 0.4;
  t += 1 / 60;
  a.animate(t, speed, 1 / 60);
  angles.push(a.legs[0].rotation.x);
}
let maxStep = 0;
let sumStep = 0;
for (let i = 1; i < angles.length; i++) {
  const d = Math.abs(angles[i] - angles[i - 1]);
  maxStep = Math.max(maxStep, d);
  sumStep += d;
}
const meanStep = sumStep / (angles.length - 1);
console.log('player: mean leg step', meanStep.toFixed(4), 'max', maxStep.toFixed(4));
const smooth = maxStep < meanStep * 4 + 0.02;
console.log('player stride is smooth under jittery speed:', smooth, 'ratio', (maxStep / (meanStep || 1)).toFixed(2));
if (!smooth || maxJump >= avg * 3 + 0.02) process.exit(1);
