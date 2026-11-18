/**
 * SEROMA LEAGUE FOOTBALL — first-person ("POV") 5-a-side.
 * You are one player. Look where you want to pass or shoot, hold to power up.
 */
import * as THREE from 'three';
import {
  createRenderer,
  makeSky,
  makeLights,
  disposeScene,
  clamp,
  lerp,
  damp,
  rand,
  angleDelta,
  dist2,
  fmtTime,
  IS_TOUCH,
} from '../core/engine.js';
import {
  grassTexture,
  dirtTexture,
  bannerTexture,
  crowdTexture,
} from '../core/textures.js';
import {
  addTreeLine,
  addPerimeterWall,
  addGrandstand,
  addSchoolSign,
  addFloodlight,
  addClassroomBlock,
  addTerraces,
  addPalm,
  addEucalyptus,
} from '../world/campus.js';
import { Avatar, makeNameTag, shortName } from '../world/players.js';
import { teamById, squadFor, SCHOOL } from '../data/seroma.js';
import { audio } from '../core/audio.js';

export const PITCH = { halfW: 24, halfL: 34, goalW: 7.2, goalH: 2.6 };

const PHYS = {
  gravity: -19.5,
  ballRadius: 0.22,
  friction: 1.6,
  airDrag: 0.16,
  bounce: 0.62,
  playerSpeed: 6.4,
  sprintSpeed: 9.1,
};

class Ball {
  constructor(scene) {
    const geo = new THREE.SphereGeometry(PHYS.ballRadius, 18, 14);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#f7f7f2';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#1a1a1a';
    for (let i = 0; i < 7; i++) {
      const x = (i % 3) * 44 + 18;
      const y = Math.floor(i / 3) * 44 + 20;
      g.beginPath();
      g.arc(x, y, 13, 0, Math.PI * 2);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.position.set(0, PHYS.ballRadius, 0);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, PHYS.ballRadius, 0);
    this.vel = new THREE.Vector3();
    this.owner = null; // avatar that is dribbling
    this.lastTouch = null;
    this.spin = new THREE.Vector3();
  }

  reset(x = 0, z = 0) {
    this.pos.set(x, PHYS.ballRadius, z);
    this.vel.set(0, 0, 0);
    this.mesh.position.copy(this.pos);
    this.owner = null;
    this.lastTouch = null;
  }

  update(dt) {
    if (this.owner && this.getOwnerState) {
      // Dribble: ball sits just in front of the owner's feet, with little touches.
      const st = this.getOwnerState(this.owner);
      const a = st.heading;
      const fx = -Math.sin(a);
      const fz = -Math.cos(a);
      const speed = st.speed || 0;
      const lead = 0.62 + Math.min(speed * 0.035, 0.3);
      const tx = st.x + fx * lead;
      const tz = st.z + fz * lead;
      this.pos.x = damp(this.pos.x, tx, 14, dt);
      this.pos.z = damp(this.pos.z, tz, 14, dt);
      this.pos.y = PHYS.ballRadius + Math.abs(Math.sin(performance.now() * 0.012)) * 0.05 * (speed / 6);
      this.vel.set(0, 0, 0);
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.x += speed * dt * 1.6;
      return;
    }

    this.vel.y += PHYS.gravity * dt;
    this.pos.addScaledVector(this.vel, dt);

    const onGround = this.pos.y <= PHYS.ballRadius;
    if (onGround) {
      this.pos.y = PHYS.ballRadius;
      if (this.vel.y < -1.2) {
        audio.bounce(clamp(Math.abs(this.vel.y) / 12, 0, 1));
        this.vel.y = -this.vel.y * PHYS.bounce;
      } else {
        this.vel.y = 0;
      }
      // rolling friction
      const f = Math.exp(-PHYS.friction * dt);
      this.vel.x *= f;
      this.vel.z *= f;
      if (Math.hypot(this.vel.x, this.vel.z) < 0.08) {
        this.vel.x = 0;
        this.vel.z = 0;
      }
    } else {
      const f = Math.exp(-PHYS.airDrag * dt);
      this.vel.x *= f;
      this.vel.z *= f;
    }

    // keep inside the arena (bounce off "fence" just outside the pitch)
    const limW = PITCH.halfW + 7;
    const limL = PITCH.halfL + 8;
    if (Math.abs(this.pos.x) > limW) {
      this.pos.x = Math.sign(this.pos.x) * limW;
      this.vel.x *= -0.5;
    }
    if (Math.abs(this.pos.z) > limL) {
      this.pos.z = Math.sign(this.pos.z) * limL;
      this.vel.z *= -0.5;
    }

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.x += (Math.hypot(this.vel.x, this.vel.z) * dt) / PHYS.ballRadius * 0.4;
  }
}

export class FootballGame {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    container.appendChild(this.canvas);
    this.renderer = createRenderer(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 700);
    this.clock = new THREE.Clock();
    this.time = 0;
    this.running = false;
    this.paused = false;
    this.finished = false;

    this.homeTeam = teamById(opts.homeTeam || 'gaucho');
    this.awayTeam = teamById(opts.awayTeam || 'theos');
    this.homeName = opts.homePlayer || squadFor(this.homeTeam.id)[0];
    this.awayName = opts.awayPlayer || squadFor(this.awayTeam.id)[0];

    this.score = { home: 0, away: 0 };
    this.practice = !!opts.practice;
    this.duration = opts.duration ?? (this.practice ? 3599 : 180); // seconds of match clock
    this.timeLeft = this.duration;
    this.yaw = Math.PI; // looking toward the away goal
    this.pitch = 0;
    this.kickCharge = 0;
    this.banner = '';
    this.bannerTimer = 0;
    this.stats = { shots: 0, passes: 0, tackles: 0, saves: 0, goals: 0, distance: 0 };
    this.onEvent = opts.onEvent || (() => {});
    this.onScore = opts.onScore || (() => {});
    this.onEnd = opts.onEnd || (() => {});
    this.isTouch = IS_TOUCH;
  }

  async init() {
    const scene = this.scene;
    scene.fog = new THREE.Fog(0xbcd6e6, 90, 300);
    scene.add(makeSky('#2a6fa8', '#a9d3ea', '#f2e4c4'));
    this.lights = makeLights(scene);
    this._buildStadium();
    this.ball = new Ball(scene);
    this.ball.getOwnerState = (o) => this._ownerState(o);
    this._spawnPlayers();
    this._resize();
    this.ro = new ResizeObserver(() => this._resize());
    this.ro.observe(this.container);
    this.yaw = 0;
  }

  _buildStadium() {
    const scene = this.scene;
    const { halfW, halfL } = PITCH;

    // ground: red-earth surround + grass pitch
    const surround = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 150),
      new THREE.MeshStandardMaterial({ map: dirtTexture([26, 26]), roughness: 1 })
    );
    surround.rotation.x = -Math.PI / 2;
    surround.receiveShadow = true;
    scene.add(surround);

    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(halfW * 2, halfL * 2, 1, 1),
      new THREE.MeshStandardMaterial({ map: grassTexture([8, 11]), roughness: 1 })
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0.02;
    pitch.receiveShadow = true;
    scene.add(pitch);

    // painted lines
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const line = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.035, z);
      scene.add(m);
    };
    line(halfW * 2, 0.16, 0, -halfL);
    line(halfW * 2, 0.16, 0, halfL);
    line(0.16, halfL * 2, -halfW, 0);
    line(0.16, halfL * 2, halfW, 0);
    line(0.16, halfL * 2, 0, 0);
    const circle = new THREE.Mesh(new THREE.RingGeometry(5.6, 5.78, 48), lineMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.035;
    scene.add(circle);
    // penalty boxes
    [-1, 1].forEach((s) => {
      line(20, 0.14, 0, s * (halfL - 9));
      line(0.14, 9, -10, s * (halfL - 4.5));
      line(0.14, 9, 10, s * (halfL - 4.5));
    });

    // goals
    this.goals = [];
    [-1, 1].forEach((s) => {
      const grp = new THREE.Group();
      const postMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.2 });
      const postGeo = new THREE.CylinderGeometry(0.09, 0.09, PITCH.goalH, 8);
      [-1, 1].forEach((side) => {
        const p = new THREE.Mesh(postGeo, postMat);
        p.position.set((side * PITCH.goalW) / 2, PITCH.goalH / 2, 0);
        grp.add(p);
      });
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, PITCH.goalW, 8), postMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.y = PITCH.goalH;
      grp.add(bar);
      // net
      const netTex = bannerTexture('', '#00000000', '#ffffff');
      const net = new THREE.Mesh(
        new THREE.BoxGeometry(PITCH.goalW, PITCH.goalH, 2.2),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, side: THREE.DoubleSide })
      );
      net.position.set(0, PITCH.goalH / 2, s * 1.1);
      grp.add(net);
      grp.position.set(0, 0, s * halfL);
      scene.add(grp);
      this.goals.push({ side: s, group: grp });
    });

    // grandstands on both touchlines
    addGrandstand(scene, 0, -halfL - 12, 0, 52, [this.homeTeam.colors.primary, '#f2f2f2']);
    addGrandstand(scene, 0, halfL + 12, Math.PI, 52, [this.awayTeam.colors.primary, '#f2f2f2']);
    // second tiers behind the goals
    addTerraces(scene, -halfW - 14, 0, { steps: 5, width: 26, rise: 0.8, run: 1.6 });
    addTerraces(scene, halfW + 14, 0, { steps: 5, width: 26, rise: 0.8, run: -1.6 });

    // campus backdrop: classroom blocks + Wisdom-hall-style block
    addClassroomBlock(scene, -halfW - 34, -26, { w: 30, d: 10, h: 7, rot: 0.25 });
    addClassroomBlock(scene, halfW + 36, 24, { w: 26, d: 9, h: 6.4, rot: -0.4, wall: 'cream' });
    addClassroomBlock(scene, -halfW - 30, 34, { w: 22, d: 8, h: 6, rot: -0.6 });

    addTreeLine(scene, 0, 0, 70, 30);
    addPerimeterWall(scene, 0, 0, 96);
    addSchoolSign(scene, 0, -halfL - 22, 0);
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) => addFloodlight(scene, sx * (halfW + 9), sz * (halfL + 9)))
    );
    addEucalyptus(scene, -halfW - 6, -halfL + 6, 1.3);
    addPalm(scene, halfW + 6, halfL - 8, 1.1);
  }

  _spawnPlayers() {
    this.avatars = [];
    this.teammates = [];
    this.opponents = [];
    const scene = this.scene;

    const homeSquad = squadFor(this.homeTeam.id, 6, this.homeName)
      .filter((n) => n !== this.homeName)
      .slice(0, 5);
    const awaySquad = squadFor(this.awayTeam.id, 6, this.awayName)
      .filter((n) => n !== this.awayName)
      .slice(0, 5);

    // You (invisible body — camera sits in your eyes)
    this.me = {
      team: this.homeTeam,
      name: this.homeName,
      pos: new THREE.Vector3(0, 0, PITCH.halfL * 0.42),
      heading: Math.PI,
      speed: 0,
      stamina: 1,
      isUser: true,
      hasBall: false,
      lastPos: new THREE.Vector3(),
    };

    const homePositions = [
      [-9, PITCH.halfL * 0.18],
      [9, PITCH.halfL * 0.18],
      [-13, -PITCH.halfL * 0.06],
      [13, -PITCH.halfL * 0.06],
      [0, PITCH.halfL * 0.72],
    ];
    homeSquad.slice(0, 5).forEach((name, i) => {
      const p = homePositions[i];
      const a = new Avatar({
        team: this.homeTeam,
        name,
        number: i + 2,
        isKeeper: i === 4,
        sport: 'football',
      });
      a.setPosition(p[0], 0, p[1]);
      scene.add(a.group);
      const tag = makeNameTag(shortName(name), '#fff8e1', 'rgba(15,81,50,.72)');
      tag.position.y = 2.15;
      a.group.add(tag);
      const rec = {
        avatar: a,
        name,
        team: this.homeTeam,
        home: true,
        role: i === 4 ? 'gk' : i === 3 || i === 2 ? 'def' : 'mid',
        target: new THREE.Vector3(p[0], 0, p[1]),
        base: new THREE.Vector3(p[0], 0, p[1]),
        speed: 0,
        cool: rand(0, 1),
      };
      this.teammates.push(rec);
      this.avatars.push(rec);
    });

    const awayPositions = [
      [-8, -PITCH.halfL * 0.2],
      [8, -PITCH.halfL * 0.2],
      [-14, PITCH.halfL * 0.05],
      [14, PITCH.halfL * 0.05],
      [0, -PITCH.halfL * 0.74],
    ];
    awaySquad.slice(0, 5).forEach((name, i) => {
      const p = awayPositions[i];
      const a = new Avatar({
        team: this.awayTeam,
        name,
        number: i + 2,
        isKeeper: i === 4,
        sport: 'football',
      });
      a.setPosition(p[0], 0, p[1]);
      scene.add(a.group);
      const tag = makeNameTag(shortName(name), '#ffe8e8', 'rgba(60,10,15,.72)');
      tag.position.y = 2.15;
      a.group.add(tag);
      const rec = {
        avatar: a,
        name,
        team: this.awayTeam,
        home: false,
        role: i === 4 ? 'gk' : i === 3 || i === 2 ? 'def' : 'mid',
        target: new THREE.Vector3(p[0], 0, p[1]),
        base: new THREE.Vector3(p[0], 0, p[1]),
        speed: 0,
        cool: rand(0, 0.6),
      };
      this.opponents.push(rec);
      this.avatars.push(rec);
    });

    this.keeper = this.opponents.find((o) => o.role === 'gk');
    this.myKeeper = this.teammates.find((o) => o.role === 'gk');
  }

  _resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  onLook(dx, dy) {
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy, -1.1, 1.1);
  }

  onAction(name) {
    if (this.paused && name !== 'pause') return;
    if (name === 'call') {
      this._callForBall();
    } else if (name === 'tackle') {
      this._tackle();
    } else if (name === 'skill1' || name === 'skill2' || name === 'skill3') {
      this._skill(name);
    } else if (name === 'kickDown') {
      this.kickCharge = 0;
    } else if (name === 'kickUp') {
      this._kick(this.kickCharge);
      this.kickCharge = 0;
    }
  }

  _flash(text, secs = 2.2) {
    this.banner = text;
    this.bannerTimer = secs;
    this.onEvent({ type: 'banner', text });
  }

  /** x/z/heading/speed for the user's hidden body or any AI avatar record. */
  _ownerState(o) {
    if (!o) return null;
    if (o.isUser) {
      return { x: this.me.pos.x, z: this.me.pos.z, heading: this.me.heading, speed: this.me.speed };
    }
    const g = o.avatar.group;
    return { x: g.position.x, z: g.position.z, heading: g.rotation.y, speed: o.speed || 0 };
  }

  /** Position of whoever has the ball (the user's hidden body or an avatar). */
  _ownerPos(owner) {
    const st = this._ownerState(owner);
    return st ? new THREE.Vector3(st.x, 0, st.z) : null;
  }

  _callForBall() {
    // nearest teammate with the ball passes it to you
    const holder = this.ball.owner;
    if (holder && holder.home && !holder.isUser) {
      this._passToMe(holder);
    } else if (!this.ball.owner) {
      this._flash('CALLING FOR THE BALL');
    }
  }

  _passToMe(holder) {
    const hPos = this._ownerPos(holder);
    if (!hPos) return;
    const target = new THREE.Vector3(this.me.pos.x, 0, this.me.pos.z);
    const dir = target.clone().sub(hPos).setY(0).normalize();
    const power = clamp(hPos.distanceTo(target) * 0.55, 6, 20);
    this.ball.owner = null;
    this.ball.lastTouch = holder;
    this.ball.vel.set(dir.x * power, 1.4, dir.z * power);
    this.stats.passes++;
    audio.kick(0.4);
    this._flash('BALL INCOMING');
  }

  _tackle() {
    if (this.tackleCooldown > 0) return;
    this.tackleCooldown = 1.1;
    const b = this.ball;
    const holder = b.owner;
    if (holder && !holder.home && !holder.isUser) {
      const d = holder.avatar.group.position.distanceTo(this.me.pos);
      if (d < 2.3 && Math.random() < 0.72) {
        b.owner = null;
        b.lastTouch = this.me;
        const away = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize();
        b.vel.set(away.x * 6, 2.2, away.z * 6);
        this.stats.tackles++;
        audio.kick(0.9);
        this._flash('CLEAN TACKLE!');
        this.onEvent({ type: 'tackle' });
      } else {
        audio.tone({ freq: 180, dur: 0.1, type: 'square', gain: 0.06 });
        this._flash('SLIDE MISSED');
      }
    } else if (!holder && dist2(b.pos.x, b.pos.z, this.me.pos.x, this.me.pos.z) < 1.5) {
      b.owner = this.me;
      b.lastTouch = this.me;
      this._flash('WON THE BALL');
    } else {
      this._flash('SLIDE TACKLE');
    }
  }

  _skill(name) {
    if (!this.ball.owner || this.ball.owner !== this.me) {
      this._flash('NEED THE BALL FOR THAT');
      return;
    }
    if (this.skillCooldown > 0) return;
    this.skillCooldown = 1.6;
    const labels = { skill1: 'STEP-OVER', skill2: 'RAINBOW FLICK', skill3: 'ROULETTE' };
    this._flash(labels[name] || 'SKILL');
    if (name === 'skill2') {
      this.ball.owner = null;
      const f = this._forwardVector();
      this.ball.vel.set(f.x * 5, 7.5, f.z * 5);
      audio.kick(0.6);
    } else {
      // sidestep burst
      this.skillBoost = 1.0;
    }
  }

  _forwardVector() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  /** Raycast from the camera along the view; decides pass vs shot. */
  _kick(charge) {
    const b = this.ball;
    const holder = b.owner;
    const nearBall = dist2(b.pos.x, b.pos.z, this.me.pos.x, this.me.pos.z) < 2.2;
    if (holder !== this.me && !nearBall) {
      this._flash('TOO FAR FROM THE BALL');
      return;
    }
    const power = clamp(0.3 + charge * 1.5, 0.3, 1.8);
    const dir = this._aimDirection();

    // is a teammate in the aim cone? then it is a pass — unless you wound up a shot.
    let bestMate = null;
    let bestDot = 0.965;
    this.teammates.forEach((t) => {
      const to = new THREE.Vector3(
        t.avatar.group.position.x - this.me.pos.x,
        0,
        t.avatar.group.position.z - this.me.pos.z
      );
      const d = to.length();
      if (d < 1.2 || d > 32) return;
      to.normalize();
      const dot = to.dot(dir);
      if (dot > bestDot) {
        bestDot = dot;
        bestMate = t;
      }
    });

    const goalZ = -PITCH.halfL;
    const toGoal = new THREE.Vector3(-this.me.pos.x, 0, goalZ - this.me.pos.z).normalize();
    const facingGoal = toGoal.dot(dir) > 0.72;
    const willShoot = facingGoal || !bestMate;

    b.owner = null;
    b.lastTouch = this.me;
    const speed = willShoot ? 14 + power * 17 : clamp(9 + power * 7, 9, 24);
    b.vel.set(dir.x * speed, willShoot ? 1.6 + power * 3.4 : 1.2 + power * 1.2, dir.z * speed);
    bestMate = willShoot ? null : bestMate;
    audio.kick(clamp(power / 1.6, 0.2, 1));

    if (bestMate) {
      this.stats.passes++;
      this._flash('PASS → ' + shortName(bestMate.name), 1.2);
      bestMate.receive = 0.9;
    } else {
      this.stats.shots++;
      this._flash('SHOT!', 1.2);
      this.onEvent({ type: 'shot' });
      if (Math.hypot(this.me.pos.x, this.me.pos.z + PITCH.halfL) < 26) {
        audio.roar(0.5);
      }
    }
    this.shotFrom = this.me.pos.clone();
  }

  /** Direction the camera is looking, flattened to the pitch. */
  _aimDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.pitch * 0.55, this.yaw, 0, 'YXZ'));
    dir.y = 0;
    if (dir.lengthSq() < 0.0001) dir.set(0, 0, -1);
    return dir.normalize();
  }

  update(dt, input) {
    if (this.paused || this.finished) return;
    this.time += dt;
    if (!this.practice) this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.tackleCooldown = Math.max(0, (this.tackleCooldown || 0) - dt);
    this.skillCooldown = Math.max(0, (this.skillCooldown || 0) - dt);
    this.skillBoost = Math.max(0, (this.skillBoost || 0) - dt);
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner = '';
    }

    const look = input.consumeLook();
    if (look.x || look.y) this.onLook(look.x * 1.6, look.y * 1.6);

    input.consumeActions().forEach((a) => this.onAction(a));
    if (input.kickHeld) {
      this.kickCharge = Math.min(1.4, this.kickCharge + dt);
      this._aimAssist(dt);
    }

    this._updateMe(dt, input);
    this._updateAI(dt);
    this.ball.update(dt);
    this._checkBallTouches(dt);
    this._checkGoal();
    this._updateCamera(dt);

    if (!this.practice && this.timeLeft <= 0) this._end();

    this.renderer.render(this.scene, this.camera);
  }

  /** While charging, gently pull the aim toward the goal mouth (helps on phones). */
  _aimAssist(dt) {
    const goalZ = -PITCH.halfL;
    const dx = 0 - this.me.pos.x;
    const dz = goalZ - this.me.pos.z;
    const want = Math.atan2(-dx, -dz);
    const diff = Math.abs(angleDelta(this.yaw, want));
    if (diff < 0.42) {
      this.yaw += angleDelta(this.yaw, want) * Math.min(1, dt * 2.6);
    }
  }

  _updateMe(dt, input) {
    const me = this.me;
    const mv = input.moveVector();
    const sprinting = input.sprint && me.stamina > 0.06;
    const base = PHYS.playerSpeed + (this.skillBoost > 0 ? 4 : 0);
    const speed = (sprinting ? PHYS.sprintSpeed : base) * (this.ball.owner === me ? 0.94 : 1);
    me.stamina = clamp(me.stamina + (sprinting ? -0.22 : 0.16) * dt, 0, 1);

    const fwd = this._forwardVector();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3()
      .addScaledVector(fwd, mv.y)
      .addScaledVector(right, mv.x);
    if (move.lengthSq() > 1) move.normalize();

    me.lastPos.copy(me.pos);
    me.pos.addScaledVector(move, speed * dt);
    me.pos.x = clamp(me.pos.x, -PITCH.halfW - 2, PITCH.halfW + 2);
    me.pos.z = clamp(me.pos.z, -PITCH.halfL - 2, PITCH.halfL + 2);
    me.speed = move.length() * speed;
    this.stats.distance += dist2(me.pos.x, me.pos.z, me.lastPos.x, me.lastPos.z);

    // body follows movement but the head follows the look direction
    if (move.lengthSq() > 0.02) me.heading = Math.atan2(-move.x, -move.z);
  }

  _closestOf(list, pos) {
    let best = null;
    let bd = 1e9;
    list.forEach((o) => {
      const g = o.avatar.group.position;
      const d = dist2(g.x, g.z, pos.x, pos.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    });
    return best;
  }

  _nearestOpponentToBall() {
    let best = null;
    let bd = 1e9;
    this.opponents.forEach((o) => {
      const d = dist2(o.avatar.group.position.x, o.avatar.group.position.z, this.ball.pos.x, this.ball.pos.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    });
    return best;
  }

  _updateAI(dt) {
    const b = this.ball;
    const userHasBall = b.owner === this.me;
    const opponentHasBall = b.owner && !b.owner.home && !b.owner.isUser;

    this.avatars.forEach((p) => {
      const g = p.avatar.group;
      const record = { home: p.home, avatar: { group: g }, isUser: false };
      let tx = p.base.x;
      let tz = p.base.z;
      let speed = 3.6;

      if (p.role === 'gk') {
        const goalZ = p.home ? PITCH.halfL : -PITCH.halfL;
        const inwards = -Math.sign(goalZ);
        const toBall = dist2(b.pos.x, b.pos.z, g.position.x, g.position.z);
        const ballInMyHalf = b.pos.z * Math.sign(goalZ) > -4;
        // base: shuffle across the goal line with the ball
        tx = clamp(b.pos.x * 0.8, -PITCH.goalW * 0.8, PITCH.goalW * 0.8);
        tz = goalZ + inwards * 1.4;
        if (!b.owner && toBall < 7 && ballInMyHalf) {
          // sweep up a loose ball near the box
          tx = b.pos.x;
          tz = b.pos.z;
          speed = 5.4;
        } else if (b.owner && !b.owner.isUser && b.owner.home !== p.home && toBall < 13) {
          // narrow the angle against an attacker
          tx = clamp(b.pos.x * 0.7, -PITCH.goalW * 0.9, PITCH.goalW * 0.9);
          tz = goalZ + inwards * 2.2;
          speed = 4.9;
        }
        p.target.set(tx, 0, tz);
      } else if (b.owner === p) {
        // dribble toward the opponent goal, swerving around the player
        const goalZ = p.home ? -PITCH.halfL : PITCH.halfL;
        const toGoal = new THREE.Vector3(-g.position.x * 0.28, 0, goalZ - g.position.z).normalize();
        const away = new THREE.Vector3();
        if (p.home) {
          const d = dist2(g.position.x, g.position.z, this.me.pos.x, this.me.pos.z);
          if (d < 4.2) {
            away.set(g.position.x - this.me.pos.x, 0, g.position.z - this.me.pos.z).normalize().multiplyScalar(1.6);
          }
        }
        p.target.set(
          clamp(g.position.x + (toGoal.x + away.x) * 9, -PITCH.halfW, PITCH.halfW),
          0,
          clamp(g.position.z + (toGoal.z + away.z) * 9, -PITCH.halfL + 2, PITCH.halfL - 2)
        );
        speed = p.home ? 4.7 : 4.6;
      } else if (userHasBall) {
        if (p.home) {
          // push up to support
          tz = p.base.z - 8;
          tx = p.base.x * 1.25;
          speed = 4.4;
        } else {
          // press the ball
          const nearest = this._nearestOpponentToBall();
          if (nearest === p) {
            tx = b.pos.x;
            tz = b.pos.z;
            speed = 4.6;
          } else {
            tx = lerp(p.base.x, b.pos.x, 0.35);
            tz = lerp(p.base.z, b.pos.z, 0.35);
            speed = 3.9;
          }
        }
        p.target.set(tx, 0, tz);
      } else if (opponentHasBall) {
        if (!p.home) {
          // away side in possession: closest man presses, others hold shape
          const nearest = this._nearestOpponentToBall();
          if (nearest === p) {
            tx = b.pos.x;
            tz = b.pos.z;
            speed = 4.5;
          } else {
            tx = lerp(p.base.x, b.pos.x, 0.3);
            tz = lerp(p.base.z, b.pos.z, 0.3);
            speed = 3.7;
          }
        } else {
          // home side: nearest outfielder hunts the ball, the rest drop and mark
          const chaser = this._closestOf(this.teammates.filter((t) => t.role !== 'gk'), b.pos);
          if (chaser === p) {
            tx = b.pos.x;
            tz = b.pos.z;
            speed = 5.5;
          } else {
            tx = lerp(p.base.x, b.pos.x, 0.55);
            tz = lerp(p.base.z, b.pos.z, 0.45);
            speed = 4.4;
          }
        }
        p.target.set(tx, 0, tz);
      } else {
        // loose ball: closest players chase
        const all = [...this.teammates, ...this.opponents].filter((o) => o.role !== 'gk');
        const sorted = all
          .slice()
          .sort(
            (a1, a2) =>
              a1.avatar.group.position.distanceTo(b.pos) - a2.avatar.group.position.distanceTo(b.pos)
          );
        const rank = sorted.indexOf(p);
        if (rank === 0 || (rank === 1 && Math.random() < 0.5)) {
          tx = b.pos.x;
          tz = b.pos.z;
          speed = 5.4;
        } else {
          tx = lerp(p.base.x, b.pos.x, 0.25);
          tz = lerp(p.base.z, b.pos.z, 0.25);
          speed = 3.6;
        }
        p.target.set(tx, 0, tz);
      }

      const dir = new THREE.Vector3(p.target.x - g.position.x, 0, p.target.z - g.position.z);
      const d = dir.length();
      if (d > 0.25) {
        dir.divideScalar(d);
        const sp = Math.min(speed, d * 3.2);
        g.position.x = clamp(g.position.x + dir.x * sp * dt, -PITCH.halfW - 3, PITCH.halfW + 3);
        g.position.z = clamp(g.position.z + dir.z * sp * dt, -PITCH.halfL - 3, PITCH.halfL + 3);
        const want = Math.atan2(-dir.x, -dir.z);
        g.rotation.y += angleDelta(g.rotation.y, want) * Math.min(1, dt * 9);
        p.speed = sp;
      } else {
        p.speed = damp(p.speed, 0, 8, dt);
      }
      p.avatar.animate(this.time + p.base.x, p.speed);
    });

    // AI defenders press the carrier and can win it back
    if (b.owner && !b.owner.isUser) {
      const holder = b.owner;
      const defenders = (holder.home ? this.opponents : this.teammates).filter((d) => d.role !== 'gk');
      for (const d of defenders) {
        const dg = d.avatar.group.position;
        if (dist2(dg.x, dg.z, holder.avatar.group.position.x, holder.avatar.group.position.z) < 1.25) {
          if (Math.random() < dt * 1.15) {
            b.owner = d;
            b.lastTouch = d;
            d.cool = rand(0.5, 1.2);
            audio.kick(0.5);
            break;
          }
        }
      }
    }

    // AI on the ball: shoot or pass occasionally
    if (b.owner && !b.owner.home && !b.owner.isUser) {
      const holder = b.owner;
      holder.cool -= dt;
      // pressing them can knock the ball loose
      const pressD = holder.avatar.group.position.distanceTo(this.me.pos);
      if (pressD < 0.95 && Math.random() < dt * 0.8) {
        this.ball.owner = null;
        const away = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize();
        this.ball.vel.set(away.x * 5.5, 2.4, away.z * 5.5);
        this.stats.tackles++;
        this._flash('NICKED IT OFF HIM!', 1.1);
        audio.kick(0.7);
        return;
      }
      if (holder.cool <= 0) {
        holder.cool = rand(0.8, 1.8);
        const g = holder.avatar.group.position;
        const goalZ = holder.home ? -PITCH.halfL : PITCH.halfL;
        const goalDist = Math.abs(goalZ - g.z);
        // attackers let fly as soon as they are within range instead of walking it in
        const shootOdds = holder.home
          ? 0.12
          : goalDist < 10
          ? 0.62
          : goalDist < 18
          ? 0.44
          : goalDist < 26
          ? 0.3
          : 0.12;
        if (goalDist < 27 && Math.random() < shootOdds) {
          this._aiShoot(holder);
        } else if (Math.random() < 0.55) {
          this._aiPass(holder);
        }
      }
    }
    if (b.owner && b.owner.home && !b.owner.isUser) {
      const holder = b.owner;
      holder.cool -= dt;
      if (holder.cool <= 0) {
        holder.cool = rand(1.0, 2.0);
        const meDist = holder.avatar.group.position.distanceTo(this.me.pos);
        if (meDist < 26 && Math.random() < 0.6) {
          this._passToMe(holder);
        } else if (Math.random() < 0.6) {
          this._aiPass(holder);
        } else {
          this._aiShoot(holder);
        }
      }
    }
  }

  _aiShoot(holder) {
    const g = holder.avatar.group.position;
    const targetZ = holder.home ? -PITCH.halfL : PITCH.halfL;
    // aim for the far corner of the mouth rather than dead centre
    const wild = Math.random() < 0.16;
    const gkX = clamp(this.keeper ? this.keeper.avatar.group.position.x : 0, -2.6, 2.6);
    // shoot for whichever side of the goal the keeper has left open
    const side = gkX > 0 ? -1 : 1;
    const aimX = clamp(gkX + side * rand(1.9, 3.2), -PITCH.goalW / 2 + 0.5, PITCH.goalW / 2 - 0.5);
    const to = new THREE.Vector3(aimX - g.x, 0, targetZ - g.z);
    const dist = to.length();
    to.normalize();
    this.ball.owner = null;
    this.ball.lastTouch = holder;
    const power = clamp(10 + dist * 0.30, 11, 18) * (wild ? rand(1.1, 1.3) : 1);
    const lift = clamp(0.9 + dist * 0.09, 1.0, 3.0) * (wild ? rand(1.6, 2.8) : 1);
    this.ball.vel.set(to.x * power, lift, to.z * power);
    audio.kick(0.8);
    if (this.onEvent && Math.abs(g.z - targetZ) < 26) this.onEvent({ type: 'shot' });
    holder.cool = rand(1.4, 2.6);
  }

  _aiPass(holder) {
    const mates = (holder.home ? this.teammates : this.opponents).filter(
      (m) => m !== holder && m.role !== 'gk'
    );
    if (!mates.length) return this._aiShoot(holder);
    const mate = mates[Math.floor(Math.random() * mates.length)];
    const g = holder.avatar.group.position;
    const to = new THREE.Vector3(
      mate.avatar.group.position.x - g.x,
      0,
      mate.avatar.group.position.z - g.z
    );
    const len = to.length() || 1;
    to.divideScalar(len);
    this.ball.owner = null;
    this.ball.lastTouch = holder;
    const power = clamp(len * 0.72, 8, 19);
    this.ball.vel.set(to.x * power, 1.1, to.z * power);
    mate.receive = 1.1;
    audio.kick(0.35);
  }

  _checkBallTouches(dt = 0.016) {
    const b = this.ball;
    if (b.owner) return;
    if (b.pos.y > 1.05) return; // over everyone's head

    // user control
    const dMe = dist2(b.pos.x, b.pos.z, this.me.pos.x, this.me.pos.z);
    if (dMe < 1.45 && this.time - (this._lastPickup || 0) > 0.3) {
      const speed = Math.hypot(b.vel.x, b.vel.z);
      if (speed < 13.5) {
        b.owner = this.me;
        b.lastTouch = this.me;
        this._lastPickup = this.time;
        if (this.shotFrom && this.shotFrom.distanceTo(this.me.pos) > 6) {
          // collected a rebound
        }
        this._flash('ON THE BALL', 0.8);
      }
    }

    // AI control
    this.avatars.forEach((p) => {
      const g = p.avatar.group.position;
      const d = dist2(b.pos.x, b.pos.z, g.x, g.z);
      const isKeeper = p.role === 'gk';
      const reach = isKeeper ? 2.0 : 0.95;
      if (isKeeper) p.avatar.group.scale.setScalar(1);
      if (d >= reach) return;

      const speed = Math.hypot(b.vel.x, b.vel.z);
      const goalZ = p.home ? PITCH.halfL : -PITCH.halfL;
      const canSave = this.time - (p.lastSave || -9) > 2.2;
      const nearMouth = Math.abs(b.pos.x) < PITCH.goalW * 0.85;
      const inLine = Math.abs(b.pos.x - g.x) < 1.9;
      if (isKeeper && speed > 8 && nearMouth && inLine && canSave && Math.random() < 0.55) {
        p.lastSave = this.time;
        // parry it back into play
        const towardField = new THREE.Vector3(
          rand(-0.6, 0.6),
          0,
          Math.sign(-goalZ)
        ).normalize();
        b.vel.set(towardField.x * rand(7, 12), rand(3, 5.5), towardField.z * rand(7, 12));
        b.pos.y = Math.max(b.pos.y, 0.7);
        audio.bounce(1);
        if (p.home) {
          this.stats.saves++;
          this._flash('SAVED BY ' + shortName(p.name) + '!', 1.6);
        } else {
          this._flash('KEEPER DENIES YOU', 1.5);
        }
        this.onEvent({ type: 'save' });
        return;
      }
      const catching = speed < 9.5 || (p.receive || 0) > 0;
      if (catching && (p.receive || 0) > 0) {
        b.owner = p;
        b.lastTouch = p;
        p.cool = rand(0.7, 1.6);
        p.receive = 0;
      } else if (catching && speed < 9.5 && Math.random() < dt * 6.5) {
        b.owner = p;
        b.lastTouch = p;
        p.cool = rand(0.7, 1.6);
      }
    });
  }

  _checkGoal() {
    const b = this.ball;
    if (b.pos.y > PITCH.goalH - 0.05) {
      this.ballCrossed = false;
      return;
    }
    const { goalW } = PITCH;
    const within = Math.abs(b.pos.x) < goalW / 2 - 0.1;

    // the ball can travel far in one frame, so test the whole step it just took
    const prevZ = b.prevZ ?? b.pos.z;
    const line = PITCH.halfL - 0.1;
    const crossed = within && ((prevZ > -line && b.pos.z <= -line) || (prevZ < line && b.pos.z >= line));
    b.prevZ = b.pos.z;
    if (!crossed) return;
    if (!within) return;

    const z = b.pos.z;
    const homeScored = z < 0;
    if (homeScored) {
      this.score.home++;
      this.stats.goals++;
    } else {
      this.score.away++;
    }
    audio.goal();
    this.bannerTimer = 3;
    this.banner = homeScored ? 'G O A L !  ' + this.homeTeam.name.toUpperCase() : 'CONCEDED';
    this.onScore({ ...this.score, homeScored });
    this.onEvent({ type: 'goal', homeScored, text: this.banner });
    this._resetPositions(homeScored ? 1 : -1);
  }

  _resetPositions(kickoffDir = 1) {
    this.ball.reset(0, 0);
    this.me.pos.set(0, 0, PITCH.halfL * 0.3);
    this.yaw = Math.PI;
    this.pitch = 0;
    this.teammates.forEach((p) => {
      p.avatar.group.position.set(p.base.x, 0, p.base.z);
      p.cool = rand(0.6, 1.4);
    });
    this.opponents.forEach((p) => {
      p.avatar.group.position.set(p.base.x, 0, p.base.z);
      p.cool = rand(0.6, 1.4);
    });
  }

  _updateCamera(dt) {
    const me = this.me;
    const speed = me.speed;
    const bobAmp = 0.035 + Math.min(speed / 9, 1) * 0.06;
    const bob = Math.sin(this.time * (7 + speed * 0.8)) * bobAmp;
    const eyeY = 1.66 + bob;
    const fwd = this._forwardVector();
    this.camera.position.set(me.pos.x - fwd.x * 0.12, eyeY, me.pos.z - fwd.z * 0.12);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = Math.sin(this.time * 4.2) * 0.012 * Math.min(speed / 6, 1);
    this.camera.fov = lerp(this.camera.fov, 72 + (this.skillBoost > 0 ? 10 : 0), 0.1);
    this.camera.updateProjectionMatrix();
  }

  getHUD() {
    const me = this.me;
    const b = this.ball;
    return {
      score: this.score,
      homeTeam: this.homeTeam,
      awayTeam: this.awayTeam,
      homeName: this.homeName,
      timeLeft: this.timeLeft,
      clock: fmtTime(this.timeLeft),
      stamina: me.stamina,
      hasBall: b.owner === me,
      charge: this.kickCharge,
      banner: this.banner,
      kickHint: b.owner === me ? 'HOLD & RELEASE' : dist2(b.pos.x, b.pos.z, me.pos.x, me.pos.z) < 2.3 ? 'TAP TO COLLECT' : 'GET TO THE BALL',
      paused: this.paused,
      finished: this.finished,
      staminaPct: Math.round(me.stamina * 100),
    };
  }

  _end() {
    if (this.finished) return;
    this.finished = true;
    audio.whistle();
    const result =
      this.score.home > this.score.away ? 'win' : this.score.home < this.score.away ? 'loss' : 'draw';
    this.onEnd({ ...this.score, result, stats: this.stats, homeName: this.homeName, awayName: this.awayName });
  }

  start() {
    this.running = true;
    audio.startCrowd();
    audio.whistle();
    this._flash(
      (this.practice ? 'PRACTICE · ' : 'KICK OFF · ') +
        this.homeTeam.name.toUpperCase() +
        (this.practice ? ' ON THE JUBILEE PITCH' : ' vs ' + this.awayTeam.name.toUpperCase()),
      3
    );
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

  attachInput(input) {
    this.input = input;
  }

  setPaused(v) {
    this.paused = v;
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

export function buildFootball(container, opts) {
  const g = new FootballGame(container, opts);
  return g;
}
