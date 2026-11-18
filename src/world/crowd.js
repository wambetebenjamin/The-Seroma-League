/**
 * A real 3D crowd for the grandstands, in the style of the promo renders:
 * thousands of individual spectators sitting in rows, each with its own
 * shirt colour, skin tone and pose, all drawn with a handful of InstancedMesh
 * objects so the cost stays flat on phones.
 *
 * Two things are animated, both cheaply and smoothly:
 *  - a slow idle sway (everyone breathes/shifts on their own phase)
 *  - a goal celebration: arms up, bouncing, then settling back down
 *
 * Nothing here is driven by `sin(t * changingRate)`, which would vibrate.
 * Phase is integrated per spectator, exactly like the players.
 */
import * as THREE from 'three';
import { rand } from '../core/engine.js';
import { PALETTE } from '../core/style.js';

const SKIN = [0x8d5a33, 0x74472a, 0x5e3920, 0xa1734a, 0x4a2c18, 0x95603a];

const SHIRT_POOL = [
  '#e9e6df', '#20242b', '#2f6df6', '#f2b134', '#d81b60', '#0f8b6c',
  '#c0392b', '#f4f1e6', '#3b4a6b', '#e4572e', '#7d9c3a', '#8e5ac8',
];

/**
 * Build a grandstand crowd.
 *
 * @param {THREE.Scene} scene
 * @param {object} opts
 *  - x, z: centre of the stand
 *  - length: how wide the stand is
 *  - rows: how many tiers
 *  - perRow: spectators per tier
 *  - rotY: facing
 *  - colors: [primary, secondary] club colours that dominate the crowd
 */
export function addCrowd(scene, {
  x = 0,
  z = -30,
  length = 44,
  rows = 5,
  perRow = null,
  rotY = 0,
  colors = ['#c0392b', '#f2f2f2'],
  rowRise = 0.8,
  rowRun = 1.3,
  seatY = 0.8,
  density = 0.88,
  scale = 1,
} = {}) {
  const group = new THREE.Group();
  const count0 = perRow || Math.round(length / 0.62);
  const total = rows * count0;

  // which spectators actually exist (some seats empty)
  const seats = [];
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < count0; i++) {
      if (Math.random() > density) continue;
      seats.push({ r, i, col: i / count0 });
    }
  }
  const n = seats.length;

  /* ------------------------------ geometries ------------------------------ */
  const torsoGeo = new THREE.CapsuleGeometry(0.2, 0.36, 3, 8);
  const headGeo = new THREE.SphereGeometry(0.145, 10, 8);
  const armGeo = new THREE.CapsuleGeometry(0.052, 0.26, 2, 6);
  // shift each limb so its pivot is at the shoulder / hip, not its middle:
  // otherwise rotating it just spins the limb in mid-air
  armGeo.translate(0, -0.19, 0);
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.3, 2, 6);
  legGeo.translate(0, -0.2, 0);

  const torso = new THREE.InstancedMesh(
    torsoGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.86, vertexColors: false }),
    n
  );
  const head = new THREE.InstancedMesh(
    headGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    n
  );
  const armL = new THREE.InstancedMesh(armGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
  const armR = new THREE.InstancedMesh(armGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
  const legs = new THREE.InstancedMesh(legGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);

  for (const m of [torso, head, armL, armR, legs]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    group.add(m);
  }
  // arms and heads need their own colours
  head.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  armL.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  armR.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  legs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

  const shirtColor = new THREE.Color();
  const skinColor = new THREE.Color();
  const darkColor = new THREE.Color(0x2b2f36);

  const people = seats.map((s, k) => {
    // club colours dominate, with clashing neutrals mixed in
    const useClub = Math.random() < 0.62;
    const hex = useClub
      ? colors[Math.random() < 0.5 ? 0 : 1]
      : SHIRT_POOL[Math.floor(Math.random() * SHIRT_POOL.length)];
    shirtColor.set(hex);
    torso.setColorAt(k, shirtColor);

    skinColor.set(SKIN[Math.floor(Math.random() * SKIN.length)]);
    head.setColorAt(k, skinColor);
    armL.setColorAt(k, skinColor);
    armR.setColorAt(k, skinColor);
    legs.setColorAt(k, Math.random() < 0.5 ? darkColor : shirtColor.clone().multiplyScalar(0.6));

    return {
      basis: new THREE.Matrix4(),
      phase: rand(0, Math.PI * 2),
      speed: rand(0.7, 1.35),
      // arm raise, 0 = lap, 1 = fully up
      raise: 0,
      targetRaise: 0,
      bob: 0,
      lean: rand(-0.06, 0.06),
      scale: scale * rand(0.92, 1.06),
      height: 0,
    };
  });

  // lay the seats out: an arc-ish stand facing the pitch
  const spacing = length / count0;
  seats.forEach((s, k) => {
    const p = people[k];
    const px = (s.i - (count0 - 1) / 2) * spacing;
    const pz = -s.r * rowRun;
    const py = seatY + s.r * rowRise;
    // a touch of shoulder-to-shoulder offset so rows are not a perfect grid
    const jx = rand(-0.05, 0.05);
    p.home = new THREE.Vector3(px + jx, py + rand(-0.04, 0.04), pz + rand(-0.05, 0.05));
    p.basis.makeRotationY(p.lean * 1.4 + rand(-0.4, 0.4));
    p.basis.setPosition(p.home.x, p.home.y, p.home.z);
  });

  const tmp = new THREE.Matrix4();
  const limb = new THREE.Matrix4();
  const pose = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);

  /** Write every instance matrix for the current pose. */
  function apply() {
    for (let k = 0; k < n; k++) {
      const p = people[k];
      const s = p.scale;
      const bob = p.bob;
      const raise = p.raise;

      // torso
      pose.makeTranslation(0, 0.18 + bob, 0);
      tmp.multiplyMatrices(p.basis, pose);
      tmp.scale(one.set(s, s, s));
      torso.setMatrixAt(k, tmp);

      // head
      pose.makeTranslation(0, 0.62 + bob, 0);
      tmp.multiplyMatrices(p.basis, pose);
      tmp.scale(one.set(s * 1.02, s * 1.02, s * 1.02));
      head.setMatrixAt(k, tmp);

      // arms: hang beside the body at rest, punch up when celebrating
      const armAngle = 0.18 - raise * 2.9;
      for (const [mesh, sideSign] of [[armL, 1], [armR, -1]]) {
        euler.set(armAngle, 0, sideSign * (0.12 + raise * 0.16));
        quat.setFromEuler(euler);
        pose.compose(pos.set(sideSign * 0.23, 0.46 + bob, 0.02), quat, one.set(s, s, s));
        tmp.multiplyMatrices(p.basis, pose);
        mesh.setMatrixAt(k, tmp);
      }

      // legs: sitting, angled forward over the seat in front
      euler.set(-1.05, 0, 0);
      quat.setFromEuler(euler);
      pose.compose(pos.set(0, -0.06 + bob, 0.02), quat, one.set(s, s, s));
      tmp.multiplyMatrices(p.basis, pose);
      legs.setMatrixAt(k, tmp);

      void limb;
    }
    torso.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    armL.instanceMatrix.needsUpdate = true;
    armR.instanceMatrix.needsUpdate = true;
    legs.instanceMatrix.needsUpdate = true;
    if (head.instanceColor) head.instanceColor.needsUpdate = true;
  }

  const api = {
    group,
    count: n,
    /** 0..1 celebration intensity */
    setExcitement(level) {
      const v = Math.max(0, Math.min(1, level));
      for (const p of people) p.targetRaise = v * (0.65 + Math.random() * 0.35);
    },
    celebrate(seconds = 3) {
      api.setExcitement(1);
      api._calmAt = seconds;
      for (const p of people) p.targetRaise = 0.75 + Math.random() * 0.25;
    },
    update(dt, t) {
      api._idle = (api._idle || 0);
      if (api._calmAt !== undefined) {
        api._calmAt -= dt;
        if (api._calmAt <= 0) {
          api._calmAt = undefined;
          api.setExcitement(0);
        }
      }
      const k1 = Math.min(1, dt * 6);
      // cheap early-out: a settled crowd with no raise still sways, so keep a
      // slow refresh instead of re-posing every single frame
      let raised = 0;
      for (const p of people) if (p.raise > 0.01 || Math.abs(p.targetRaise) > 0.01) raised++;
      for (const p of people) {
        // integrate a gentle sway; never a `sin(t * rate)` with a changing rate
        p.phase += dt * p.speed * 1.7;
        p.raise += (p.targetRaise - p.raise) * k1;
        // bouncing only when excited, smooth and phase-driven
        const excite = p.raise;
        p.bob = Math.abs(Math.sin(p.phase)) * (0.012 + excite * 0.075);
      }
      // full re-pose while excited; a lazy 12fps sway when calm
      api._idle = raised > 0 ? 0 : api._idle + dt;
      if (raised > 0 || api._idle > 0.083) {
        api._idle = 0;
        apply();
      }
      void t;
    },
    dispose() {
      group.removeFromParent();
      for (const m of [torso, head, armL, armR, legs]) m.dispose();
    },
  };

  apply();
  scene.add(group);
  return api;
}
