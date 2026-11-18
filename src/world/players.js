/* Low-poly footballer / basketballer / swimmer built from primitives. */
import * as THREE from 'three';
import { initials } from '../data/seroma.js';

const skinTones = [0x5b3a24, 0x7a4a2b, 0x8d5b35, 0x3f2718, 0x6b4226];
const geoCache = {};

function g(key, make) {
  if (!geoCache[key]) geoCache[key] = make();
  return geoCache[key];
}

export class Avatar {
  constructor({ team, name, number = 7, sport = 'football', isKeeper = false }) {
    this.team = team;
    this.name = name || team.name;
    this.number = number;
    this.sport = sport;
    this.isKeeper = isKeeper;
    this.group = new THREE.Group();
    this.group.userData.avatar = this;
    this.speed = 0;
    this._build();
  }

  _build() {
    const kit = this.isKeeper
      ? { primary: '#1f6f43', secondary: '#ffffff', shorts: '#111111' }
      : this.team.colors;
    const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color(kit.primary), roughness: 0.85 });
    const trim = new THREE.MeshStandardMaterial({ color: new THREE.Color(kit.secondary), roughness: 0.85 });
    const shorts = new THREE.MeshStandardMaterial({ color: new THREE.Color(kit.shorts), roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({
      color: skinTones[this.name.length % skinTones.length],
      roughness: 0.75,
    });
    const sock = new THREE.MeshStandardMaterial({ color: new THREE.Color(kit.secondary), roughness: 0.9 });

    const T = this.sport === 'basketball';
    const S = this.sport === 'swimming';

    const torsoH = T ? 0.78 : 0.72;
    this.torso = new THREE.Mesh(
      g('torso' + torsoH, () => new THREE.CapsuleGeometry(0.27, torsoH, 4, 10)),
      S ? skin : shirt
    );
    this.torso.position.y = 1.22;
    this.group.add(this.torso);

    if (!S) {
      const num = new THREE.Mesh(
        g('num', () => new THREE.PlaneGeometry(0.42, 0.34)),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(kit.secondary), roughness: 0.9 })
      );
      num.position.set(0, 1.32, -0.265);
      num.rotation.y = Math.PI;
      this.group.add(num);
      const stripe = new THREE.Mesh(g('stripe', () => new THREE.BoxGeometry(0.5, 0.1, 0.5)), trim);
      stripe.position.y = 0.96;
      this.group.add(stripe);
    }

    this.head = new THREE.Mesh(g('head', () => new THREE.SphereGeometry(0.19, 14, 12)), skin);
    this.head.position.y = 1.78;
    this.group.add(this.head);
    this.hair = new THREE.Mesh(
      g('hair', () => new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)),
      new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 1 })
    );
    this.hair.position.y = 1.81;
    this.group.add(this.hair);

    const limbLen = S ? 0.62 : 0.56;
    const legGeo = g('leg' + limbLen, () => new THREE.CapsuleGeometry(0.105, limbLen, 3, 8));
    const armGeo = g('arm', () => new THREE.CapsuleGeometry(0.075, 0.46, 3, 8));

    this.legs = [];
    [-0.13, 0.13].forEach((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.86, 0);
      const leg = new THREE.Mesh(legGeo, S ? skin : shorts);
      leg.position.y = -limbLen / 2 - 0.1;
      pivot.add(leg);
      if (!S) {
        const boot = new THREE.Mesh(g('boot', () => new THREE.BoxGeometry(0.16, 0.1, 0.3)), sock);
        boot.position.set(0, -limbLen - 0.22, 0.05);
        pivot.add(boot);
      }
      this.group.add(pivot);
      this.legs.push(pivot);
    });

    this.arms = [];
    [-0.31, 0.31].forEach((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.5, 0);
      const arm = new THREE.Mesh(armGeo, S ? skin : skin);
      arm.position.y = -0.26;
      pivot.add(arm);
      if (!S) {
        const sleeve = new THREE.Mesh(g('sleeve', () => new THREE.CapsuleGeometry(0.088, 0.16, 3, 8)), shirt);
        sleeve.position.y = -0.06;
        pivot.add(sleeve);
      }
      this.group.add(pivot);
      this.arms.push(pivot);
    });

    this.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }

  /** heading in radians; model faces -Z by default */
  setHeading(h) {
    this.group.rotation.y = h;
  }

  animate(t, speed = 0) {
    this.speed = speed;
    const run = Math.min(1, speed / 6);
    const swing = Math.sin(t * (6 + run * 8)) * (0.35 + run * 0.75);
    if (this.legs[0]) {
      this.legs[0].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
    }
    if (this.arms[0]) {
      this.arms[0].rotation.x = -swing * 0.8;
      this.arms[1].rotation.x = swing * 0.8;
    }
    this.group.position.y += Math.abs(Math.sin(t * (6 + run * 8))) * 0.02 * run;
  }

  celebrate() {
    if (!this.arms[0]) return;
    this.arms[0].rotation.x = -2.6;
    this.arms[1].rotation.x = -2.6;
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
