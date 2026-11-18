/**
 * Unified input: keyboard + mouse (desktop) and touch (mobile).
 * Touch layout: left thumb = move stick, right thumb = look, both drawn in the HUD.
 */
export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };      // -1..1, x = right, y = forward
    this.look = { x: 0, y: 0 };      // accumulated delta since last consume
    this.sprint = false;
    this.kickHeld = false;
    this.kickPressedAt = 0;
    this.kickReleased = false;
    this.actions = new Set();        // one-shot actions consumed by the game
    this.enabled = true;
    this.isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 1;

    this._bind();
  }

  _bind() {
    const onKeyDown = (e) => {
      if (!this.enabled) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprint = true;
      if (e.code === 'Space') this.actions.add('call');
      if (e.code === 'KeyC') this.actions.add('tackle');
      if (e.code === 'KeyF' || e.code === 'KeyE') this._pressKick();
      if (e.code === 'Digit1') this.actions.add('skill1');
      if (e.code === 'Digit2') this.actions.add('skill2');
      if (e.code === 'Digit3') this.actions.add('skill3');
      if (e.code === 'Escape' || e.code === 'KeyP') this.actions.add('pause');
      if (e.code === 'KeyR') this.actions.add('primary');
    };
    const onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprint = false;
      if (e.code === 'KeyF' || e.code === 'KeyE') this._releaseKick();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Mouse look (pointer lock on click for desktop)
    this.dom.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.isTouch) return;
      if (e.button === 0) this._pressKick();
      if (e.button === 2) this.actions.add('lookback');
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._releaseKick();
    });
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());
    let dragging = false;
    this.dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) dragging = true;
    });
    window.addEventListener('pointerup', () => {
      dragging = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      const locked = document.pointerLockElement === this.dom;
      if (locked || (dragging && !this.isTouch)) {
        this.look.x += e.movementX * 0.0024;
        this.look.y -= e.movementY * 0.0024;
      }
    });

    // Touch: two-zone virtual thumbsticks + buttons wired by the HUD
    this.dom.addEventListener(
      'touchstart',
      (e) => {
        if (!this.enabled) return;
        for (const t of e.changedTouches) this._touchStart(t);
      },
      { passive: true }
    );
    this.dom.addEventListener(
      'touchmove',
      (e) => {
        if (!this.enabled) return;
        for (const t of e.changedTouches) this._touchMove(t);
      },
      { passive: true }
    );
    const end = (e) => {
      for (const t of e.changedTouches) this._touchEnd(t);
    };
    this.dom.addEventListener('touchend', end, { passive: true });
    this.dom.addEventListener('touchcancel', end, { passive: true });

    this._touches = new Map();
    this.stickOrigin = null;
    this.stickId = null;
    this.lookId = null;
    this.lookLast = { x: 0, y: 0 };
  }

  _pressKick() {
    if (this.kickHeld) return;
    this.kickHeld = true;
    this.kickPressedAt = performance.now();
    this.actions.add('kickDown');
    this.pendingKick = true;
  }

  _releaseKick() {
    if (!this.kickHeld) return;
    this.kickHeld = false;
    this.kickReleased = true;
    this.actions.add('kickUp');
    this.pendingKick = false;
  }

  _touchStart(t) {
    const w = window.innerWidth;
    const inStickZone = t.clientX < w * 0.45;
    if (inStickZone && this.stickId === null) {
      this.stickId = t.identifier;
      this.stickOrigin = { x: t.clientX, y: t.clientY };
      this.move.x = 0;
      this.move.y = 0;
    } else if (this.lookId === null) {
      this.lookId = t.identifier;
      this.lookLast = { x: t.clientX, y: t.clientY };
    }
  }

  _touchMove(t) {
    if (t.identifier === this.stickId && this.stickOrigin) {
      const max = Math.min(72, window.innerWidth * 0.14);
      const dx = t.clientX - this.stickOrigin.x;
      const dy = t.clientY - this.stickOrigin.y;
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(len, max) / max;
      this.move.x = (dx / len) * k;
      this.move.y = (-dy / len) * k;
      this.sprint = k > 0.86;
      this.stickVis = { x: this.stickOrigin.x, y: this.stickOrigin.y, dx, dy, max };
    } else if (t.identifier === this.lookId) {
      this.look.x += (t.clientX - this.lookLast.x) * 0.0055;
      this.look.y -= (t.clientY - this.lookLast.y) * 0.0055;
      this.lookLast = { x: t.clientX, y: t.clientY };
    }
  }

  _touchEnd(t) {
    if (t.identifier === this.stickId) {
      this.stickId = null;
      this.stickOrigin = null;
      this.move.x = 0;
      this.move.y = 0;
      this.sprint = false;
      this.stickVis = null;
    }
    if (t.identifier === this.lookId) this.lookId = null;
  }

  /** Buttons call this from the HUD. */
  pressKick() {
    this._pressKick();
  }
  releaseKick() {
    this._releaseKick();
  }
  action(name) {
    this.actions.add(name);
  }
  resetPresses() {
    this.kickHeld = false;
    this.actions = new Set();
    this.look.x = 0;
    this.look.y = 0;
  }

  setMove(x, y) {
    this.move.x = x;
    this.move.y = y;
  }

  consumeActions() {
    const a = this.actions;
    this.actions = new Set();
    return a;
  }
  consumeLook() {
    const l = { x: this.look.x, y: this.look.y };
    this.look.x = 0;
    this.look.y = 0;
    return l;
  }
  kickHoldTime() {
    return this.kickHeld ? (performance.now() - this.kickPressedAt) / 1000 : 0;
  }

  /** Keyboard movement vector (normalised) when not using the touch stick. */
  moveVector() {
    if (this.isTouch) return this.move;
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  destroy() {
    this.enabled = false;
    if (document.pointerLockElement === this.dom) document.exitPointerLock?.();
  }
}
