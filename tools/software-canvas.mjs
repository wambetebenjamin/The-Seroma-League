/**
 * A tiny software canvas used only for previewing illustrations offline.
 *
 * The sandbox has no GPU and cannot download a browser, so this implements the
 * slice of the Canvas2D API that `src/ui/portrait.js` uses: paths, gradients,
 * transforms, alpha, strokes and fills. Rendering goes to PNG via zlib so the
 * drawings can be looked at and iterated on rather than guessed at.
 *
 * Not shipped to the browser; only tools/portrait-preview.mjs imports it.
 */
import zlib from 'node:zlib';
import fs from 'node:fs';

const flattenPath = (cmds) => {
  // -> array of subpaths, each an array of [x, y]
  const out = [];
  let cur = null;
  let pt = [0, 0];
  let start = [0, 0];
  const push = (p) => {
    if (!cur) {
      cur = [p];
      out.push(cur);
    } else cur.push(p);
    pt = p;
  };
  for (const c of cmds) {
    if (c.t === 'm') {
      cur = null;
      start = [c.x, c.y];
      pt = start;
      push([c.x, c.y]);
    } else if (c.t === 'l') push([c.x, c.y]);
    else if (c.t === 'q') {
      const [x0, y0] = pt;
      const n = 10;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const mt = 1 - t;
        push([
          mt * mt * x0 + 2 * mt * t * c.x1 + t * t * c.x,
          mt * mt * y0 + 2 * mt * t * c.y1 + t * t * c.y,
        ]);
      }
    } else if (c.t === 'c') {
      const [x0, y0] = pt;
      const n = 14;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const mt = 1 - t;
        push([
          mt ** 3 * x0 + 3 * mt * mt * t * c.x1 + 3 * mt * t * t * c.x2 + t ** 3 * c.x,
          mt ** 3 * y0 + 3 * mt * mt * t * c.y1 + 3 * mt * t * t * c.y2 + t ** 3 * c.y,
        ]);
      }
    } else if (c.t === 'a') {
      // arc: cx cy r a0 a1
      const n = Math.max(8, Math.round(Math.abs(c.a1 - c.a0) * 8));
      for (let i = 0; i <= n; i++) {
        const a = c.a0 + ((c.a1 - c.a0) * i) / n;
        push([c.cx + Math.cos(a) * c.r, c.cy + Math.sin(a) * c.r]);
      }
    } else if (c.t === 'z') {
      if (cur && cur.length) cur.push(start);
      pt = start;
      cur = null;
    }
  }
  return out.filter((s) => s.length > 2);
};

function sampleStops(stops, t) {
  if (!stops.length) return [0, 0, 0, 1];
  if (t <= stops[0][0]) return stops[0][1];
  if (t >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    if (t >= p0 && t <= p1) {
      const u = p1 === p0 ? 0 : (t - p0) / (p1 - p0);
      return [
        c0[0] + (c1[0] - c0[0]) * u,
        c0[1] + (c1[1] - c0[1]) * u,
        c0[2] + (c1[2] - c0[2]) * u,
        c0[3] + (c1[3] - c0[3]) * u,
      ];
    }
  }
  return stops[stops.length - 1][1];
}

class Gradient {
  constructor(type, args, stops = []) {
    this.type = type;
    this.args = args;
    this.stops = stops;
    this.isGradient = true;
  }
  addColorStop(o, c) {
    this.stops.push([o, parseColor(c)]);
    this.stops.sort((a, b) => a[0] - b[0]);
  }
}

function parseColor(c) {
  if (typeof c !== 'string') return [0, 0, 0, 1];
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? ((n >> 24) & 255) / 255 : 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map((v) => parseFloat(v));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return [0, 0, 0, 1];
}

export class SoftwareCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Float32Array(width * height * 4); // premultiplied-ish rgba 0..1
    this.stack = [];
    this.m = [1, 0, 0, 1, 0, 0];
    this.path = [];
    this.globalAlpha = 1;
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.lineCap = 'round';
    this.lineJoin = 'round';
    this._clip = null;
  }

  getContext() {
    return this;
  }

  /* ------------------------------ transforms ----------------------------- */
  save() {
    this.stack.push({ m: this.m.slice(), clip: this._clip });
  }
  restore() {
    const s = this.stack.pop();
    if (s) {
      this.m = s.m;
      this._clip = s.clip;
    }
  }
  translate(x, y) {
    this._mul([1, 0, 0, 1, x, y]);
  }
  scale(x, y) {
    this._mul([x, 0, 0, y, 0, 0]);
  }
  rotate(a) {
    this._mul([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
  }
  _mul(n) {
    const m = this.m;
    this.m = [
      m[0] * n[0] + m[2] * n[1],
      m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3],
      m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4],
      m[1] * n[4] + m[3] * n[5] + m[5],
    ];
  }
  _pt(x, y) {
    const m = this.m;
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  }

  /* -------------------------------- paths -------------------------------- */
  beginPath() {
    this.path = [];
  }
  moveTo(x, y) {
    this.path.push({ t: 'm', x, y });
  }
  lineTo(x, y) {
    this.path.push({ t: 'l', x, y });
  }
  quadraticCurveTo(x1, y1, x, y) {
    this.path.push({ t: 'q', x1, y1, x, y });
  }
  bezierCurveTo(x1, y1, x2, y2, x, y) {
    this.path.push({ t: 'c', x1, y1, x2, y2, x, y });
  }
  arc(cx, cy, r, a0, a1) {
    this.path.push({ t: 'a', cx, cy, r, a0, a1 });
  }
  closePath() {
    this.path.push({ t: 'z' });
  }
  ellipse(cx, cy, rx, ry, rot = 0, a0 = 0, a1 = Math.PI * 2) {
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      const px = cx + x * Math.cos(rot) - y * Math.sin(rot);
      const py = cy + x * Math.sin(rot) + y * Math.cos(rot);
      if (i === 0) this.moveTo(px, py);
      else this.lineTo(px, py);
    }
    this.closePath();
  }
  rect(x, y, w, h) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }
  roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    this.moveTo(x + rr, y);
    this.lineTo(x + w - rr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + rr);
    this.lineTo(x + w, y + h - rr);
    this.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    this.lineTo(x + rr, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - rr);
    this.lineTo(x, y + rr);
    this.quadraticCurveTo(x, y, x + rr, y);
    this.closePath();
  }
  clip() {
    const subs = flattenPath(this.path).map((s) => s.map(([x, y]) => this._pt(x, y)));
    this._clip = subs;
  }

  createLinearGradient(x0, y0, x1, y1) {
    return new Gradient('linear', [x0, y0, x1, y1]);
  }
  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    return new Gradient('radial', [x0, y0, r0, x1, y1, r1]);
  }

  /* ----------------------------- rasterisation ---------------------------- */
  _paint(subs, style, alpha) {
    if (!subs.length) return;
    let minx = Infinity;
    let miny = Infinity;
    let maxx = -Infinity;
    let maxy = -Infinity;
    for (const s of subs)
      for (const [x, y] of s) {
        minx = Math.min(minx, x);
        maxx = Math.max(maxx, x);
        miny = Math.min(miny, y);
        maxy = Math.max(maxy, y);
      }
    minx = Math.max(0, Math.floor(minx));
    miny = Math.max(0, Math.floor(miny));
    maxx = Math.min(this.width - 1, Math.ceil(maxx));
    maxy = Math.min(this.height - 1, Math.ceil(maxy));
    if (minx > maxx || miny > maxy) return;

    const SS = 3; // supersampling grid, for clean anti-aliased edges
    const cov = new Float32Array((maxx - minx + 1) * (maxy - miny + 1) * SS * SS);
    const w = maxx - minx + 1;

    // even-odd scanline sampling
    for (const s of subs) {
      for (let y = miny; y <= maxy; y++) {
        for (let sy = 0; sy < SS; sy++) {
          const yy = y + (sy + 0.5) / SS;
          const xs = [];
          for (let i = 0; i < s.length - 1; i++) {
            const [x0, y0] = s[i];
            const [x1, y1] = s[i + 1];
            if (y0 === y1) continue;
            if ((yy >= y0 && yy < y1) || (yy >= y1 && yy < y0)) {
              xs.push(x0 + ((yy - y0) / (y1 - y0)) * (x1 - x0));
            }
          }
          xs.sort((a, b) => a - b);
          for (let k = 0; k + 1 < xs.length; k += 2) {
            const xa = Math.max(minx, xs[k]);
            const xb = Math.min(maxx, xs[k + 1]);
            if (xb <= xa) continue;
            for (let x = Math.floor(xa); x <= Math.ceil(xb); x++) {
              if (x < minx || x > maxx) continue;
              for (let sx = 0; sx < SS; sx++) {
                const xx = x + (sx + 0.5) / SS;
                if (xx >= xa && xx < xb) cov[((y - miny) * w + (x - minx)) * SS * SS + sy * SS + sx] = 1;
              }
            }
          }
        }
      }
    }

    for (let y = miny; y <= maxy; y++) {
      for (let x = minx; x <= maxx; x++) {
        let hits = 0;
        const base = ((y - miny) * w + (x - minx)) * SS * SS;
        for (let k = 0; k < SS * SS; k++) hits += cov[base + k];
        if (!hits) continue;
        let a = (hits / (SS * SS)) * alpha;
        if (this._clip && !this._inClip(x + 0.5, y + 0.5)) continue;
        const [r, g, b, ca] = this._colorAt(style, x + 0.5, y + 0.5);
        a *= ca;
        if (a <= 0.0005) continue;
        const i = (y * this.width + x) * 4;
        this.data[i] = this.data[i] * (1 - a) + r * a;
        this.data[i + 1] = this.data[i + 1] * (1 - a) + g * a;
        this.data[i + 2] = this.data[i + 2] * (1 - a) + b * a;
        this.data[i + 3] = this.data[i + 3] * (1 - a) + 255 * a;
      }
    }
  }

  _inClip(x, y) {
    let inside = false;
    for (const s of this._clip) {
      let hit = false;
      for (let i = 0, j = s.length - 1; i < s.length; j = i++) {
        const [xi, yi] = s[i];
        const [xj, yj] = s[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      if (hit) inside = !inside;
    }
    return inside;
  }

  _colorAt(style, x, y) {
    if (style && style.isGradient) {
      const g = style;
      if (g.type === 'linear') {
        const [x0, y0, x1, y1] = g.args;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = dx * dx + dy * dy || 1;
        let t = ((x - x0) * dx + (y - y0) * dy) / len;
        t = Math.max(0, Math.min(1, t));
        return sampleStops(g.stops, t);
      }
      const [x0, y0, , x1, y1, r1] = g.args;
      const d = Math.hypot(x - x1, y - y1) / (r1 || 1);
      return sampleStops(g.stops, Math.max(0, Math.min(1, d)));
    }
    return parseColor(style);
  }

  /* ------------------------------- drawing ------------------------------- */
  fill() {
    const subs = flattenPath(this.path).map((s) => s.map(([x, y]) => this._pt(x, y)));
    this._paint(subs, this.fillStyle, this.globalAlpha);
  }

  stroke() {
    // stroke by stroking each flattened segment as a thick capsule polygon
    const subs = flattenPath(this.path).map((s) => s.map(([x, y]) => this._pt(x, y)));
    const hw = this.lineWidth / 2;
    const polys = [];
    for (const s of subs) {
      for (let i = 0; i < s.length - 1; i++) {
        const [x0, y0] = s[i];
        const [x1, y1] = s[i + 1];
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * hw;
        const ny = (dx / len) * hw;
        polys.push([
          [x0 + nx, y0 + ny],
          [x1 + nx, y1 + ny],
          [x1 - nx, y1 - ny],
          [x0 - nx, y0 - ny],
          [x0 + nx, y0 + ny],
        ]);
        // round cap
        const n = 8;
        const cap = [];
        for (let k = 0; k <= n; k++) {
          const a = (k / n) * Math.PI * 2;
          cap.push([x1 + Math.cos(a) * hw, y1 + Math.sin(a) * hw]);
        }
        polys.push(cap);
      }
    }
    for (const p of polys) this._paint([p], this.strokeStyle, this.globalAlpha);
  }

  fillRect(x, y, w, h) {
    this.beginPath();
    this.rect(x, y, w, h);
    this.fill();
  }

  /* --------------------------------- text -------------------------------- */
  set font(v) {
    this._font = v;
    const m = /(\d+)px/.exec(v || '');
    this._fontSize = m ? +m[1] : 16;
  }
  get font() {
    return this._font || '16px sans-serif';
  }
  set textAlign(v) {
    this._align = v;
  }
  set textBaseline(v) {
    this._baseline = v;
  }
  fillText(text, x, y, maxW) {
    // crude block glyphs: enough to check layout, not typography
    const size = this._fontSize || 16;
    let w = String(text).length * size * 0.56;
    if (maxW && w > maxW) w = maxW;
    const h = size * 0.72;
    let x0 = x;
    if (this._align === 'center') x0 = x - w / 2;
    if (this._align === 'right') x0 = x - w;
    let y0 = y - h / 2;
    if (this._baseline === 'top') y0 = y;
    if (this._baseline === 'bottom') y0 = y - h;
    this.beginPath();
    this.roundRect(x0, y0, w, h, Math.min(3, h / 3));
    this.fill();
  }

  /* ------------------------------- encoding ------------------------------ */
  png() {
    const { width, height } = this;
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++) {
      raw[y * (width * 4 + 1)] = 0;
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const o = y * (width * 4 + 1) + 1 + x * 4;
        raw[o] = Math.round(Math.max(0, Math.min(255, this.data[i])));
        raw[o + 1] = Math.round(Math.max(0, Math.min(255, this.data[i + 1])));
        raw[o + 2] = Math.round(Math.max(0, Math.min(255, this.data[i + 2])));
        raw[o + 3] = Math.round(Math.max(0, Math.min(255, this.data[i + 3])));
      }
    }
    const chunk = (type, body) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(body.length);
      const t = Buffer.from(type, 'ascii');
      const crcTable = SoftwareCanvas._crcTable || (SoftwareCanvas._crcTable = (() => {
        const t2 = new Int32Array(256);
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          t2[n] = c;
        }
        return t2;
      })());
      let crc = -1;
      for (const byte of Buffer.concat([t, body])) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
      const c = Buffer.alloc(4);
      c.writeUInt32BE((crc ^ -1) >>> 0);
      return Buffer.concat([len, t, body, c]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }

  writePNG(file) {
    fs.writeFileSync(file, this.png());
  }
}

export function makeCanvas(w, h) {
  const c = new SoftwareCanvas(w, h);
  // opaque background by default, like a canvas element
  for (let i = 0; i < c.data.length; i += 4) {
    c.data[i + 3] = 0;
  }
  return c;
}
