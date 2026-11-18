/**
 * SEROMA AQUATICS — first-person 50m freestyle.
 * Tap (or press space) in rhythm with the stroke cycle to hold top speed.
 */
import * as THREE from 'three';
import {
  createRenderer,
  disposeScene,
  clamp,
  lerp,
  rand,
  fmtTime,
  IS_TOUCH,
} from '../core/engine.js';
import { makeCloudSky, makeRenderLights, applyRenderLook, addHills, addHedge } from '../core/style.js';
import { waterTexture, bannerTexture, crowdTexture } from '../core/textures.js';
import { addTreeLine, addGrandstand, addClassroomBlock, addSchoolSign, addPalm } from '../world/campus.js';
import { Avatar } from '../world/players.js';
import { teamById, squadFor } from '../data/seroma.js';
import { audio } from '../core/audio.js';

const LANES = 5;
const LANE_W = 2.4;
const RACE_LEN = 50;

export class SwimmingGame {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    container.appendChild(this.canvas);
    this.renderer = createRenderer(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.08, 400);
    this.homeTeam = teamById(opts.homeTeam || 'theos');
    this.homeName = opts.homePlayer || squadFor(this.homeTeam.id)[0];
    this.lane = 2; // 0..4
    this.distance = 0;
    this.speed = 0;
    this.stamina = 1;
    this.rhythm = 0; // 0..1 stroke-cycle phase
    this.cycle = 0.5;
    this.lastTapQuality = 0;
    this.taps = [];
    this.timeLeft = opts.duration ?? 60;
    this.elapsed = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.banner = '';
    this.bannerTimer = 0;
    this.finished = false;
    this.running = false;
    this.paused = false;
    this.tick = 0;
    this.rivals = [];
    this.strokeCount = 0;
    this.perfect = 0;
    this.onEvent = opts.onEvent || (() => {});
    this.onEnd = opts.onEnd || (() => {});
    this.onScore = opts.onScore || (() => {});
    this.oppTeam = teamById(opts.awayTeam || 'elites');
  }

  async init() {
    const scene = this.scene;
    scene.fog = new THREE.Fog(0xcfe6ef, 60, 220);
    scene.add(makeCloudSky());
    this.lights = makeRenderLights(scene, 1.05);
    this._buildPool();
    this._buildRivals();
    this._resize();
    this.ro = new ResizeObserver(() => this._resize());
    this.ro.observe(this.container);
  }

  _buildPool() {
    const scene = this.scene;
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xe4dac6, roughness: 0.78 });
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(120, 160), deckMat);
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = -0.05;
    deck.receiveShadow = true;
    scene.add(deck);

    addHills(scene, { radius: 150, count: 14, colors: ['#8bbd63', '#9ecb74', '#7cab56'] });
    addHedge(scene, 0, 12, { w: 30, color: '#3f8b3a' });

    // pool shell
    const width = LANES * LANE_W;
    const poolInner = new THREE.Mesh(
      new THREE.BoxGeometry(width, 2.2, RACE_LEN + 8),
      new THREE.MeshStandardMaterial({ color: 0x8fd6e8, roughness: 0.6 })
    );
    poolInner.position.set(0, -1.1, -RACE_LEN / 2 + 2);
    scene.add(poolInner);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 0.6, RACE_LEN + 6),
      new THREE.MeshStandardMaterial({
        map: waterTexture(),
        transparent: true,
        opacity: 0.92,
        roughness: 0.18,
        metalness: 0.25,
        color: 0x9fe4f5,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.05, -RACE_LEN / 2 + 2);
    scene.add(water);
    this.water = water;

    // lane ropes
    for (let i = 0; i <= LANES; i++) {
      const x = -width / 2 + i * LANE_W;
      const rope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, RACE_LEN + 6, 6),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf5f5f5 : 0xd94a3d, roughness: 0.6 })
      );
      rope.rotation.x = Math.PI / 2;
      rope.position.set(x, 0.1, -RACE_LEN / 2 + 2);
      scene.add(rope);
      for (let d = -1; d <= RACE_LEN + 5; d += 2) {
        const float = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 6, 5),
          new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffffff : 0xe0492f, roughness: 0.7 })
        );
        float.position.set(x, 0.1, -RACE_LEN / 2 + 2 + d);
        scene.add(float);
      }
    }

    // pool walls at the ends
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.9 });
    const startWall = new THREE.Mesh(new THREE.BoxGeometry(width + 2, 1.4, 1), wallMat);
    startWall.position.set(0, 0.4, 4.2);
    scene.add(startWall);
    const endWall = new THREE.Mesh(new THREE.BoxGeometry(width + 2, 1.4, 1), wallMat);
    endWall.position.set(0, 0.4, -RACE_LEN - 1.5);
    scene.add(endWall);

    // starting blocks
    for (let i = 0; i < LANES; i++) {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.4, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.6 })
      );
      block.position.set(this._laneX(i), 0.55, 3.6);
      scene.add(block);
    }

    // grandstands with real crowds + campus dressing
    const gsA = addGrandstand(scene, 0, 12, Math.PI, 40, ['#1b6b9c', '#f2f2f2'], { rows: 4 });
    const gsB = addGrandstand(scene, -width / 2 - 12, -20, Math.PI / 2, 34, ['#c0392b', '#ffffff'], { rows: 4 });
    this.crowds = [gsA, gsB].map((g) => g.userData.crowd).filter(Boolean);
    addClassroomBlock(scene, 30, -12, { w: 22, d: 8, h: 6.2, rot: -0.4 });
    addClassroomBlock(scene, -32, 8, { w: 20, d: 8, h: 6, rot: 0.5, wall: 'cream' });
    addTreeLine(scene, 0, -20, 44, 20);
    addSchoolSign(scene, 0, 18, Math.PI);
    addPalm(scene, width / 2 + 6, -4, 1.1);
    addPalm(scene, -width / 2 - 6, -26, 0.95);

    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 3.4),
      new THREE.MeshStandardMaterial({
        map: bannerTexture('SEROMA AQUATICS', '#0b4f6c', '#e8fbff', '50M FREESTYLE FINAL'),
        roughness: 0.85,
      })
    );
    banner.position.set(0, 3.2, -RACE_LEN - 4.5);
    scene.add(banner);
    this.finishZ = -RACE_LEN - 1.5;
  }

  _laneX(i) {
    return -((LANES * LANE_W) / 2) + LANE_W / 2 + i * LANE_W;
  }

  /**
   * The other four lanes are real Seroma swimmers: full avatars in the water,
   * capped, face down and stroking, with their clubs split between the two
   * sides so the heat looks like a proper school meet.
   */
  _buildRivals() {
    const homeNames = squadFor(this.homeTeam.id, 8, this.homeName).filter((n) => n !== this.homeName);
    const awayNames = squadFor(this.oppTeam.id, 8);
    let hi = 0;
    let ai = 0;
    for (let i = 0; i < LANES; i++) {
      if (i === this.lane) {
        this.rivals.push(null);
        continue;
      }
      const fromHome = i % 2 === 0;
      const team = fromHome ? this.homeTeam : this.oppTeam;
      const pool = fromHome ? homeNames : awayNames;
      const name = pool[(fromHome ? hi++ : ai++) % Math.max(1, pool.length)] || 'SEROMA SWIMMER';
      const av = new Avatar({ team, name, number: i + 2, sport: 'swimming' });
      // face down the pool, body level with the surface
      av.group.rotation.set(-Math.PI / 2, 0, 0);
      av.group.position.set(this._laneX(i), 0.16, 2.6);
      this.scene.add(av.group);
      this.rivals.push({
        group: av.group,
        avatar: av,
        team,
        name,
        progress: 0,
        pace: rand(1.28, 1.6),
        wobble: rand(0, 6.28),
      });
    }
  }

  _resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    applyRenderLook(this.renderer);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  onLook(dx, dy) {
    this.yaw = clamp(this.yaw - dx * 0.5, -0.7, 0.7);
    this.pitch = clamp(this.pitch - dy * 0.4, -0.5, 0.6);
  }

  onAction(name) {
    if (this.paused || this.finished) return;
    if (name === 'kickDown' || name === 'call') this.stroke();
    if (name === 'tackle') this._dolphin();
    if (name === 'skill1' || name === 'skill2') this._dolphin();
  }

  _dolphin() {
    if (this.stamina < 0.22) {
      this._flash('TOO TIRED FOR AN UNDERWATER KICK');
      return;
    }
    this.stamina = Math.max(0, this.stamina - 0.2);
    this.dolphinBoost = 1.0;
    audio.splash();
    this._flash('UNDERWATER KICK!', 0.9);
  }

  _flash(text, secs = 1.4) {
    this.banner = text;
    this.bannerTimer = secs;
    this.onEvent({ type: 'banner', text });
  }

  /** Each tap is judged against the stroke cycle; on-beat taps give a surge. */
  stroke() {
    this.strokeCount++;
    // ideal phase is the middle of the cycle (arms entering the water)
    const phase = this.cycle;
    const off = Math.abs(phase - 0.5);
    let quality = 0;
    if (off < 0.08) {
      quality = 1;
      this.perfect++;
      this._flash('PERFECT STROKE', 0.6);
      this.onEvent({ type: 'perfect', big: this.perfect % 5 === 0 });
    } else if (off < 0.2) quality = 0.66;
    else if (off < 0.34) quality = 0.34;
    else quality = 0.08;
    this.lastTapQuality = quality;
    this.speed += 0.55 + quality * 1.5;
    this.stamina = Math.max(0, this.stamina - (quality > 0.5 ? 0.016 : 0.03));
    audio.splash();
    // arm splash burst
    this.splashTimer = 0.25;
  }

  update(dt, input) {
    if (this.paused || this.finished) return;
    this.tick += dt;
    if (this.crowds) for (const c of this.crowds) c.update(dt, this.tick);
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner = '';
    }
    const look = input.consumeLook();
    if (look.x || look.y) this.onLook(look.x, look.y);
    input.consumeActions().forEach((a) => this.onAction(a));

    // keyboard: letter keys trigger a stroke as well
    if (!input.isTouch) {
      ['KeyJ', 'KeyK'].forEach((k) => {
        if (input.keys.has(k) && !this._prevKeys?.has(k)) this.stroke();
      });
      this._prevKeys = new Set(input.keys);
    }

    // sway between lanes (touch stick / A-D)
    const mv = input.moveVector();
    this.laneOffset = clamp((this.laneOffset || 0) + mv.x * dt * 1.6, -0.9, 0.9);

    this.cycle = (this.cycle + dt * (1.05 + this.speed * 0.16)) % 1;
    this.rhythm += dt;

    this.dolphinBoost = Math.max(0, (this.dolphinBoost || 0) - dt);
    const drag = 0.9 + (this.stamina < 0.15 ? 0.9 : 0);
    this.speed = Math.max(0, this.speed - drag * dt);
    this.speed = Math.min(this.speed, 2.7 + (this.dolphinBoost > 0 ? 1.4 : 0));
    this.stamina = clamp(this.stamina + dt * 0.045, 0, 1);
    this.distance += this.speed * dt;
    this.elapsed += dt;

    if (this.splashTimer > 0) this.splashTimer -= dt;

    this._updateRivals(dt);
    this._updateCamera(dt);

    // the pool deck erupts as the race comes to the wall
    if (this.crowds) {
      const closing = Math.max(0, Math.min(1, (this.distance / RACE_LEN - 0.7) / 0.3));
      for (const c of this.crowds) c.setExcitement(closing * 0.85);
    }

    if (this.distance >= RACE_LEN) this._end();

    this.renderer.render(this.scene, this.camera);
  }

  _updateRivals(dt) {
    this.rivals.forEach((r) => {
      if (!r) return;
      r.progress += r.pace * dt * (0.96 + Math.sin(this.tick * 0.6 + r.wobble) * 0.06);
      r.group.position.z = 2.6 - r.progress;
      r.group.position.y = 0.16 + Math.sin(this.tick * 6 + r.wobble) * 0.05;
      // roll with the stroke instead of spinning: they are face down, so the
      // body twists about the swim axis (local Z) rather than world Z
      r.group.rotation.z = Math.sin(this.tick * 5 + r.wobble) * 0.16;
      r.group.rotation.y = Math.sin(this.tick * 5 + r.wobble) * 0.1;
      if (r.avatar) {
        const strokeSpeed = 4 + r.pace * 4;
        r.avatar.animate(this.tick + r.wobble, strokeSpeed, dt);
      }
    });
  }

  _updateCamera(dt) {
    const laneX = this._laneX(this.lane) + (this.laneOffset || 0);
    // head bob in stroke rhythm
    const bob = Math.sin(this.cycle * Math.PI * 2) * 0.055;
    const roll = Math.sin(this.cycle * Math.PI * 2) * 0.1;
    this.camera.position.set(
      laneX + Math.sin(this.tick * 1.6) * 0.05,
      0.62 + bob + (this.dolphinBoost > 0 ? 0.14 : 0),
      2.5 - this.distance
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw + Math.sin(this.cycle * Math.PI * 2) * 0.035;
    this.camera.rotation.x = -0.16 + this.pitch;
    this.camera.rotation.z = roll * 0.5;
  }

  getHUD() {
    const behind = this.rivals
      .filter(Boolean)
      .map((r) => ({ name: r.name, progress: r.progress }))
      .sort((a, b) => b.progress - a.progress);
    const pos = 1 + behind.filter((r) => r.progress > this.distance).length;
    const phase = this.cycle;
    return {
      distance: this.distance,
      total: RACE_LEN,
      pct: clamp((this.distance / RACE_LEN) * 100, 0, 100),
      speed: this.speed,
      stamina: this.stamina,
      phase,
      rhythm: this.cycle,
      inBand: this.cycle > 0.42 && this.cycle < 0.58,
      position: pos,
      clock: fmtTime(this.timeLeft),
      timeLeft: this.timeLeft,
      elapsed: this.elapsed,
      banner: this.banner,
      homeTeam: this.homeTeam,
      homeName: this.homeName,
      perfect: this.perfect,
      strokes: this.strokeCount,
      hint: this.cycle > 0.42 && this.cycle < 0.58 ? 'STROKE!' : 'KEEP THE RHYTHM',
    };
  }

  _end() {
    if (this.finished) return;
    this.finished = true;
    const behind = this.rivals.filter(Boolean).filter((r) => r.progress > this.distance).length;
    const pos = 1 + behind;
    audio.whistle();
    audio.roar(1);
    this.onEnd({
      position: pos,
      time: this.elapsed,
      perfect: this.perfect,
      strokes: this.strokeCount,
      result: pos === 1 ? 'win' : pos === 2 ? 'podium' : 'loss',
      homeName: this.homeName,
    });
  }

  attachInput(input) {
    this.input = input;
  }
  setPaused(v) {
    this.paused = v;
  }
  start() {
    this.running = true;
    audio.startCrowd();
    audio.whistle();
    this._flash('TAKE YOUR MARKS · 50M FREESTYLE FINAL', 2.6);
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
      this.last = now;
      this.update(dt, this.input);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    audio.stopCrowd();
    disposeScene(this.scene);
    this.renderer?.dispose();
    this.canvas.remove();
  }
}
