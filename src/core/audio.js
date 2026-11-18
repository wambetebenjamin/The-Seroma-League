/* Tiny WebAudio sound kit — no asset downloads, works offline. */
let ctx = null;
let master = null;
let enabled = true;
let crowdGain = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const audio = {
  unlock() {
    ac();
  },
  get enabled() {
    return enabled;
  },
  setEnabled(v) {
    enabled = v;
    if (master) master.gain.value = v ? 0.5 : 0;
    if (!v) this.stopCrowd();
  },
  tone({ freq = 440, dur = 0.14, type = 'sine', gain = 0.2, slide = 0, delay = 0 }) {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  },
  kick(power = 0.7) {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const dur = 0.1;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900 + power * 1400;
    const g = c.createGain();
    g.gain.value = 0.25 + power * 0.5;
    src.connect(f).connect(g).connect(master);
    src.start();
    this.tone({ freq: 120, dur: 0.09, type: 'triangle', gain: 0.18 + power * 0.2, slide: -60 });
  },
  bounce(v = 0.5) {
    this.tone({ freq: 210 + v * 90, dur: 0.07, type: 'triangle', gain: 0.07 + v * 0.08, slide: -80 });
  },
  whistle() {
    this.tone({ freq: 2100, dur: 0.16, type: 'square', gain: 0.05 });
    this.tone({ freq: 2600, dur: 0.16, type: 'square', gain: 0.045, delay: 0.02 });
  },
  goal() {
    if (!enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'square', gain: 0.11, delay: i * 0.09 }));
    this.roar(1);
  },
  buzzer() {
    this.tone({ freq: 150, dur: 0.5, type: 'sawtooth', gain: 0.12, slide: -40 });
  },
  swish() {
    this.tone({ freq: 900, dur: 0.18, type: 'sine', gain: 0.09, slide: -500 });
    this.tone({ freq: 2600, dur: 0.1, type: 'sine', gain: 0.05, delay: 0.06 });
  },
  splash() {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const dur = 0.35;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = c.createGain();
    g.gain.value = 0.3;
    src.connect(f).connect(g).connect(master);
    src.start();
  },
  heartbeat() {
    this.tone({ freq: 62, dur: 0.16, type: 'sine', gain: 0.25 });
    this.tone({ freq: 54, dur: 0.16, type: 'sine', gain: 0.18, delay: 0.2 });
  },
  click() {
    this.tone({ freq: 620, dur: 0.05, type: 'sine', gain: 0.09 });
  },
  /** Continuous stadium ambience. */
  startCrowd() {
    if (!enabled) return;
    const c = ac();
    if (!c || crowdGain) return;
    const dur = 2;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 620;
    f.Q.value = 0.6;
    crowdGain = c.createGain();
    crowdGain.gain.value = 0;
    crowdGain.gain.linearRampToValueAtTime(0.06, c.currentTime + 2.5);
    src.connect(f).connect(crowdGain).connect(master);
    src.start();
    this._crowdSrc = src;
  },
  roar(amount = 1) {
    if (!crowdGain) return;
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
    crowdGain.gain.linearRampToValueAtTime(0.2 * amount, t + 0.25);
    crowdGain.gain.linearRampToValueAtTime(0.06, t + 3.2);
  },
  stopCrowd() {
    if (this._crowdSrc) {
      try {
        this._crowdSrc.stop();
      } catch (e) {
        /* ignore */
      }
      this._crowdSrc = null;
    }
    if (crowdGain) {
      crowdGain.disconnect();
      crowdGain = null;
    }
  },
};
