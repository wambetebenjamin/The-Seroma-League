/* Canvas-painted textures — keeps the download small and the look consistent. */
import * as THREE from 'three';

const cache = new Map();

function canvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function finish(c, repeat = [1, 1], aniso = 4) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function grassTexture(repeat = [14, 10]) {
  const key = 'grass' + repeat.join(',');
  if (cache.has(key)) return cache.get(key);
  const size = 512;
  const c = canvas(size);
  const g = c.getContext('2d');
  g.fillStyle = '#3f7a35';
  g.fillRect(0, 0, size, size);
  // mowing stripes
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#468a3b' : '#396f2f';
    g.fillRect(0, (i * size) / 8, size, size / 8);
  }
  // blades / noise
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.strokeStyle = `rgba(${60 + Math.random() * 50 | 0}, ${110 + Math.random() * 70 | 0}, ${50 + Math.random() * 40 | 0}, 0.5)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 3);
    g.stroke();
  }
  const t = finish(c, repeat);
  cache.set(key, t);
  return t;
}

export function dirtTexture(repeat = [4, 24]) {
  const key = 'dirt' + repeat.join(',');
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256);
  const g = c.getContext('2d');
  g.fillStyle = '#a7552d';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) {
    const s = Math.random() * 3 + 0.5;
    g.fillStyle = `rgba(${110 + Math.random() * 80 | 0}, ${55 + Math.random() * 45 | 0}, ${30 + Math.random() * 25 | 0}, .55)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  const t = finish(c, repeat);
  cache.set(key, t);
  return t;
}

export function courtTexture() {
  if (cache.has('court')) return cache.get('court');
  const c = canvas(512);
  const g = c.getContext('2d');
  g.fillStyle = '#d9733c';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${180 + Math.random() * 50 | 0}, ${95 + Math.random() * 40 | 0}, ${50 + Math.random() * 30 | 0}, .35)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // court markings
  g.strokeStyle = '#f6f1e4';
  g.lineWidth = 6;
  g.strokeRect(16, 16, 480, 480);
  g.beginPath();
  g.arc(256, 256, 66, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(16, 190);
  g.lineTo(120, 190);
  g.lineTo(120, 322);
  g.lineTo(16, 322);
  g.stroke();
  const t = finish(c, [1, 1]);
  cache.set('court', t);
  return t;
}

export function roofTexture(repeat = [4, 4]) {
  const key = 'roof' + repeat.join(',');
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256);
  const g = c.getContext('2d');
  g.fillStyle = '#2f6b4f';
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    g.fillStyle = x % 32 ? '#357453' : '#2a6148';
    g.fillRect(x, 0, 8, 256);
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${40 + Math.random() * 40 | 0}, ${90 + Math.random() * 60 | 0}, ${60 + Math.random() * 40 | 0}, .3)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 4, 2);
  }
  const t = finish(c, repeat);
  cache.set(key, t);
  return t;
}

/** Big canvas crowd texture: many coloured blobs on concrete steps. */
export function crowdTexture(primary = '#c0392b', secondary = '#f2f2f2') {
  const key = 'crowd' + primary + secondary;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2b3a2f';
  g.fillRect(0, 0, c.width, c.height);
  const palette = ['#e9e6df', '#20242b', primary, secondary, '#2f6df6', '#f2b134', '#8d6e63', '#d81b60'];
  for (let row = 0; row < 7; row++) {
    const y = 20 + row * 34;
    g.fillStyle = row % 2 ? '#33452f' : '#2c3b2a';
    g.fillRect(0, y + 22, c.width, 12);
    for (let x = 6; x < c.width; x += 17) {
      if (Math.random() < 0.12) continue;
      g.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      g.beginPath();
      g.arc(x + Math.random() * 4, y + Math.random() * 4, 5.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.beginPath();
      g.arc(x + 1, y + 3, 5.2, 0.2, Math.PI - 0.2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

export function bannerTexture(text, bg = '#0f5132', fg = '#ffffff', sub = '') {
  const key = 'banner' + text + bg + fg + sub;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.lineWidth = 4;
  g.strokeRect(4, 4, 504, 120);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 46px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  g.fillText(text, 256, sub ? 52 : 66, 470);
  if (sub) {
    g.font = '500 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.fillText(sub, 256, 92, 470);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

export function waterTexture() {
  if (cache.has('water')) return cache.get('water');
  const c = canvas(256);
  const g = c.getContext('2d');
  g.fillStyle = '#1ba3c9';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = `rgba(255,255,255,${Math.random() * 0.22})`;
    g.lineWidth = 1 + Math.random() * 2;
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + 20, y - 6, x + 40, y + 6, x + 60, y);
    g.stroke();
  }
  const t = finish(c, [6, 18]);
  cache.set('water', t);
  return t;
}

export function jerseyTexture(primary, secondary, number, name) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = primary;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = secondary;
  g.fillRect(0, 96, 128, 32);
  g.font = 'bold 54px system-ui, sans-serif';
  g.fillStyle = secondary;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(number), 64, 52);
  if (name) {
    g.font = 'bold 14px system-ui, sans-serif';
    g.fillStyle = secondary;
    g.fillText(name.slice(0, 10), 64, 104);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
