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

export function fakeInput() {
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

export function check(label, cond, extra = '') {
  if (!cond) {
    console.log(`  ✗ ${label} ${extra}`);
    process.exitCode = 1;
  } else console.log(`  ✓ ${label}`);
}


export { stubRenderer };
