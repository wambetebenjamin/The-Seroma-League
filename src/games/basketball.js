/**
 * SEROMA SHOOTOUT — first-person 3x3 basketball on the Seroma court.
 * Drive to a spot, aim at the rim, hold to load the shot, release in the green.
 */
import * as THREE from 'three';
import {
  createRenderer,
  disposeScene,
  clamp,
  lerp,
  rand,
  dist2,
  fmtTime,
  IS_TOUCH,
} from '../core/engine.js';
import { makeCloudSky, makeRenderLights, applyRenderLook, addHills, addHedge } from '../core/style.js';
import { courtTexture, crowdTexture, bannerTexture, dirtTexture } from '../core/textures.js';
import {
  addTreeLine,
  addGrandstand,
  addPerimeterWall,
  addClassroomBlock,
  addSchoolSign,
  addPalm,
} from '../world/campus.js';
import { Avatar, makeNameTag, shortName } from '../world/players.js';
import { teamById, squadFor } from '../data/seroma.js';
import { audio } from '../core/audio.js';

const COURT = { halfW: 11, halfL: 14 };
const HOOP = { y: 3.05, r: 0.23, backboardZ: -12.4 };

export class BasketballGame {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    container.appendChild(this.canvas);
    this.renderer = createRenderer(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 600);
    this.homeTeam = teamById(opts.homeTeam || 'galacticals');
    this.awayTeam = teamById(opts.awayTeam || 'elites');
    this.homeName = opts.homePlayer || squadFor(this.homeTeam.id)[0];
    this.awayName = opts.awayPlayer || squadFor(this.awayTeam.id)[0];
    this.score = 0;
    this.oppScore = 0;
    this.streak = 0;
    this.best = Number(localStorage.getItem('seroma.bball.best') || 0);
    this.practice = !!opts.practice;
    this.timeLeft = opts.duration ?? (this.practice ? 3599 : 90);
    this.yaw = 0;
    this.pitch = 0;
    this.charge = 0;
    this.charging = false;
    this.ballState = 'held'; // held | flying | rebound
    this.banner = '';
    this.bannerTimer = 0;
    this.oppAttackTimer = rand(12, 18);
    this.onEvent = opts.onEvent || (() => {});
    this.onScore = opts.onScore || (() => {});
    this.onEnd = opts.onEnd || (() => {});
    this.running = false;
    this.finished = false;
    this.paused = false;
    this.tick = 0;
  }

  async init() {
    const scene = this.scene;
    scene.fog = new THREE.Fog(0xc4dcec, 80, 260);
    scene.add(makeCloudSky());
    this.lights = makeRenderLights(scene);
    this._buildCourt();
    this._spawnPlayers();
    this._buildBall();
    this._resize();
    this.ro = new ResizeObserver(() => this._resize());
    this.ro.observe(this.container);
  }

  _buildCourt() {
    const scene = this.scene;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ map: dirtTexture([18, 18]), color: 0xd08a5c, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const court = new THREE.Mesh(
      new THREE.PlaneGeometry(COURT.halfW * 2, COURT.halfL * 2),
      new THREE.MeshStandardMaterial({ map: courtTexture(), color: 0xffd9b8, roughness: 0.8 })
    );
    court.rotation.x = -Math.PI / 2;
    court.position.y = 0.02;
    court.receiveShadow = true;
    scene.add(court);

    addHills(scene, { radius: 170, count: 16 });
    addHedge(scene, 0, -COURT.halfL - 3.5, { w: 22 });
    addHedge(scene, -COURT.halfW - 4, 0, { w: 18, rot: Math.PI / 2 });
    addHedge(scene, COURT.halfW + 4, 0, { w: 18, rot: Math.PI / 2 });

    // three point arc + key
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0.9 });
    const arc = new THREE.Mesh(new THREE.RingGeometry(6.4, 6.55, 48, 1, 0, Math.PI), lineMat);
    arc.rotation.x = -Math.PI / 2;
    arc.position.set(0, 0.05, -HOOP.backboardZ + 1.4);
    scene.add(arc);
    const key = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 5.2), new THREE.MeshStandardMaterial({ color: 0x1b6b9c, roughness: 1, transparent: true, opacity: 0.5 }));
    key.rotation.x = -Math.PI / 2;
    key.position.set(0, 0.045, -9.6);
    scene.add(key);

    // hoop: pole, backboard, rim, net
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 3.9, 10),
      new THREE.MeshStandardMaterial({ color: 0x30343a, metalness: 0.5, roughness: 0.5 })
    );
    pole.position.set(0, 1.95, HOOP.backboardZ - 1.1);
    scene.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.3), new THREE.MeshStandardMaterial({ color: 0x30343a, metalness: 0.5 }));
    arm.position.set(0, 3.55, HOOP.backboardZ - 0.5);
    scene.add(arm);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 2.0, 0.09),
      new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.3, metalness: 0.1 })
    );
    board.position.set(0, 3.35, HOOP.backboardZ);
    scene.add(board);
    const square = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xd1495b })
    );
    square.position.set(0, 3.2, HOOP.backboardZ + 0.06);
    scene.add(square);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(HOOP.r, 0.028, 8, 26),
      new THREE.MeshStandardMaterial({ color: 0xe4571f, metalness: 0.6, roughness: 0.4 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, HOOP.y, HOOP.backboardZ + 0.42);
    scene.add(rim);
    this.rimPos = new THREE.Vector3(0, HOOP.y, HOOP.backboardZ + 0.42);

    const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, wireframe: true });
    const net = new THREE.Mesh(new THREE.CylinderGeometry(HOOP.r, HOOP.r * 0.62, 0.42, 12, 3, true), netMat);
    net.position.set(0, HOOP.y - 0.22, HOOP.backboardZ + 0.42);
    scene.add(net);

    // surroundings
    addGrandstand(scene, 0, COURT.halfL + 10, Math.PI, 34, [this.homeTeam.colors.primary, '#f2f2f2']);
    addGrandstand(scene, -COURT.halfW - 10, 0, Math.PI / 2, 24, [this.awayTeam.colors.primary, '#2b2b2b']);
    addClassroomBlock(scene, 28, -18, { w: 24, d: 9, h: 6.4, rot: -0.5 });
    addClassroomBlock(scene, -30, 16, { w: 20, d: 8, h: 6, rot: 0.6, wall: 'cream' });
    addTreeLine(scene, 0, 0, 46, 22);
    addPerimeterWall(scene, 0, 0, 62);
    addSchoolSign(scene, 0, COURT.halfL + 20, Math.PI);
    addPalm(scene, COURT.halfW + 5, -6, 1.1);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.7),
      new THREE.MeshStandardMaterial({ map: bannerTexture('SEROMA COURT', '#c0392b', '#fff4d8', '3x3 SHOOTOUT'), roughness: 0.85 })
    );
    banner.position.set(0, 3.4, HOOP.backboardZ - 1.3);
    scene.add(banner);
  }

  _spawnPlayers() {
    this.defenders = [];
    const positions = [
      [-4.5, -7.4],
      [4.2, -8.6],
    ];
    positions.forEach((p, i) => {
      const name = squadFor(this.awayTeam.id, 4)[i + 1] || this.awayName;
      const a = new Avatar({ team: this.awayTeam, name, number: i + 4, sport: 'basketball' });
      a.setPosition(p[0], 0, p[1]);
      this.scene.add(a.group);
      const tag = makeNameTag(shortName(name), '#ffe8e8', 'rgba(90,12,20,.75)');
      tag.position.y = 2.1;
      a.group.add(tag);
      this.defenders.push({ avatar: a, base: new THREE.Vector3(p[0], 0, p[1]), speed: 0 });
    });
    this.me = { pos: new THREE.Vector3(0, 0, 2.5), speed: 0, stamina: 1 };
  }

  _buildBall() {
    const geo = new THREE.SphereGeometry(0.16, 18, 14);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#d9682a';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#20120a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 64);
    g.lineTo(128, 64);
    g.moveTo(64, 0);
    g.lineTo(64, 128);
    g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.ball = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    this.ball.castShadow = true;
    this.scene.add(this.ball);
    this.ballPos = new THREE.Vector3(0.35, 1.25, 2.0);
    this.ballVel = new THREE.Vector3();
    this.ballMeshY = 0;
    this.lastRimTime = 0;
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
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy, -0.9, 0.85);
  }

  onAction(name) {
    if (this.paused || this.finished) return;
    if (name === 'kickDown') {
      this.charging = true;
      this.charge = 0;
    } else if (name === 'kickUp') {
      if (this.charging) this._shoot();
      this.charging = false;
    } else if (name === 'call') {
      this._flash('BALL IN YOUR HANDS');
    } else if (name === 'tackle') {
      this._flash('DEFENCE: BOX OUT');
    }
  }

  _shake(amount) {
    this.shakeAmt = amount;
  }

  _flash(text, secs = 1.6) {
    this.banner = text;
    this.bannerTimer = secs;
    this.onEvent({ type: 'banner', text });
  }

  /** While charging, gently pull the crosshair onto the rim so touch aiming is fair. */
  _aimAssist(dt) {
    const dx = this.rimPos.x - this.me.pos.x;
    const dz = this.rimPos.z - this.me.pos.z;
    const wantYaw = Math.atan2(-dx, -dz);
    const horiz = Math.hypot(dx, dz);
    const wantPitch = Math.atan2(this.rimPos.y - 1.2, horiz) * 0.62;
    let dy = (wantYaw - this.yaw) % (Math.PI * 2);
    if (dy > Math.PI) dy -= Math.PI * 2;
    if (dy < -Math.PI) dy += Math.PI * 2;
    if (Math.abs(dy) < 0.4) this.yaw += dy * Math.min(1, dt * 2.2);
    if (Math.abs(wantPitch - this.pitch) < 0.35) {
      this.pitch += (wantPitch - this.pitch) * Math.min(1, dt * 2.0);
    }
  }

  _forwardVector() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  _aimDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    return dir.normalize();
  }

  _shoot() {
    if (this.ballState !== 'held') return;
    const power = clamp(this.charge / 1.05, 0.12, 1.2);
    const dist = this.me.pos.distanceTo(this.rimPos);
    // ideal power rises with distance; releasing inside the band is a clean shot
    const ideal = clamp(0.34 + dist * 0.052, 0.36, 1.02);
    const accuracy = clamp(1 - Math.abs(power - ideal) * 1.35, 0, 1);
    const inGreen = Math.abs(power - ideal) < 0.11;

    const start = new THREE.Vector3(
      this.me.pos.x + 0.3,
      1.2,
      this.me.pos.z - 0.3
    );
    this.ballPos.copy(start);
    const target = new THREE.Vector3(0, HOOP.y + 0.16, this.rimPos.z);
    if (inGreen) {
      target.x += (Math.random() - 0.5) * 0.12;
      target.z += (Math.random() - 0.5) * 0.12;
    } else {
      // a rushed or over-cooked release drifts long/short as well as sideways
      // overshooting sends it LONG (past the rim), undershooting leaves it SHORT
      // overshooting sends it LONG (past the rim), undershooting leaves it SHORT
      const longBy = power - ideal;
      const rimDir = new THREE.Vector3(this.rimPos.x - this.me.pos.x, 0, this.rimPos.z - this.me.pos.z);
      if (rimDir.lengthSq() < 0.01) rimDir.set(0, 0, -1);
      rimDir.normalize();
      target.addScaledVector(rimDir, longBy * 7.5);
      target.x += (Math.random() - 0.5) * (1.4 - accuracy) * 2.0;
    }
    // ballistic solve: pick a flight time so the arc peaks nicely above the rim
    const horiz = Math.hypot(target.x - start.x, target.z - start.z) || 1;
    const airtime = clamp(0.86 + horiz * 0.045, 0.95, 1.7);
    this.ballVel.set(
      (target.x - start.x) / airtime,
      5.6 + horiz * 0.42,
      (target.z - start.z) / airtime
    );
    // the rim sits above the release, so the arc has to clear it
    this.ballVel.y = (target.y - start.y) / airtime + 0.5 * 12.5 * airtime;

    this.ballState = 'flying';
    this.shotClock = 0;
    this.shotResolved = false;
    this.scoredThisShot = false;
    this.shotInGreen = inGreen;
    this.shotAccuracy = accuracy;
    this.shotDist = dist;
    this.shotWasThree = !this._insideArc(this.me.pos);
    this.shotOrigin = this.me.pos.clone();
    this.ballHitRim = false;
    audio.tone({ freq: 420, dur: 0.08, type: 'triangle', gain: 0.1, slide: 260 });
  }

  _insideArc(pos) {
    return dist2(pos.x, pos.z, 0, HOOP.backboardZ + 1.4) < 6.4;
  }

  update(dt, input) {
    if (this.paused || this.finished) return;
    this.tick += dt;
    if (!this.practice) this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner = '';
    }

    const look = input.consumeLook();
    if (look.x || look.y) this.onLook(look.x * 1.6, look.y * 1.6);
    input.consumeActions().forEach((a) => this.onAction(a));

    if (this.charging && this.ballState === 'held') {
      this.charge = Math.min(1.2, this.charge + dt);
      this._aimAssist(dt);
    }

    // movement
    const mv = input.moveVector();
    const fwd = this._forwardVector();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3().addScaledVector(fwd, mv.y).addScaledVector(right, mv.x);
    if (move.lengthSq() > 1) move.normalize();
    const speed = (input.sprint ? 6.6 : 4.9) * (this.ballState === 'held' ? 0.92 : 1.15);
    this.me.pos.addScaledVector(move, speed * dt);
    this.me.pos.x = clamp(this.me.pos.x, -COURT.halfW + 0.6, COURT.halfW - 0.6);
    this.me.pos.z = clamp(this.me.pos.z, HOOP.backboardZ + 1.8, COURT.halfL - 1);
    this.me.speed = move.length() * speed;

    this._updateBall(dt);
    this._updateDefenders(dt);
    if (!this.practice) this._updateOpponentScoring(dt);
    this._updateCamera(dt);

    if (!this.practice && this.timeLeft <= 0) this._end();
    this.renderer.render(this.scene, this.camera);
  }

  _updateBall(dt) {
    if (this.ballState === 'held') {
      const p = this.ballPos;
      const target = new THREE.Vector3(
        this.me.pos.x + 0.42,
        1.18 + Math.sin(this.tick * 4) * 0.03,
        this.me.pos.z + 0.18
      );
      p.lerp(target, Math.min(1, dt * 18));
      this.ball.position.copy(p);
      this.ball.rotation.x += dt * 2;
      return;
    }

    // flying / rebound physics
    this.ballVel.y -= 12.5 * dt;
    this.ballPos.addScaledVector(this.ballVel, dt);

    // rim collision
    const rim = this.rimPos;
    const dRim = Math.hypot(this.ballPos.x - rim.x, this.ballPos.z - rim.z);
    const nearRimY = Math.abs(this.ballPos.y - rim.y);
    if (dRim < HOOP.r + 0.12 && nearRimY < 0.16) {
      const wasAbove = this.ballVel.y < 0;
      if (dRim < HOOP.r - 0.03 && wasAbove && !this.ballHitRim && this.ballPos.y > rim.y - 0.06) {
        this._scoreBasket();
      } else if (!this.ballHitRim) {
        this.ballHitRim = true;
        this.ballVel.y *= -0.45;
        this.ballVel.x += (this.ballPos.x - rim.x) * 4;
        this.ballVel.z += (this.ballPos.z - rim.z) * 4;
        audio.tone({ freq: 300, dur: 0.1, type: 'square', gain: 0.08 });
      }
    }

    // backboard
    if (
      Math.abs(this.ballPos.x) < 1.7 &&
      Math.abs(this.ballPos.y - 3.35) < 1.0 &&
      this.ballPos.z < HOOP.backboardZ + 0.14 &&
      this.ballPos.z > HOOP.backboardZ - 0.3
    ) {
      this.ballPos.z = HOOP.backboardZ + 0.14;
      this.ballVel.z = Math.abs(this.ballVel.z) * 0.5;
      audio.tone({ freq: 190, dur: 0.09, type: 'triangle', gain: 0.1 });
    }

    // floor
    if (this.ballPos.y <= 0.16) {
      this.ballPos.y = 0.16;
      if (this.ballVel.y < -0.6) {
        this.ballVel.y = -this.ballVel.y * 0.66;
        audio.bounce(clamp(Math.abs(this.ballVel.y) / 8, 0, 1));
      } else {
        this.ballVel.y = 0;
      }
      this.ballVel.x *= 0.94;
      this.ballVel.z *= 0.94;
    }
    this.ball.position.copy(this.ballPos);
    this.ball.rotation.x -= this.ballVel.z * dt * 3;
    this.ball.rotation.z += this.ballVel.x * dt * 3;

    // resolve the possession
    if (this.ballState === 'flying') {
      this.shotClock = (this.shotClock || 0) + dt;
      if (!this.shotResolved && this.shotClock > 0.8) {
        const settled = this.ballPos.y < 0.45 && Math.hypot(this.ballVel.x, this.ballVel.z) < 3;
        if (settled) {
          this.shotResolved = true;
          this.ballState = 'rebound';
          if (!this.scoredThisShot) {
            this.streak = 0;
            this._flash('MISSED · GRAB THE REBOUND', 1.4);
          }
        }
      }
      // safety valve so play never stalls
      if (this.shotClock > 6) {
        this.ballState = 'held';
        this.ballPos.set(this.me.pos.x + 0.4, 1.2, this.me.pos.z);
        this.ballVel.set(0, 0, 0);
        this.shotResolved = false;
        this.scoredThisShot = false;
      }
    }

    if (this.ballState === 'rebound') {
      const d = dist2(this.ballPos.x, this.ballPos.z, this.me.pos.x, this.me.pos.z);
      if (d < 1.5) {
        this.ballState = 'held';
        this.charge = 0;
        this.scoredThisShot = false;
        this.shotResolved = false;
        audio.tone({ freq: 520, dur: 0.07, type: 'sine', gain: 0.08 });
      }
    }
  }

  _scoreBasket() {
    this.scoredThisShot = true;
    const three = this.shotWasThree;
    const green = this.shotInGreen;
    const pts = (three ? 3 : 2) + (green ? 1 : 0);
    this.score += pts;
    this.streak++;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem('seroma.bball.best', String(this.best));
    }
    audio.swish();
    audio.roar(0.7);
    this._flash((green ? 'SWISH! +' : 'BUCKET! +') + pts + (three ? ' (3PT)' : ''), 1.8);
    this.onScore({ score: this.score, oppScore: this.oppScore, pts, green, three });
    this.onEvent({ type: 'basket', pts });
    this.ballState = 'flying';
    this.ballVel.y = -2;
    this.ballPos.y = HOOP.y - 0.4;
    setTimeout(() => {
      if (!this.finished) {
        this.ballState = 'held';
        this.ballPos.set(this.me.pos.x, 1.2, this.me.pos.z);
        this.shotResolved = false;
        this.scoredThisShot = false;
      }
    }, 700);
  }

  _updateDefenders(dt) {
    this.defenders.forEach((d, i) => {
      const g = d.avatar.group;
      const offset = i === 0 ? 1.8 : -1.9;
      const tx = clamp(this.me.pos.x + offset, -COURT.halfW, COURT.halfW);
      const tz = clamp(this.me.pos.z - 1.9, HOOP.backboardZ + 2.5, COURT.halfL);
      const dir = new THREE.Vector3(tx - g.position.x, 0, tz - g.position.z);
      const len = dir.length();
      if (len > 0.2) {
        dir.divideScalar(len);
        const sp = Math.min(3.5, len * 2.2);
        g.position.x += dir.x * sp * dt;
        g.position.z += dir.z * sp * dt;
        g.rotation.y += (Math.atan2(-dir.x, -dir.z) - g.rotation.y) * Math.min(1, dt * 8);
        d.speed = sp;
      } else d.speed = 0;
      d.avatar.animate(this.tick + i * 3, d.speed);
      if (i === 0 && g.position.distanceTo(this.me.pos) < 2.4 && this.ballState === 'held') {
        this.charge = Math.max(0, this.charge - dt * 0.45);
      }
    });
  }

  _updateOpponentScoring(dt) {
    this.oppAttackTimer -= dt;
    if (this.oppAttackTimer <= 0) {
      this.oppAttackTimer = rand(16, 26);
      const scores = Math.random() < 0.62;
      if (scores) {
        this.oppScore += Math.random() < 0.35 ? 3 : 2;
        audio.buzzer();
        this._flash(this.awayTeam.name.toUpperCase() + ' SCORES ON THE OTHER RIM', 2);
      }
      this.onScore({ score: this.score, oppScore: this.oppScore, pts: 0 });
    }
  }

  _updateCamera(dt) {
    const bob = Math.sin(this.tick * (7 + this.me.speed)) * 0.03;
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(this.me.pos.x, 1.68 + bob + Math.max(0, this.pitch) * 0.12, this.me.pos.z);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    const shake = this.shakeAmt || 0;
    if (shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * shake * 0.1;
      this.camera.scale.setScalar(1 + shake * 0.02);
      this.shakeAmt = Math.max(0, shake - dt * 3);
    } else this.camera.scale.setScalar(1);
  }

  _end() {
    if (this.finished) return;
    this.finished = true;
    audio.buzzer();
    this.onEnd({
      score: this.score,
      oppScore: this.oppScore,
      best: this.best,
      result: this.score > this.oppScore ? 'win' : this.score === this.oppScore ? 'draw' : 'loss',
      homeName: this.homeName,
      awayName: this.awayName,
    });
  }

  getHUD() {
    const dist = this.me.pos.distanceTo(this.rimPos);
    const ideal = clamp(0.34 + dist * 0.052, 0.36, 1.02);
    return {
      score: this.score,
      oppScore: this.oppScore,
      best: this.best,
      homeTeam: this.homeTeam,
      awayTeam: this.awayTeam,
      homeName: this.homeName,
      timeLeft: this.timeLeft,
      clock: fmtTime(this.timeLeft),
      charge: this.charge,
      ideal,
      charging: this.charging,
      hasBall: this.ballState === 'held',
      three: !this._insideArc(this.me.pos),
      streak: this.streak,
      banner: this.banner,
      distance: dist,
      kickHint:
        this.ballState === 'held'
          ? 'AIM AT THE RIM · HOLD TO LOAD · RELEASE IN THE GREEN'
          : this.ballState === 'rebound'
          ? 'CHASE THE REBOUND'
          : 'SHOT IS IN THE AIR',
    };
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
    this._flash('TIP OFF · ' + this.homeTeam.name.toUpperCase() + ' vs ' + this.awayTeam.name.toUpperCase(), 2.6);
    this.last = performance.now();
    this.ballStateSince = 0;
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
      this.last = now;
      this.ballStateSince += dt;
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
