/**
 * Seroma campus props: Wisdom Hall, terracotta classroom blocks, stone terraces,
 * palms and eucalyptus trees, perimeter wall and a crowd-lined grandstand.
 * Everything is generated, so the whole game ships in a couple of MB.
 */
import * as THREE from 'three';
import { roofTexture, bannerTexture, dirtTexture } from '../core/textures.js';
import { rand, pick } from '../core/engine.js';
import { SCHOOL } from '../data/seroma.js';
import { PALETTE, stdMat, glossyMat, addContactShadow, addHedge } from '../core/style.js';
import { addCrowd } from './crowd.js';
import { IS_TOUCH } from '../core/engine.js';

const MAT = {};
function mat(key, make) {
  if (!MAT[key]) MAT[key] = make();
  return MAT[key];
}

export function terracottaWall() {
  return mat('terracotta', () => stdMat(PALETTE.terracotta, { roughness: 0.78 }));
}
export function creamWall() {
  return mat('cream', () => stdMat(PALETTE.cream, { roughness: 0.82 }));
}
export function greenRoof() {
  // smooth painted metal sheeting, the way the renders show the roofs
  return mat('roof', () =>
    stdMat(PALETTE.roofGreen, { roughness: 0.42, metalness: 0.16, map: roofTexture([8, 2]) })
  );
}
export function concrete() {
  return mat('concrete', () => stdMat(PALETTE.concrete, { roughness: 0.86 }));
}
export function darkGlass() {
  return mat('glass', () => glossyMat(PALETTE.glass, { roughness: 0.14, metalness: 0.62 }));
}

let treeGeoCache = null;
function treeGeometries() {
  if (treeGeoCache) return treeGeoCache;
  treeGeoCache = {
    trunk: new THREE.CylinderGeometry(0.28, 0.42, 7, 6),
    palmTrunk: new THREE.CylinderGeometry(0.2, 0.34, 9, 6),
    canopy: new THREE.IcosahedronGeometry(2.6, 1),
    palmLeaf: new THREE.ConeGeometry(1.5, 4.2, 4, 1, true),
  };
  return treeGeoCache;
}

const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5334, roughness: 0.9 });
// rounded, bright canopies like the promo renders: smooth shading, no flat facets
const leafMats = [
  new THREE.MeshStandardMaterial({ color: 0x4b9c3c, roughness: 0.84 }),
  new THREE.MeshStandardMaterial({ color: 0x5cad44, roughness: 0.84 }),
  new THREE.MeshStandardMaterial({ color: 0x3d8834, roughness: 0.84 }),
];

export function addEucalyptus(scene, x, z, scale = 1) {
  const g = treeGeometries();
  const grp = new THREE.Group();
  const trunk = new THREE.Mesh(g.trunk, trunkMat);
  trunk.position.y = 3.4;
  grp.add(trunk);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(g.canopy, pick(leafMats));
    c.position.set(rand(-1.4, 1.4), 7 + rand(-0.6, 1.2), rand(-1.4, 1.4));
    c.scale.setScalar(rand(0.8, 1.35));
    grp.add(c);
  }
  grp.position.set(x, 0, z);
  grp.scale.setScalar(scale);
  addContactShadow(grp, 2.1 * scale, 0.5).position.y = 0.03;
  scene.add(grp);
  return grp;
}

export function addPalm(scene, x, z, scale = 1) {
  const g = treeGeometries();
  const grp = new THREE.Group();
  const trunk = new THREE.Mesh(g.palmTrunk, trunkMat);
  trunk.position.y = 4.4;
  grp.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(g.palmLeaf, leafMats[1]);
    leaf.position.y = 8.8;
    leaf.rotation.z = Math.PI / 2.4;
    leaf.rotation.y = (i / 6) * Math.PI * 2;
    leaf.position.x = Math.cos((i / 6) * Math.PI * 2) * 1.5;
    leaf.position.z = Math.sin((i / 6) * Math.PI * 2) * 1.5;
    leaf.rotation.x = 0.2;
    grp.add(leaf);
  }
  grp.position.set(x, 0, z);
  grp.scale.setScalar(scale);
  scene.add(grp);
  return grp;
}

/** Terracotta classroom block with a green roof, like the blocks around Wisdom Hall. */
export function addClassroomBlock(scene, x, z, { w = 26, d = 9, h = 6.5, rot = 0, wall = 'terra' } = {}) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall === 'cream' ? creamWall() : terracottaWall());
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  grp.add(body);

  // hipped roof: a four-sided cone with softened normals and a ridge cap
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, 2.9, 4), greenRoof());
  roof.position.y = h + 1.3;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w / Math.hypot(w, d), 1, d / Math.hypot(w, d));
  roof.castShadow = true;
  grp.add(roof);
  const eave = new THREE.Mesh(
    new THREE.BoxGeometry(w + 1.1, 0.26, d + 1.1),
    stdMat(PALETTE.roofGreenDeep, { roughness: 0.5, metalness: 0.12 })
  );
  eave.position.y = h + 0.05;
  grp.add(eave);

  // veranda / window band
  const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, h * 0.34, 0.2), darkGlass());
  band.position.set(0, h * 0.58, d / 2 + 0.06);
  grp.add(band);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.96, h * 0.4, 0.12),
    stdMat(0xf2efe6, { roughness: 0.7 })
  );
  frame.position.set(0, h * 0.58, d / 2 + 0.002);
  grp.add(frame);
  // window mullions so the glazing reads as panes, not a black slab
  const mullionMat = stdMat(0xeeeae0, { roughness: 0.7 });
  const panes = Math.max(3, Math.round(w / 3.2));
  for (let i = 1; i < panes; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.34, 0.1), mullionMat);
    m.position.set(-w / 2 + 0.5 + (i * (w - 1)) / panes, h * 0.58, d / 2 + 0.14);
    grp.add(m);
  }
  const columns = Math.max(3, Math.round(w / 2.6));
  const colMat = concrete();
  for (let i = 0; i < columns; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, h * 0.9, 6), colMat);
    col.position.set(-w / 2 + 1 + (i * (w - 2)) / (columns - 1), h * 0.45, d / 2 + 1.15);
    grp.add(col);
  }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.22, 2.4), concrete());
  slab.position.set(0, h * 0.9, d / 2 + 1.1);
  grp.add(slab);

  grp.position.set(x, 0, z);
  grp.rotation.y = rot;
  addContactShadow(grp, Math.max(w, d) * 0.62, 0.55);
  scene.add(grp);
  return grp;
}

/** Stone-and-concrete terrace steps (the new Seroma terraces). */
export function addTerraces(scene, x, z, { steps = 6, width = 34, rot = 0, rise = 0.75, run = 1.5 } = {}) {
  const grp = new THREE.Group();
  const stoneMat = concrete();
  for (let i = 0; i < steps; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(width, rise, run), stoneMat);
    s.position.set(0, rise / 2 + i * rise, -i * run);
    s.receiveShadow = true;
    s.castShadow = true;
    grp.add(s);
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.12, run * 0.92),
      stdMat('#e0a877', { roughness: 0.82 })
    );
    lip.position.set(0, rise * (i + 1) - 0.05, -i * run);
    grp.add(lip);
  }
  grp.position.set(x, 0, z);
  grp.rotation.y = rot;
  scene.add(grp);
  return grp;
}

/**
 * Grandstand with a real 3D crowd.
 * Returns { group, crowd } so the game can make the crowd celebrate.
 */
export function addGrandstand(scene, x, z, rot = 0, length = 46, colors = ['#c0392b', '#f2f2f2'], opts = {}) {
  const grp = new THREE.Group();

  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.8, 1.3),
      stdMat(PALETTE.concrete, { roughness: 0.85 })
    );
    step.position.set(0, 0.4 + i * 0.8, -i * 1.3);
    step.receiveShadow = true;
    grp.add(step);
  }
  // spectators: instanced 3D people sitting on the steps
  const crowd = addCrowd(grp, {
    x: 0,
    z: 0.15,
    length: length * 0.96,
    rows: opts.rows || 5,
    rotY: 0,
    colors,
    rowRise: 0.8,
    rowRun: 1.12,
    seatY: 1.05,
    // phones get a thinner crowd so the frames stay high
    density: (opts.density || 0.86) * (IS_TOUCH ? 0.62 : 1),
  });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(length + 3, 0.25, 9), greenRoof());
  roof.position.set(0, 8.2, -3.2);
  roof.rotation.x = -0.12;
  grp.add(roof);
  const posts = [-length / 2 + 1, 0, length / 2 - 1];
  posts.forEach((px) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 8, 6), concrete());
    p.position.set(px, 4, -7.4);
    grp.add(p);
  });
  // back wall banner
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 3.2),
    new THREE.MeshStandardMaterial({ map: bannerTexture('SEROMA LEAGUE', '#0f5132', '#ffffff', 'HEADS BUT NOT TAILS'), roughness: 0.9 })
  );
  banner.position.set(0, 3.2, 1.1);
  banner.rotation.x = -0.42;
  grp.add(banner);

  grp.position.set(x, 0, z);
  grp.rotation.y = rot;
  scene.add(grp);
  grp.userData.crowd = crowd;
  return grp;
}

/** Low perimeter wall with pillars, marking the edge of the school grounds. */
export function addPerimeterWall(scene, cx, cz, radius = 90) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc9bfa8, roughness: 1 });
  const segs = 36;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) < 0.18) continue; // leave gates open on two sides
    const w = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.176, 1.5, 0.4), mat);
    w.position.set(cx + Math.cos(a) * radius, 0.75, cz + Math.sin(a) * radius);
    w.rotation.y = -a + Math.PI / 2;
    scene.add(w);
    if (i % 3 === 0) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.3, 0.8), mat);
      p.position.set(cx + Math.cos(a) * radius, 1.15, cz + Math.sin(a) * radius);
      p.rotation.y = -a;
      scene.add(p);
    }
  }
}

/** Rows of eucalyptus + palms around a playing area. */
export function addTreeLine(scene, cx, cz, radius, count = 26) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand(-0.08, 0.08);
    const r = radius + rand(-4, 7);
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (Math.random() < 0.65) addEucalyptus(scene, x, z, rand(0.9, 1.4));
    else addPalm(scene, x, z, rand(0.8, 1.15));
  }
}

/** Red-earth track strip around a pitch. */
export function addDirtRing(scene, w, d, y = 0.02) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 1, 4),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  ring.visible = false;
  scene.add(ring);
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 14, d + 14),
    new THREE.MeshStandardMaterial({ map: dirtTexture([8, 6]), roughness: 1 })
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = y - 0.01;
  strip.receiveShadow = true;
  scene.add(strip);
  return strip;
}

export function addBanner(scene, x, y, z, rotY, text, sub, bg = '#0f5132') {
  const b = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 3),
    new THREE.MeshStandardMaterial({ map: bannerTexture(text, bg, '#ffffff', sub || ''), roughness: 0.85 })
  );
  b.position.set(x, y, z);
  b.rotation.y = rotY;
  scene.add(b);
  return b;
}

export function addFloodlight(scene, x, z) {
  const grp = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, 20, 8),
    glossyMat(0xb9bfc6, { roughness: 0.4, metalness: 0.5 })
  );
  pole.position.y = 10;
  grp.add(pole);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.1, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff0b0, emissiveIntensity: 1.4 })
  );
  head.position.y = 20.2;
  grp.add(head);
  grp.position.set(x, 0, z);
  scene.add(grp);
  return grp;
}

/** Painted "SEROMA" wall sign like the entrance arch. */
export function addSchoolSign(scene, x, z, rotY = 0) {
  const grp = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.9 });
  [-4.4, 4.4].forEach((px) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), postMat);
    p.position.set(px, 2.5, 0);
    grp.add(p);
  });
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2.3, 0.3),
    new THREE.MeshStandardMaterial({ map: bannerTexture(SCHOOL.short, '#0f5132', '#f6e7c1', 'CHRISTIAN HIGH SCHOOL · MUKONO'), roughness: 0.8 })
  );
  board.position.y = 4.4;
  grp.add(board);
  grp.position.set(x, 0, z);
  grp.rotation.y = rotY;
  scene.add(grp);
  return grp;
}
