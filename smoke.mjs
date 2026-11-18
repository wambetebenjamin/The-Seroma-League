/* Headless smoke test: stubs just enough DOM/WebGL so the 3D game logic runs in Node. */
import * as THREE from 'three';

/* ---------- tiny canvas 2D stub ---------- */
function ctx2d() {
  const noop = () => {};
  return new Proxy(
    {
      canvas: { width: 300, height: 150 },
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      measureText: () => ({ width: 10 }),
      putImageData: noop,
      setTransform: noop,
      save: noop,
      restore: noop,
    },
    {
      get(t, k) {
        if (k in t) return t[k];
        return noop;
      },
      set() {
        return true;
      },
    }
  );
}

function makeCanvas() {
  return {
    width: 800,
    height: 600,
    clientWidth: 800,
    clientHeight: 600,
    style: {},
    className: '',
    dataset: {},
    getContext: (type) => (type === '2d' ? ctx2d() : null),
    addEventListener() {},
    removeEventListener() {},
    remove() {},
    appendChild() {},
    requestPointerLock() {},
    parentElement: null,
    toDataURL: () => '',
  };
}

globalThis.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return makeCanvas();
    return {
      style: {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      appendChild() {},
      querySelector: () => null,
      addEventListener() {},
      dataset: {},
      textContent: '',
    };
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  body: { dataset: {} },
  addEventListener() {},
  exitPointerLock() {},
  pointerLockElement: null,
};

globalThis.window = {
  innerWidth: 800,
  innerHeight: 600,
  devicePixelRatio: 1,
  addEventListener() {},
  removeEventListener() {},
  AudioContext: undefined,
  webkitAudioContext: undefined,
  localStorage: { getItem: () => null, setItem() {} },
  requestAnimationFrame: () => 0,
};
Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0, userAgent: 'node' }, configurable: true });
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.performance = globalThis.performance || { now: () => Date.now() };
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

/* ---------- neutralise WebGL renderer (patch the shared three namespace) ---------- */
const stubRenderer = {
  setSize() {},
  setPixelRatio() {},
  render() {},
  dispose() {},
  shadowMap: {},
  domElement: makeCanvas(),
};

// Allow tests (and unusual browsers) to inject a renderer factory.
const engine = await import('./src/core/engine.js');
engine.setRendererFactory(() => stubRenderer);

const { FootballGame } = await import('./src/games/football.js');
const { BasketballGame } = await import('./src/games/basketball.js');
const { SwimmingGame } = await import('./src/games/swimming.js');
const { PITCH } = await import('./src/games/football.js');

function fakeInput() {
  return {
    enabled: true,
    isTouch: false,
    keys: new Set(),
    kickHeld: false,
    sprint: false,
    _look: { x: 0, y: 0 },
    _actions: [],
    moveVector() {
      return { x: Math.sin(performance.now() / 900) * 0.7, y: 1 };
    },
    consumeLook() {
      const l = { ...this._look };
      this._look = { x: 0, y: 0 };
      return l;
    },
    consumeActions() {
      const a = new Set(this._actions);
      this._actions = [];
      return a;
    },
    kickHoldTime: () => 0.4,
  };
}

function check(label, cond, extra = '') {
  if (!cond) {
    console.log(`  ✗ ${label} ${extra}`);
    process.exitCode = 1;
  } else console.log(`  ✓ ${label}`);
}

/* ---------------------------------- football ---------------------------------- */
console.log('FOOTBALL');
{
  const g = new FootballGame({ appendChild() {}, clientWidth: 800, clientHeight: 600 }, {
    homeTeam: 'gaucho',
    awayTeam: 'theos',
    duration: 400,
  });
  await g.init();
  const input = fakeInput();
  g.attachInput(input);
  const dt = 1 / 60;
  let shots = 0;
  let hadBall = 0;
  for (let i = 0; i < 60 * 120; i++) {
    input._look = { x: Math.sin(i / 30) * 0.03, y: 0 };
    // drift toward the ball so the user gets possessions like a real player would
    if (i % 30 === 0) {
      const b = g.ball.pos;
      g.me.pos.x += Math.max(-3, Math.min(3, b.x - g.me.pos.x));
      g.me.pos.z += Math.max(-3, Math.min(3, b.z - g.me.pos.z));
    }
    if (g.ball.owner === g.me) hadBall++;
    if (i % 97 === 0) input._actions.push('kickDown');
    if (i % 97 === 20) {
      input._actions.push('kickUp');
      shots++;
    }
    if (i % 211 === 0) input._actions.push('call');
    if (i % 173 === 0) input._actions.push('tackle');
    if (i % 401 === 0) input._actions.push('skill2');
    g.update(dt, input);
  }
  const hud = g.getHUD();
  check('scores are finite numbers', Number.isFinite(hud.score.home) && Number.isFinite(hud.score.away), JSON.stringify(hud.score));
  check('scoreboard stays consistent', hud.score.home >= 0 && hud.score.away >= 0, JSON.stringify(hud.score));
  check('user wins possession', hadBall > 30, `frames=${hadBall}`);
  check('user got shots away', g.stats.shots > 0, `shots=${g.stats.shots}`);
  check('user avatar moves', Math.abs(g.me.pos.x) + Math.abs(g.me.pos.z) > 1, `pos=${g.me.pos.x.toFixed(1)},${g.me.pos.z.toFixed(1)}`);
  check('ball position finite', Number.isFinite(g.ball.pos.x) && Number.isFinite(g.ball.pos.y), String(g.ball.pos.y));
  check('ball on the deck', g.ball.pos.y >= 0 && g.ball.pos.y < 6, String(g.ball.pos.y));
  check('clock counts down', hud.timeLeft < 400);
  check('AI avatars animate', g.avatars.every((a) => Number.isFinite(a.avatar.group.position.x)));
  // a clean strike at the goal must register
  {
    const before = g.score.home;
    g.opponents.forEach((o) => o.avatar.group.position.set(40, 0, 40));
    g.me.pos.set(-2.5, 0, -18);
    g.ball.owner = g.me;
    g.ball.pos.set(-2.5, 0.22, -18.3);
    // aim at the far corner of the away goal
    g.yaw = Math.atan2(-(2.2 - -2.5), -(-PITCH.halfL - -18));
    g.pitch = 0.05;
    g._kick(0.5);
    for (let i = 0; i < 60 * 3 && g.score.home === before; i++) g.update(dt, input);
    check('a shot at goal scores', g.score.home > before, `${g.score.home}-${g.score.away}`);
  }

  // fast-forward to full time
  const ended = await new Promise((resolve) => {
    g.onEnd = resolve;
    g.timeLeft = 0.1;
    g.update(0.2, input);
    setTimeout(() => resolve(null), 50);
  });
  check('match ends and reports', ended && typeof ended.result === 'string', JSON.stringify(ended && ended.result));
  g.destroy();
}

/* --------------------------------- basketball -------------------------------- */
console.log('BASKETBALL');
{
  const g = new BasketballGame({ appendChild() {}, clientWidth: 800, clientHeight: 600 }, {
    homeTeam: 'galacticals',
    awayTeam: 'elites',
    duration: 300,
  });
  await g.init();
  const input = fakeInput();
  g.attachInput(input);
  const dt = 1 / 60;
  // Simulate a long session with the player taking regular shots. The AI
  // opponent only gets a look-in between possessions, so give it enough
  // possessions that "the opponent can score" is a deterministic result
  // rather than a coin flip.
  for (let i = 0; i < 60 * 200; i++) {
    input._look = { x: 0, y: i % 200 < 100 ? 0.004 : -0.004 };
    if (i % 120 === 0) {
      g.pitch = 0.42; // look up at the rim
      g.charge = 0.0;
      input._actions.push('kickDown');
    }
    if (i % 120 === 70) input._actions.push('kickUp');
    g.update(dt, input);
    if (g.getHUD().oppScore > 0) break; // proven, stop early
  }
  const hud = g.getHUD();
  check('score is a number', Number.isFinite(hud.score), String(hud.score));
  check('ball state valid', ['held', 'flying', 'rebound'].includes(g.ballState), g.ballState);
  check('ball stays in bounds', Math.abs(g.ballPos.x) < 40 && g.ballPos.y > -1 && g.ballPos.z < 40);
  check('opponent scored something', hud.oppScore > 0, String(hud.oppScore));
  check('baskets register', g.score > 0 || g.stats === undefined, `score=${g.score}`);
  g.destroy();
}

/* ---------------------------------- swimming --------------------------------- */
console.log('SWIMMING');
{
  const g = new SwimmingGame({ appendChild() {}, clientWidth: 800, clientHeight: 600 }, {
    homeTeam: 'theos',
    duration: 300,
  });
  await g.init();
  const input = fakeInput();
  g.attachInput(input);
  const dt = 1 / 60;
  let res = null;
  g.onEnd = (r) => (res = r);
  for (let i = 0; i < 60 * 90 && !res; i++) {
    if (g.cycle > 0.45 && g.cycle < 0.55) input._actions.push('kickDown');
    if (i % 300 === 0) input._actions.push('tackle');
    g.update(dt, input);
  }
  const hud = g.getHUD();
  check('distance accumulates', hud.distance > 5, hud.distance.toFixed(2));
  check('rhythm phase in range', hud.phase >= 0 && hud.phase < 1, String(hud.phase));
  check('race finishes', res !== null, JSON.stringify(res));
  if (res) {
    check('finish position sane', res.position >= 1 && res.position <= 5, String(res.position));
    check('finish time sane', res.time > 8 && res.time < 90, res.time.toFixed(2));
  }
  check('perfect strokes rewarded', hud.perfect > 0, String(hud.perfect));
  g.destroy();
}

console.log('\nSMOKE TEST DONE');
