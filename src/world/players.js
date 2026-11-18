/**
 * Stylized 3D athletes, built to match the renders used across the site:
 * rounded heads with real faces (eyes, brows, nose, smile), distinct hair
 * (afro, crop, braids, bun, cap), two-segment limbs, kit with a number,
 * socks and boots, and a soft contact shadow so everybody sits on the grass.
 *
 * Everything is generated from primitives and cached, so a full squad of ten
 * still costs almost nothing to draw.
 */
import * as THREE from 'three';
import { initials } from '../data/seroma.js';
import { addContactShadow } from '../core/style.js';
import { jerseyTexture } from '../core/textures.js';

const SKIN = [0x8a5a34, 0x6f4426, 0x9c6a3f, 0x5c3720, 0x7d5030, 0xa8734a];
const HAIR = [0x171210, 0x1f1712, 0x2a1d15, 0x120e0c];
const HAIR_STYLES = ['afro', 'crop', 'braids', 'bun', 'cap'];

const geoCache = {};
function g(key, make) {
  if (!geoCache[key]) geoCache[key] = make();
  return geoCache[key];
}

/** Deterministic 0..1 from a name, so each player keeps their own look. */
function hash01(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Two players in the same kit on the same pitch read as clones, so a second
 * team sharing a colour gets a clearly different alternate kit instead.
 */
const LIGHT_ALT = [
  { primary: '#f4f1e6', secondary: '#1f2a33', shorts: '#1f2a33' },
  { primary: '#ffd166', secondary: '#20303a', shorts: '#20303a' },
  { primary: '#9fd8ff', secondary: '#15202a', shorts: '#15202a' },
  { primary: '#ffe9c9', secondary: '#7a2e1d', shorts: '#7a2e1d' },
];
const DARK_ALT = [
  { primary: '#22303c', secondary: '#f2efe4', shorts: '#f2efe4' },
  { primary: '#3b2540', secondary: '#f6d98a', shorts: '#f6d98a' },
  { primary: '#14303a', secondary: '#ffd166', shorts: '#ffd166' },
  { primary: '#2d1f18', secondary: '#ffe0b8', shorts: '#ffe0b8' },
];

function colourValue(hex) {
  const h = String(hex || '#888888').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16) || 0;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Deterministic alternate strip that still reads as "that club". */
export function alternateKit(team, seed = 0) {
  const base = team?.colors?.primary || '#2f6b45';
  const light = colourValue(base) < 0.22;
  const pool = light ? LIGHT_ALT : DARK_ALT;
  const pick = pool[Math.floor(hash01(team?.id || 'seroma', seed) * pool.length) % pool.length];
  return { ...pick, alternate: true, base };
}

export class Avatar {
  constructor({ team, name, number = 7, sport = 'football', isKeeper = false, alt = null }) {
    this.team = team;
    this.name = name || team.name;
    this.number = number;
    this.sport = sport;
    this.isKeeper = isKeeper;
    this.alt = alt;
    // the kit we are actually wearing: the change strip if the colours clash,
    // and keeper green between the posts
    this.kitColors = isKeeper
      ? { primary: '#25a35c', secondary: '#f7f7f2', shorts: '#1a1a1a', keeper: true }
      : alt || team.colors;
    this.group = new THREE.Group();
    this.group.userData.avatar = this;
    this.speed = 0;
    this._build();
  }

  _build() {
    const kit = this.kitColors;
    const shirt = new THREE.MeshStandardMaterial({
      color: new THREE.Color(kit.primary),
      roughness: 0.86,
    });
    const trim = new THREE.MeshStandardMaterial({
      color: new THREE.Color(kit.secondary),
      roughness: 0.82,
    });
    const shorts = new THREE.MeshStandardMaterial({
      color: new THREE.Color(kit.shorts),
      roughness: 0.88,
    });
    const skinTone = SKIN[Math.floor(hash01(this.name, 1) * SKIN.length)];
    const skin = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.72 });
    const sock = new THREE.MeshStandardMaterial({
      color: new THREE.Color(kit.secondary),
      roughness: 0.88,
    });
    const boot = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.55, metalness: 0.18 });
    const hairMat = new THREE.MeshStandardMaterial({
      color: HAIR[Math.floor(hash01(this.name, 7) * HAIR.length)],
      roughness: 0.95,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.6 });
    const white = new THREE.MeshStandardMaterial({ color: 0xfbf7ef, roughness: 0.5 });

    const T = this.sport === 'basketball';
    const S = this.sport === 'swimming';
    const L = new THREE.Group(); // limb/torso container so bob does not drift
    this.body = L; // set early: hair and kit helpers add to it

    /* ------------------------------- torso ------------------------------- */
    const torsoGeo = T
      ? g('torsoB', () => new THREE.CylinderGeometry(0.24, 0.205, 0.66, 14))
      : g('torsoF', () => new THREE.CylinderGeometry(0.235, 0.2, 0.62, 14));
    this.torso = new THREE.Mesh(torsoGeo, S ? skin : shirt);
    this.torso.position.y = 1.24;
    L.add(this.torso);

    // rounded shoulders soften the silhouette
    const shoulderGeo = g('shoulder', () => new THREE.SphereGeometry(0.105, 10, 8));
    [-1, 1].forEach((s) => {
      const sh = new THREE.Mesh(shoulderGeo, S ? skin : shirt);
      sh.position.set(s * 0.205, 1.48, 0);
      L.add(sh);
    });

    // collar
    const collar = new THREE.Mesh(
      g('collar', () => new THREE.TorusGeometry(0.11, 0.026, 6, 16, Math.PI * 2)),
      trim
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.55;
    L.add(collar);

    if (!S) {
      // the player's shirt number, on the back of the kit
      const numTex = jerseyTexture(kit.primary, kit.secondary, this.number || 7);
      const num = new THREE.Mesh(
        g('num', () => new THREE.PlaneGeometry(0.3, 0.26)),
        new THREE.MeshStandardMaterial({ map: numTex, roughness: 0.86 })
      );
      num.position.set(0, 1.3, 0.235);
      L.add(num);
      // side stripe on the shorts
      const stripe = new THREE.Mesh(g('stripeGeo', () => new THREE.BoxGeometry(0.06, 0.2, 0.02)), trim);
      [-1, 1].forEach((s) => {
        const st = stripe.clone();
        st.position.set(s * 0.17, 0.84, 0.1);
        L.add(st);
      });
    } else {
      // competition jammer waistband
      const band = new THREE.Mesh(
        g('band', () => new THREE.CylinderGeometry(0.2, 0.2, 0.09, 14)),
        new THREE.MeshStandardMaterial({ color: 0x1b2733, roughness: 0.6 })
      );
      band.position.y = 0.9;
      L.add(band);
    }

    // shorts
    if (!S) {
      const sh = new THREE.Mesh(g('shorts', () => new THREE.CylinderGeometry(0.225, 0.215, 0.3, 14)), shorts);
      sh.position.y = 0.88;
      L.add(sh);
    }

    /* -------------------------------- head ------------------------------- */
    const neck = new THREE.Mesh(g('neck', () => new THREE.CylinderGeometry(0.075, 0.088, 0.13, 10)), skin);
    neck.position.y = 1.6;
    L.add(neck);

    const headScale = 1 + hash01(this.name, 3) * 0.14;
    this.head = new THREE.Mesh(g('head', () => new THREE.SphereGeometry(0.168, 18, 16)), skin);
    this.head.position.y = 1.76;
    this.head.scale.set(0.96, 1.1 * headScale, 0.98);
    L.add(this.head);

    // ears
    const earGeo = g('ear', () => new THREE.SphereGeometry(0.036, 8, 6));
    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(earGeo, skin);
      ear.position.set(s * 0.16, 1.755, 0.005);
      ear.scale.set(0.5, 1, 0.8);
      L.add(ear);
    });

    // eyes: whites, dark irises, a glint, and eyebrows
    const eyeWhite = g('eyeW', () => new THREE.SphereGeometry(0.031, 10, 8));
    const irisGeo = g('iris', () => new THREE.SphereGeometry(0.017, 8, 6));
    const browGeo = g('brow', () => new THREE.BoxGeometry(0.058, 0.013, 0.018));
    [-1, 1].forEach((s) => {
      const w = new THREE.Mesh(eyeWhite, white);
      w.position.set(s * 0.062, 1.775, 0.15);
      w.scale.set(1, 0.86, 0.55);
      L.add(w);
      const iris = new THREE.Mesh(irisGeo, dark);
      iris.position.set(s * 0.062, 1.773, 0.172);
      iris.scale.set(1, 1, 0.5);
      L.add(iris);
      const brow = new THREE.Mesh(browGeo, hairMat);
      brow.position.set(s * 0.062, 1.816, 0.152);
      brow.rotation.z = s * 0.12;
      L.add(brow);
    });

    // nose and a smiling mouth
    const nose = new THREE.Mesh(g('nose', () => new THREE.SphereGeometry(0.028, 8, 6)), skin);
    nose.position.set(0, 1.745, 0.172);
    nose.scale.set(0.9, 0.8, 0.9);
    L.add(nose);

    const smile = new THREE.Mesh(
      g('smile', () => new THREE.TorusGeometry(0.045, 0.011, 6, 14, Math.PI * 0.9)),
      dark
    );
    smile.position.set(0, 1.7, 0.155);
    smile.rotation.x = Math.PI * 0.5;
    smile.rotation.z = Math.PI * 0.05;
    L.add(smile);

    /* -------------------------------- hair ------------------------------- */
    const style = this._hairStyle();
    this._addHair(style, hairMat, trim);

    /* -------------------------------- limbs ------------------------------ */
    const thighLen = 0.30;
    const shinLen = 0.28;
    const thighGeo = g('thigh' + thighLen, () => new THREE.CapsuleGeometry(0.093, thighLen, 3, 10));
    const shinGeo = g('shin' + shinLen, () => new THREE.CapsuleGeometry(0.072, shinLen, 3, 10));
    const sockGeo = g('sock', () => new THREE.CylinderGeometry(0.078, 0.07, 0.18, 10));
    const bootGeo = g('boot', () => new THREE.BoxGeometry(0.13, 0.075, 0.26));
    const toeGeo = g('toe', () => new THREE.SphereGeometry(0.065, 10, 8));

    this.legs = [];
    [-0.105, 0.105].forEach((x) => {
      const hip = new THREE.Group();
      hip.position.set(x, 0.82, 0);
      const thigh = new THREE.Mesh(thighGeo, S ? skin : shorts);
      thigh.position.y = -thighLen / 2 - 0.03;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.y = -thighLen - 0.06;
      hip.add(knee);

      const shin = new THREE.Mesh(shinGeo, S ? skin : skin);
      shin.position.y = -shinLen / 2 - 0.02;
      knee.add(shin);

      if (!S) {
        const sockMesh = new THREE.Mesh(sockGeo, sock);
        sockMesh.position.y = -shinLen - 0.02;
        knee.add(sockMesh);
      }
      const b = new THREE.Mesh(bootGeo, boot);
      b.position.set(0, -shinLen - 0.11, 0.045);
      knee.add(b);
      const toe = new THREE.Mesh(toeGeo, boot);
      toe.position.set(0, -shinLen - 0.125, 0.145);
      toe.scale.set(0.85, 0.7, 1);
      knee.add(toe);

      L.add(hip);
      this.legs.push(hip);
      this.knees = this.knees || [];
      this.knees.push(knee);
    });

    const armLen = 0.42;
    const upperGeo = g('upper', () => new THREE.CapsuleGeometry(0.058, 0.26, 3, 8));
    const foreGeo = g('fore', () => new THREE.CapsuleGeometry(0.05, 0.24, 3, 8));
    const handGeo = g('hand', () => new THREE.SphereGeometry(0.055, 8, 6));
    const sleeveGeo = g('sleeve', () => new THREE.CapsuleGeometry(0.068, 0.14, 3, 8));

    this.arms = [];
    [-1, 1].forEach((s) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.225, 1.45, 0);
      const upper = new THREE.Mesh(upperGeo, skin);
      upper.position.y = -0.15;
      shoulder.add(upper);
      if (!S) {
        const sleeve = new THREE.Mesh(sleeveGeo, shirt);
        sleeve.position.y = -0.07;
        shoulder.add(sleeve);
      }
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(foreGeo, skin);
      fore.position.y = -0.13;
      elbow.add(fore);
      const hand = new THREE.Mesh(handGeo, skin);
      hand.position.y = -0.27;
      hand.scale.set(0.9, 1.05, 0.9);
      elbow.add(hand);

      L.add(shoulder);
      this.arms.push(shoulder);
      this.elbows = this.elbows || [];
      this.elbows.push(elbow);
    });

    this.group.add(L);

    L.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    // grounding blob shadow (phones have the shadow map switched off)
    this.shadow = addContactShadow(this.group, 0.34, 0.5);
  }

  _hairStyle() {
    if (this.sport === 'swimming') return 'cap';
    return HAIR_STYLES[Math.floor(hash01(this.name, 11) * HAIR_STYLES.length)];
  }

  _addHair(style, hairMat, kitMat) {
    const L = this.body;
    const dark = new THREE.MeshStandardMaterial({ color: 0x0f0c0a, roughness: 0.6 });

    if (style === 'cap') {
      // swimming cap in a team-ish colour, smooth and tight to the skull
      const capColor = this.sport === 'swimming' ? [0xf2f2f2, 0xffd23f, 0x1b2733, 0xe4572e][Math.floor(hash01(this.name, 5) * 4)] : 0x1b2733;
      const capMat = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.32, metalness: 0.16 });
      const cap = new THREE.Mesh(
        g('cap', () => new THREE.SphereGeometry(0.175, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62)),
        capMat
      );
      cap.position.y = 1.79;
      cap.scale.set(0.97, 1.12, 0.99);
      L.add(cap);
      return;
    }

    if (style === 'afro') {
      const puff = new THREE.Mesh(g('afro', () => new THREE.SphereGeometry(0.205, 16, 12)), hairMat);
      puff.position.y = 1.815;
      puff.scale.set(1.02, 0.94, 1.0);
      L.add(puff);
      const front = new THREE.Mesh(
        g('fringe', () => new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)),
        hairMat
      );
      front.position.set(0, 1.815, 0.02);
      front.scale.set(1.03, 1.02, 1.03);
      L.add(front);
      return;
    }

    if (style === 'braids') {
      const crown = new THREE.Mesh(
        g('crown', () => new THREE.SphereGeometry(0.176, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)),
        hairMat
      );
      crown.position.y = 1.8;
      crown.scale.set(1, 1.05, 1);
      L.add(crown);
      const strand = g('strand', () => new THREE.CapsuleGeometry(0.019, 0.16, 2, 6));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const s = new THREE.Mesh(strand, hairMat);
        s.position.set(Math.cos(a) * 0.14, 1.7, Math.sin(a) * 0.13);
        s.rotation.z = Math.cos(a) * 0.5;
        s.rotation.x = Math.sin(a) * 0.5;
        L.add(s);
        const bead = new THREE.Mesh(g('bead', () => new THREE.SphereGeometry(0.023, 6, 5)), kitMat);
        bead.position.set(Math.cos(a) * 0.15, 1.61, Math.sin(a) * 0.14);
        L.add(bead);
      }
      return;
    }

    if (style === 'bun') {
      const crown = new THREE.Mesh(
        g('crown2', () => new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52)),
        hairMat
      );
      crown.position.y = 1.8;
      crown.scale.set(1.01, 1.08, 1.01);
      L.add(crown);
      const bun = new THREE.Mesh(g('bun', () => new THREE.SphereGeometry(0.08, 10, 8)), hairMat);
      bun.position.set(0, 1.9, -0.13);
      L.add(bun);
      return;
    }

    // crop: tight faded hairline
    const crop = new THREE.Mesh(
      g('crop', () => new THREE.SphereGeometry(0.172, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.46)),
      hairMat
    );
    crop.position.y = 1.795;
    crop.scale.set(1.0, 1.03, 1.0);
    L.add(crop);
    void dark;
  }

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }

  /** heading in radians; model faces -Z by default */
  setHeading(h) {
    this.group.rotation.y = h;
  }

  /**
   * Walk/run cycle.
   *
   * The stride phase is *accumulated* from the actual speed instead of being
   * derived from `sin(t * cadence)`: when cadence changes with speed, that
   * form teleports the limbs every frame, which is what made the far players
   * look like they were vibrating. Integrating phase means the legs always
   * advance continuously, so the motion is smooth at any speed.
   */
  animate(t, speed = 0, dt = 1 / 60) {
    this.speed = speed;
    const run = Math.min(1, Math.max(0, speed) / 6);
    const cadence = 4.2 + run * 9; // steps per second of the stride cycle

    // advance the cycle only as fast as we are actually moving
    const step = dt * cadence * (0.24 + run * 0.76);
    this.phase = (this.phase || 0) + step;
    if (this.phase > Math.PI * 4000) this.phase -= Math.PI * 4000; // keep float precision

    // ease the stride amplitude so stopping does not snap the limbs straight
    const targetAmp = 0.16 + run * 0.74;
    this.amp = this.amp === undefined ? targetAmp : this.amp + (targetAmp - this.amp) * Math.min(1, dt * 10);
    const swing = Math.sin(this.phase) * this.amp;
    const lift = Math.cos(this.phase);

    if (this.legs?.[0]) {
      this.legs[0].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      if (this.knees) {
        // the knee only bends as the leg travels backwards
        this.knees[0].rotation.x = Math.max(0, -swing) * 1.15;
        this.knees[1].rotation.x = Math.max(0, swing) * 1.15;
      }
    }

    if (this.arms?.[0]) {
      // arms counter-swing, and settle to a relaxed hang when idle
      this.arms[0].rotation.x = -swing * 0.9 - (1 - run) * 0.06;
      this.arms[1].rotation.x = swing * 0.9 - (1 - run) * 0.06;
      this.arms[0].rotation.z = 0.07 + (1 - run) * 0.05;
      this.arms[1].rotation.z = -0.07 - (1 - run) * 0.05;
      if (this.elbows) {
        this.elbows[0].rotation.x = -0.3 - Math.max(0, swing) * 0.6;
        this.elbows[1].rotation.x = -0.3 - Math.max(0, -swing) * 0.6;
      }
    }

    // torso: a gentle bob and lean, driven by the same phase so it never jitters
    if (this.body) {
      this.body.position.y = Math.abs(lift) * 0.034 * run;
      this.body.rotation.z = swing * 0.05;
      this.body.rotation.x = run * 0.08; // lean into the run
    }
    // idle breathing when standing still, so nobody looks frozen
    if (this.head && run < 0.08) {
      this.head.position.y = 1.76 + Math.sin(t * 1.6 + (this.breathPhase || 0)) * 0.006;
    }
  }

  celebrate() {
    if (!this.arms?.[0]) return;
    this.arms[0].rotation.x = -2.6;
    this.arms[1].rotation.x = -2.6;
    this.arms[0].rotation.z = 0.35;
    this.arms[1].rotation.z = -0.35;
    if (this.body) this.body.position.y = 0.02;
  }

  dispose() {
    this.group.removeFromParent();
  }
}

/** Circular name label that always faces the camera. */
export function makeNameTag(name, color = '#ffffff', bg = 'rgba(9,20,14,.72)') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  const r = 18;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(4, 8, 248, 48, r);
  } else {
    // older Safari: approximate the rounded label with plain arcs
    ctx.moveTo(4 + r, 8);
    ctx.lineTo(252 - r, 8);
    ctx.quadraticCurveTo(252, 8, 252, 8 + r);
    ctx.lineTo(252, 56 - r);
    ctx.quadraticCurveTo(252, 56, 252 - r, 56);
    ctx.lineTo(4 + r, 56);
    ctx.quadraticCurveTo(4, 56, 4, 56 - r);
    ctx.lineTo(4, 8 + r);
    ctx.quadraticCurveTo(4, 8, 4 + r, 8);
  }
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = 'bold 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 34, 232);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(1.5, 0.38, 1);
  return sprite;
}

export function shortName(name) {
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 10);
  return parts[0].slice(0, 9) + ' ' + (parts[1] ? parts[1][0] + '.' : '');
}

export function nameInitials(name) {
  return initials(name);
}
