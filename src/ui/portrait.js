/**
 * Player portraits: a stylized 3D-looking illustration of any squad member,
 * drawn to a canvas in the same art direction as the rest of the league —
 * bold rounded shapes, soft studio light, warm African skin tones, a team-colour
 * kit and a stadium backdrop.
 *
 * Used by the player picker (`portraitURL`), so the real Seroma squads look
 * like the renders on the marketing screens.
 */

/* ------------------------------- utilities -------------------------------- */

function hash(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const SKIN = [
  { base: '#a5734a', shade: '#7d5331', light: '#c49261' }, // light warm
  { base: '#8d5a33', shade: '#68401f', light: '#ab7748' },
  { base: '#74472a', shade: '#4f3018', light: '#91603a' },
  { base: '#5e3920', shade: '#3e2412', light: '#7c5030' },
  { base: '#4a2c18', shade: '#301a0c', light: '#664026' }, // deep
  { base: '#95603a', shade: '#6d4326', light: '#b57f52' },
];

const HAIR_STYLES = ['afro', 'crop', 'braids', 'bun', 'fade'];

function parseHex(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** lighten (t>0) or darken (t<0) a hex colour */
function shade(hex, t) {
  const [r, g, b] = parseHex(hex);
  const f = (v) => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function rgba(hex, a) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/* -------------------------------- backdrop -------------------------------- */

function drawBackdrop(g, w, h, team, seed) {
  // sky: bright, high-key, like the promo renders
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2f7ed0');
  sky.addColorStop(0.42, '#8ecbf0');
  sky.addColorStop(0.78, '#d8eefc');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  // soft cumulus puffs
  for (let i = 0; i < 5; i++) {
    const cx = w * hash('c' + i, seed) + w * 0.1;
    const cy = h * (0.06 + hash('d' + i, seed) * 0.18);
    const r = w * (0.1 + hash('e' + i, seed) * 0.09);
    for (let k = 0; k < 4; k++) {
      const ox = (k - 1.5) * r * 0.7;
      const oy = Math.sin(k * 1.7) * r * 0.22;
      const rg = g.createRadialGradient(cx + ox, cy + oy, r * 0.1, cx + ox, cy + oy, r);
      rg.addColorStop(0, 'rgba(255,255,255,0.95)');
      rg.addColorStop(0.62, 'rgba(255,255,255,0.8)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  // distant hills
  const hills = ['#7fae5b', '#93bd6a'];
  hills.forEach((c, i) => {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(-w * 0.1, h * (0.62 + i * 0.06));
    for (let x = 0; x <= 10; x++) {
      const px = (x / 10) * (w * 1.2) - w * 0.1;
      const py = h * (0.62 + i * 0.06) - Math.sin(x * 0.9 + i) * h * 0.03;
      g.lineTo(px, py);
    }
    g.lineTo(w * 1.1, h);
    g.lineTo(-w * 0.1, h);
    g.closePath();
    g.fill();
  });

  // distant school blocks with green roofs
  const roofY = h * 0.44;
  for (let i = 0; i < 4; i++) {
    const bw = w * (0.16 + hash('bw' + i, seed) * 0.12);
    const bx = (i / 4) * w * 1.05 + hash('bx' + i, seed) * w * 0.06 - w * 0.03;
    const bh = h * (0.045 + hash('bh' + i, seed) * 0.03);
    g.fillStyle = '#d1783f';
    g.fillRect(bx, roofY - bh, bw, bh);
    g.fillStyle = '#a8c6a4';
    g.beginPath();
    g.moveTo(bx - bw * 0.05, roofY - bh);
    g.lineTo(bx + bw * 0.5, roofY - bh - h * 0.028);
    g.lineTo(bx + bw * 1.05, roofY - bh);
    g.closePath();
    g.fill();
    // window band
    g.fillStyle = 'rgba(42,75,88,0.85)';
    g.fillRect(bx + bw * 0.12, roofY - bh * 0.62, bw * 0.76, bh * 0.3);
  }

  // tiered stand, brighter concrete
  const standTop = h * 0.5;
  for (let i = 0; i < 3; i++) {
    g.fillStyle = i % 2 ? '#cfc8bb' : '#bdb5a6';
    g.beginPath();
    g.moveTo(0, standTop + h * (0.06 + i * 0.035));
    g.lineTo(w, standTop + h * (0.045 + i * 0.035));
    g.lineTo(w, standTop + h * (0.095 + i * 0.035));
    g.lineTo(0, standTop + h * (0.11 + i * 0.035));
    g.closePath();
    g.fill();
  }

  // painted crowd: dense blobs in club colours
  for (let row = 0; row < 3; row++) {
    const y = standTop + h * (0.075 + row * 0.035);
    for (let x = 2; x < w; x += 9) {
      if (hash('crowd' + x + row, seed) < 0.18) continue;
      const pickC = [
        team.colors.primary,
        team.colors.secondary,
        '#20242b',
        '#e9e6df',
        '#f2b134',
        '#2f6df6',
        '#d81b60',
      ][Math.floor(hash('cc' + x + row, seed) * 7)];
      g.fillStyle = pickC;
      g.beginPath();
      g.arc(x + hash('j' + x + row, seed) * 2, y, 3.4, 0, Math.PI * 2);
      g.fill();
      // head
      g.fillStyle = 'rgba(90,60,40,0.85)';
      g.beginPath();
      g.arc(x + hash('j' + x + row, seed) * 2, y - 3.6, 2.1, 0, Math.PI * 2);
      g.fill();
    }
  }

  // green pitch in front of the stand
  const grass = g.createLinearGradient(0, h * 0.66, 0, h);
  grass.addColorStop(0, '#71b746');
  grass.addColorStop(1, '#4e8f2e');
  g.fillStyle = grass;
  g.beginPath();
  g.moveTo(0, h * 0.68);
  g.lineTo(w, h * 0.66);
  g.lineTo(w, h);
  g.lineTo(0, h);
  g.closePath();
  g.fill();

  // floodlight bokeh, top corners
  ['left', 'right'].forEach((side, i) => {
    const cx = side === 'left' ? w * 0.1 : w * 0.9;
    const glow = g.createRadialGradient(cx, h * 0.06, 2, cx, h * 0.06, w * 0.38);
    glow.addColorStop(0, 'rgba(255,250,225,0.85)');
    glow.addColorStop(0.35, `rgba(255,240,190,${0.28 - i * 0.05})`);
    glow.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(cx, h * 0.06, w * 0.38, 0, Math.PI * 2);
    g.fill();
  });
}

/* --------------------------------- figure --------------------------------- */

function drawFigure(g, w, h, p) {
  const cx = w * 0.5;
  const headR = w * 0.205;
  const headY = h * 0.335;
  const skin = p.skin;
  const kit = p.kit;
  const tank = p.sport === 'basketball';
  const swim = p.sport === 'swimming';

  /* ---- ground shadow ---- */
  const sh = g.createRadialGradient(cx, h * 1.005, 4, cx, h * 1.005, w * 0.44);
  sh.addColorStop(0, 'rgba(12,24,10,0.34)');
  sh.addColorStop(1, 'rgba(12,24,10,0)');
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(cx, h * 1.005, w * 0.4, h * 0.05, 0, 0, Math.PI * 2);
  g.fill();

  /* ---- one silhouette for shoulders + chest: no gaps, fills the card ---- */
  const shoulderTop = h * 0.585;
  const shoulderX = w * 0.085;
  const neckX = w * 0.132;

  const silhouette = () => {
    g.beginPath();
    g.moveTo(-w * 0.02, h * 1.04);
    g.lineTo(-w * 0.02, shoulderTop + h * 0.085);
    // left shoulder rising to the neck
    g.quadraticCurveTo(w * 0.05, shoulderTop + h * 0.008, shoulderX + neckX * 0.4, shoulderTop - h * 0.028);
    g.quadraticCurveTo(shoulderX + neckX * 0.9, shoulderTop - h * 0.045, cx - neckX * 0.62, shoulderTop - h * 0.055);
    // neckline
    g.quadraticCurveTo(cx, shoulderTop - h * 0.012, cx + neckX * 0.62, shoulderTop - h * 0.055);
    g.quadraticCurveTo(cx + shoulderX + neckX * 0.9, shoulderTop - h * 0.045, cx + shoulderX + neckX * 0.4, shoulderTop - h * 0.028);
    g.quadraticCurveTo(w * 0.95, shoulderTop + h * 0.008, w * 1.02, shoulderTop + h * 0.085);
    g.lineTo(w * 1.02, h * 1.04);
    g.closePath();
  };

  silhouette();
  g.save?.();
  if (typeof g.clip === 'function') g.clip();
  if (swim) {
    // bare shoulders and chest in skin, lit from the upper left
    const skingrad = g.createLinearGradient(-w * 0.02, 0, w * 1.02, 0);
    skingrad.addColorStop(0, skin.shade);
    skingrad.addColorStop(0.3, skin.base);
    skingrad.addColorStop(0.55, skin.light);
    skingrad.addColorStop(0.8, skin.base);
    skingrad.addColorStop(1, skin.shade);
    g.fillStyle = skingrad;
    g.fill();
  } else {
    const torso = g.createLinearGradient(-w * 0.02, 0, w * 1.02, 0);
    torso.addColorStop(0, shade(kit.primary, -0.34));
    torso.addColorStop(0.16, shade(kit.primary, -0.08));
    torso.addColorStop(0.44, shade(kit.primary, 0.16));
    torso.addColorStop(0.68, kit.primary);
    torso.addColorStop(1, shade(kit.primary, -0.36));
    g.fillStyle = torso;
    g.fill();
  }

  /* ---- shoulders: rounded cap highlight so it reads as a body ---- */
  // studio sheen across the shoulders: bright at the top, falling away below
  const sheen = g.createLinearGradient(0, shoulderTop - h * 0.03, 0, shoulderTop + h * 0.2);
  sheen.addColorStop(0, swim ? rgba(skin.light, 0.5) : rgba('#ffffff', 0.2));
  sheen.addColorStop(0.45, swim ? rgba(skin.light, 0.12) : rgba('#ffffff', 0.05));
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.beginPath();
  g.moveTo(-w * 0.02, shoulderTop - h * 0.05);
  g.lineTo(w * 1.02, shoulderTop - h * 0.05);
  g.lineTo(w * 1.02, shoulderTop + h * 0.22);
  g.lineTo(-w * 0.02, shoulderTop + h * 0.22);
  g.closePath();
  g.fill();

  if (swim) {
    // collarbones catching the light
    g.strokeStyle = rgba(skin.shade, 0.32);
    g.lineWidth = headR * 0.05;
    [-1, 1].forEach((side) => {
      g.beginPath();
      g.moveTo(cx + side * headR * 0.16, shoulderTop + h * 0.02);
      g.quadraticCurveTo(cx + side * headR * 0.8, shoulderTop + h * 0.03, cx + side * headR * 1.35, shoulderTop + h * 0.075);
      g.stroke();
    });
    // the suit: shoulder straps coming down from behind the neck,
    // then the chest edge across the ribs
    const suitTop = shoulderTop + h * 0.105;
    [-1, 1].forEach((side) => {
      g.fillStyle = shade(kit.primary, -0.06);
      g.beginPath();
      g.moveTo(cx + side * headR * 0.34, shoulderTop - h * 0.012);
      g.quadraticCurveTo(
        cx + side * headR * 0.95,
        shoulderTop + h * 0.008,
        cx + side * headR * 1.55,
        shoulderTop + h * 0.055
      );
      g.lineTo(cx + side * headR * 1.55, shoulderTop + h * 0.085);
      g.quadraticCurveTo(
        cx + side * headR * 0.95,
        shoulderTop + h * 0.045,
        cx + side * headR * 0.42,
        shoulderTop + h * 0.028
      );
      g.closePath();
      g.fill();
    });
    // suit body from the chest edge down
    const suitGrad = g.createLinearGradient(cx - w * 0.5, 0, cx + w * 0.5, 0);
    suitGrad.addColorStop(0, shade(kit.primary, -0.36));
    suitGrad.addColorStop(0.42, shade(kit.primary, 0.12));
    suitGrad.addColorStop(1, shade(kit.primary, -0.4));
    g.fillStyle = suitGrad;
    g.beginPath();
    g.moveTo(-w * 0.02, suitTop + h * 0.012);
    g.quadraticCurveTo(cx, suitTop - h * 0.028, w * 1.02, suitTop + h * 0.012);
    g.lineTo(w * 1.02, h * 1.04);
    g.lineTo(-w * 0.02, h * 1.04);
    g.closePath();
    g.fill();
    // hem highlight
    g.strokeStyle = rgba('#ffffff', 0.16);
    g.lineWidth = headR * 0.05;
    g.beginPath();
    g.moveTo(-w * 0.02, suitTop + h * 0.018);
    g.quadraticCurveTo(cx, suitTop - h * 0.022, w * 1.02, suitTop + h * 0.018);
    g.stroke();
  }

  /* ---- kit neckline / collar ---- */
  if (tank) {
    // bare chest inside the tank scoop
    g.fillStyle = skin.base;
    g.beginPath();
    g.moveTo(cx - w * 0.125, shoulderTop + h * 0.02);
    g.quadraticCurveTo(cx, shoulderTop + h * 0.004, cx + w * 0.125, shoulderTop + h * 0.02);
    g.quadraticCurveTo(cx + w * 0.07, shoulderTop + h * 0.078, cx, shoulderTop + h * 0.082);
    g.quadraticCurveTo(cx - w * 0.07, shoulderTop + h * 0.078, cx - w * 0.125, shoulderTop + h * 0.02);
    g.closePath();
    g.fill();
    // shadow under the jaw falling into the scoop
    g.fillStyle = 'rgba(0,0,0,0.1)';
    g.beginPath();
    g.ellipse(cx, shoulderTop + h * 0.022, w * 0.075, h * 0.009, 0, 0, Math.PI * 2);
    g.fill();
  } else if (!swim) {
    // shirt collar: a band of trim sitting on the neckline
    g.strokeStyle = kit.secondary;
    g.lineWidth = headR * 0.19;
    g.beginPath();
    g.moveTo(cx - w * 0.185, shoulderTop - h * 0.012);
    g.quadraticCurveTo(cx, shoulderTop + h * 0.055, cx + w * 0.185, shoulderTop - h * 0.012);
    g.stroke();
    // collar shadow under the trim
    g.strokeStyle = 'rgba(0,0,0,0.16)';
    g.lineWidth = headR * 0.05;
    g.beginPath();
    g.moveTo(cx - w * 0.175, shoulderTop + h * 0.012);
    g.quadraticCurveTo(cx, shoulderTop + h * 0.075, cx + w * 0.175, shoulderTop + h * 0.012);
    g.stroke();
  }

  /* ---- sleeve trim on both shoulders, like the render kits ---- */
  if (!tank && !swim) {
    [-1, 1].forEach((side) => {
      g.strokeStyle = rgba(kit.secondary, 0.85);
      g.lineWidth = headR * 0.11;
      g.beginPath();
      g.moveTo(cx + side * w * 0.3, shoulderTop + h * 0.02);
      g.quadraticCurveTo(
        cx + side * w * 0.4,
        shoulderTop + h * 0.075,
        cx + side * w * 0.46,
        shoulderTop + h * 0.16
      );
      g.stroke();
    });
  }

  /* ---- jersey number ---- */
  g.save?.();
  const numberColor = (() => {
    const c = kit.secondary || '#ffffff';
    const [r, gg, b] = parseHex(c.startsWith('#') ? c : '#ffffff');
    const lum = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
    if (lum > 0.62) return rgba('#12211a', 0.85); // light kit: dark digits
    return rgba(c, 0.95);
  })();
  g.fillStyle = tank || swim ? rgba('#ffffff', 0.92) : numberColor;
  g.font = `bold ${Math.round(headR * 0.78)}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(p.number), cx, shoulderTop + h * 0.235);
  g.restore?.();

  /* ---- fabric shading folds ---- */
  g.strokeStyle = 'rgba(0,0,0,0.1)';
  g.lineWidth = headR * 0.05;
  [-0.3, -0.1, 0.12, 0.32].forEach((k) => {
    g.beginPath();
    g.moveTo(cx + w * k, shoulderTop + h * 0.14);
    g.quadraticCurveTo(cx + w * (k + 0.03), h * 0.85, cx + w * (k - 0.01), h);
    g.stroke();
  });

  g.restore?.();

  /* ---- club crest ---- */
  const crestX = cx - w * 0.2;
  const crestY = shoulderTop + h * 0.115;
  g.fillStyle = rgba('#ffffff', 0.94);
  g.beginPath();
  g.moveTo(crestX - headR * 0.19, crestY - headR * 0.2);
  g.lineTo(crestX + headR * 0.19, crestY - headR * 0.2);
  g.lineTo(crestX + headR * 0.11, crestY + headR * 0.18);
  g.lineTo(crestX, crestY + headR * 0.28);
  g.lineTo(crestX - headR * 0.11, crestY + headR * 0.18);
  g.closePath();
  g.fill();
  g.fillStyle = rgba(kit.primary, 0.9);
  g.beginPath();
  g.arc(crestX, crestY - headR * 0.01, headR * 0.085, 0, Math.PI * 2);
  g.fill();

  /* ---- neck ---- */
  g.fillStyle = skin.shade;
  g.beginPath();
  g.moveTo(cx - headR * 0.3, headY + headR * 0.6);
  g.quadraticCurveTo(cx, headY + headR * 0.92, cx + headR * 0.3, headY + headR * 0.6);
  g.lineTo(cx + headR * 0.34, shoulderTop + h * 0.008);
  g.lineTo(cx - headR * 0.34, shoulderTop + h * 0.008);
  g.closePath();
  g.fill();
  // lit front of the neck
  g.fillStyle = rgba(skin.base, 0.9);
  g.beginPath();
  g.ellipse(cx - headR * 0.07, headY + headR * 0.86, headR * 0.19, headR * 0.17, 0, 0, Math.PI * 2);
  g.fill();
  // soft shadow cast by the jaw onto the neck
  g.fillStyle = 'rgba(0,0,0,0.14)';
  g.beginPath();
  g.ellipse(cx, headY + headR * 0.98, headR * 0.3, headR * 0.11, 0, 0, Math.PI * 2);
  g.fill();

  /* ---- hair: back layer first so nothing covers the face ---- */
  drawHairBack(g, cx, headY, headR, p.hair, p.hairStyle);

  /* ---- head ---- */
  const hg = g.createRadialGradient(
    cx - headR * 0.4,
    headY - headR * 0.45,
    headR * 0.12,
    cx,
    headY,
    headR * 1.36
  );
  hg.addColorStop(0, skin.light);
  hg.addColorStop(0.48, skin.base);
  hg.addColorStop(1, skin.shade);
  g.fillStyle = hg;
  g.beginPath();
  g.ellipse(cx, headY, headR * 0.9, headR * 1.06, 0, 0, Math.PI * 2);
  g.fill();

  /* jaw shadow along the chin */
  g.fillStyle = rgba(skin.shade, 0.28);
  g.beginPath();
  g.ellipse(cx, headY + headR * 0.78, headR * 0.56, headR * 0.2, 0, 0, Math.PI * 2);
  g.fill();

  /* ears */
  [-1, 1].forEach((side) => {
    g.fillStyle = skin.base;
    g.beginPath();
    g.ellipse(cx + side * headR * 0.88, headY + headR * 0.12, headR * 0.15, headR * 0.23, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = rgba(skin.shade, 0.45);
    g.beginPath();
    g.ellipse(cx + side * headR * 0.9, headY + headR * 0.12, headR * 0.07, headR * 0.13, 0, 0, Math.PI * 2);
    g.fill();
  });

  /* hair front layer (fringe / cap / hairline) */
  drawHairFront(g, cx, headY, headR, p.hair, p.hairStyle, p);

  /* ---- face ---- */
  const eyeY = headY + headR * 0.12;
  const eyeDx = headR * 0.34;
  [-1, 1].forEach((side) => {
    g.fillStyle = rgba(skin.shade, 0.4);
    g.beginPath();
    g.ellipse(cx + side * eyeDx, eyeY - headR * 0.08, headR * 0.22, headR * 0.13, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fbf7ef';
    g.beginPath();
    g.ellipse(cx + side * eyeDx, eyeY, headR * 0.155, headR * 0.115, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2b1d14';
    g.beginPath();
    g.arc(cx + side * eyeDx + headR * 0.015, eyeY + headR * 0.008, headR * 0.075, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.arc(cx + side * eyeDx + headR * 0.042, eyeY - headR * 0.035, headR * 0.026, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(40,24,14,0.5)';
    g.lineWidth = headR * 0.028;
    g.beginPath();
    g.moveTo(cx + side * (eyeDx - headR * 0.15), eyeY - headR * 0.07);
    g.quadraticCurveTo(cx + side * eyeDx, eyeY - headR * 0.14, cx + side * (eyeDx + headR * 0.15), eyeY - headR * 0.06);
    g.stroke();
    g.strokeStyle = p.hair;
    g.lineWidth = headR * 0.072;
    g.beginPath();
    g.moveTo(cx + side * (eyeDx - headR * 0.16), eyeY - headR * 0.23);
    g.quadraticCurveTo(
      cx + side * eyeDx,
      eyeY - headR * 0.32,
      cx + side * (eyeDx + headR * 0.16),
      eyeY - headR * 0.21
    );
    g.stroke();
  });

  /* nose */
  g.strokeStyle = rgba(skin.shade, 0.55);
  g.lineWidth = headR * 0.05;
  g.beginPath();
  g.moveTo(cx - headR * 0.02, eyeY + headR * 0.12);
  g.quadraticCurveTo(cx - headR * 0.09, eyeY + headR * 0.34, cx, eyeY + headR * 0.42);
  g.stroke();
  [-1, 1].forEach((side) => {
    g.fillStyle = rgba(skin.shade, 0.45);
    g.beginPath();
    g.ellipse(cx + side * headR * 0.085, eyeY + headR * 0.42, headR * 0.05, headR * 0.034, 0, 0, Math.PI * 2);
    g.fill();
  });

  /* smile */
  g.strokeStyle = '#33190f';
  g.lineWidth = headR * 0.055;
  g.beginPath();
  g.moveTo(cx - headR * 0.24, eyeY + headR * 0.6);
  g.quadraticCurveTo(cx, eyeY + headR * 0.78, cx + headR * 0.24, eyeY + headR * 0.6);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.moveTo(cx - headR * 0.17, eyeY + headR * 0.645);
  g.quadraticCurveTo(cx, eyeY + headR * 0.72, cx + headR * 0.17, eyeY + headR * 0.645);
  g.quadraticCurveTo(cx, eyeY + headR * 0.675, cx - headR * 0.17, eyeY + headR * 0.645);
  g.closePath();
  g.fill();

  /* cheek warmth */
  [-1, 1].forEach((side) => {
    const ch = g.createRadialGradient(
      cx + side * headR * 0.5,
      eyeY + headR * 0.36,
      1,
      cx + side * headR * 0.5,
      eyeY + headR * 0.36,
      headR * 0.3
    );
    ch.addColorStop(0, 'rgba(188,100,64,0.18)');
    ch.addColorStop(1, 'rgba(188,100,64,0)');
    g.fillStyle = ch;
    g.beginPath();
    g.arc(cx + side * headR * 0.5, eyeY + headR * 0.36, headR * 0.3, 0, Math.PI * 2);
    g.fill();
  });

  /* swimming goggles pushed up onto the cap */
  if (swim) {
    g.strokeStyle = 'rgba(28,38,50,0.9)';
    g.lineWidth = headR * 0.09;
    g.beginPath();
    g.moveTo(cx - headR * 0.8, headY - headR * 0.55);
    g.quadraticCurveTo(cx, headY - headR * 0.8, cx + headR * 0.8, headY - headR * 0.55);
    g.stroke();
    [-1, 1].forEach((side) => {
      g.fillStyle = 'rgba(150,220,240,0.8)';
      g.beginPath();
      g.ellipse(cx + side * headR * 0.34, headY - headR * 0.66, headR * 0.17, headR * 0.1, side * 0.1, 0, Math.PI * 2);
      g.fill();
    });
  }
}

/** Hair that sits behind the head silhouette. */
function drawHairBack(g, cx, headY, headR, hairColor, style) {
  if (style === 'afro') {
    g.fillStyle = hairColor;
    g.beginPath();
    g.ellipse(cx, headY - headR * 0.22, headR * 1.24, headR * 1.16, 0, 0, Math.PI * 2);
    g.fill();
    return;
  }
  if (style === 'braids') {
    g.fillStyle = hairColor;
    g.beginPath();
    g.ellipse(cx, headY - headR * 0.1, headR * 1.02, headR * 1.0, 0, 0, Math.PI * 2);
    g.fill();
    // braids fall beside and behind the head, clear of the cheeks
    for (let i = 0; i < 3; i++) {
      [-1, 1].forEach((side) => {
        const t = i / 2;
        const x = cx + side * headR * (0.84 + t * 0.12);
        g.strokeStyle = hairColor;
        g.lineWidth = headR * 0.12;
        g.beginPath();
        g.moveTo(x, headY - headR * 0.45);
        g.quadraticCurveTo(
          x + side * headR * 0.04,
          headY + headR * 0.15,
          x + side * headR * 0.02,
          headY + headR * (0.45 + t * 0.2)
        );
        g.stroke();
        g.fillStyle = i % 2 ? '#f2c14e' : '#f4f1e6';
        g.beginPath();
        g.arc(x + side * headR * 0.02, headY + headR * (0.49 + t * 0.2), headR * 0.045, 0, Math.PI * 2);
        g.fill();
      });
    }
    return;
  }
  if (style === 'bun') {
    g.fillStyle = hairColor;
    g.beginPath();
    g.ellipse(cx, headY - headR * 0.12, headR * 1.04, headR * 1.02, 0, 0, Math.PI * 2);
    g.fill();
    return;
  }
}

/** Hair that overlaps the head: fringe, cap, hairline. */
function drawHairFront(g, cx, headY, headR, hairColor, style, kit) {
  if (style === 'cap') {
    const capColor = kit?.cap || '#f2f2f2';
    g.fillStyle = capColor;
    g.beginPath();
    g.ellipse(cx, headY - headR * 0.22, headR * 0.99, headR * 0.98, 0, Math.PI * 1.04, Math.PI * 1.96);
    g.fill();
    g.beginPath();
    g.ellipse(cx, headY - headR * 0.34, headR * 0.97, headR * 0.72, 0, Math.PI, Math.PI * 2);
    g.fill();
    // cap seam + sheen
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = headR * 0.05;
    g.beginPath();
    g.moveTo(cx, headY - headR * 1.18);
    g.lineTo(cx, headY - headR * 0.3);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath();
    g.ellipse(cx - headR * 0.34, headY - headR * 0.82, headR * 0.28, headR * 0.14, -0.5, 0, Math.PI * 2);
    g.fill();
    // hairline at the temples
    g.fillStyle = 'rgba(20,14,10,0.85)';
    [-1, 1].forEach((side) => {
      g.beginPath();
      g.ellipse(cx + side * headR * 0.78, headY - headR * 0.18, headR * 0.11, headR * 0.2, 0, 0, Math.PI * 2);
      g.fill();
    });
    return;
  }
  if (style === 'afro') {
    // a low hairline so the forehead and brows stay clear
    g.fillStyle = hairColor;
    g.beginPath();
    g.ellipse(cx, headY - headR * 0.62, headR * 0.94, headR * 0.62, 0, Math.PI, Math.PI * 2);
    g.fill();
    // sideburn edge
    [-1, 1].forEach((side) => {
      g.beginPath();
      g.ellipse(cx + side * headR * 0.86, headY - headR * 0.2, headR * 0.14, headR * 0.34, 0, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.beginPath();
    g.ellipse(cx - headR * 0.3, headY - headR * 1.0, headR * 0.4, headR * 0.2, -0.4, 0, Math.PI * 2);
    g.fill();
    return;
  }
  if (style === 'braids' || style === 'bun' || style === 'fade' || style === 'crop') {
    g.fillStyle = hairColor;
    g.beginPath();
    g.ellipse(cx, headY - headR * 0.6, headR * 0.95, headR * 0.64, 0, Math.PI, Math.PI * 2);
    g.fill();
    // tidy hairline across the forehead
    g.beginPath();
    g.ellipse(cx, headY - headR * 0.58, headR * 0.93, headR * 0.34, 0, Math.PI, Math.PI * 2);
    g.fill();
    if (style === 'bun') {
      g.beginPath();
      g.arc(cx, headY - headR * 1.32, headR * 0.33, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath();
      g.arc(cx - headR * 0.1, headY - headR * 1.38, headR * 0.13, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.beginPath();
      g.ellipse(cx - headR * 0.3, headY - headR * 0.92, headR * 0.34, headR * 0.16, -0.35, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/* --------------------------------- public --------------------------------- */

/**
 * Pick (deterministically) everything that makes this player look like
 * themselves: skin tone, hair colour and style, and kit trims.
 */
export function portraitLook(name, team, sport = 'football') {
  const seed = Math.floor(hash(name, 7) * 1e6);
  const skin = SKIN[Math.floor(hash(name, 1) * SKIN.length)];
  const hair = [
    '#171210',
    '#1f1712',
    '#2a1d15',
    '#120e0c',
  ][Math.floor(hash(name, 3) * 4)];
  const hairStyle =
    sport === 'swimming' ? 'cap' : HAIR_STYLES[Math.floor(hash(name, 5) * HAIR_STYLES.length)];
  return {
    seed,
    skin,
    hair,
    hairStyle,
    sport,
    number: 1 + Math.floor(hash(name, 9) * 11),
    cap: ['#f2f2f2', '#ffd23f', '#1b2733', '#e4572e'][Math.floor(hash(name, 13) * 4)],
    kit: team?.colors || { primary: '#d9452b', secondary: '#f7f3e8', shorts: '#1b1b1f' },
  };
}

/** Draw a full portrait into any Canvas2D-like context. */
export function drawPortrait(g, w, h, { name, team, sport = 'football', badge = null }) {
  const look = portraitLook(name, team, sport);
  g.save?.();
  drawBackdrop(g, w, h, team || { colors: { primary: '#0f5132', secondary: '#f2c14e' } }, look.seed);
  drawFigure(g, w, h, look);

  if (badge) {
    // club name on a strip at the top
    g.fillStyle = 'rgba(8,26,18,0.72)';
    g.beginPath();
    g.roundRect?.(w * 0.06, h * 0.045, w * 0.88, h * 0.085, h * 0.02);
    g.fill?.();
    g.fillStyle = '#f6efdc';
  }
  g.restore?.();
  return look;
}

/* ------------------------------- browser API ------------------------------ */

const urlCache = new Map();

/** Data-URL portrait, cached per player + kit. Safe to call in a render loop. */
export function portraitURL({ name, team, sport = 'football', width = 320, height = 400 }) {
  const key = [name, team?.id, team?.colors?.primary, sport, width, height].join('|');
  if (urlCache.has(key)) return urlCache.get(key);
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  if (g) drawPortrait(g, width, height, { name, team, sport });
  const url = c.toDataURL('image/png');
  urlCache.set(key, url);
  return url;
}
