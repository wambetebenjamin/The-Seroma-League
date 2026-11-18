/**
 * Render player portraits to PNG so the illustration can be judged by eye.
 * Run: node tools/portrait-preview.mjs
 */
import { makeCanvas } from './software-canvas.mjs';
import { TEAMS } from '../src/data/seroma.js';
import { drawPortrait } from '../src/ui/portrait.js';

const team = (id) => TEAMS.find((t) => t.id === id) || TEAMS[0];

const subjects = [
  { name: 'Deng Martin', team: team('levites'), sport: 'football' },
  { name: 'Nakachwa Samalie', team: team('theos'), sport: 'football' },
  { name: 'Wambete Judah', team: team('galacticals'), sport: 'football' },
  { name: 'Senyondo Nelly', team: team('spartans'), sport: 'basketball' },
  { name: 'Tendo Milvet', team: team('celestials'), sport: 'football' },
  { name: 'Kelly Kevin', team: team('gaucho'), sport: 'basketball' },
  { name: 'Namulindwa Fairuz', team: team('legendaries'), sport: 'swimming' },
  { name: 'Mwesigwa David', team: team('theos'), sport: 'swimming' },
  { name: 'Okot Toby', team: team('gaucho'), sport: 'football' },
];

const W = 320;
const H = 400;
const COLS = 3;
const ROWS = Math.ceil(subjects.length / COLS);

// contact sheet, drawn portrait by portrait
const sheet = makeCanvas(W * COLS, H * ROWS);
const sg = sheet.getContext();
subjects.forEach((s, i) => {
  const tile = makeCanvas(W, H);
  drawPortrait(tile.getContext(), W, H, s);
  const ox = (i % COLS) * W;
  const oy = Math.floor(i / COLS) * H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const si = ((y * W + x) * 4);
      const di = (((y + oy) * sheet.width) + (x + ox)) * 4;
      sheet.data[di] = tile.data[si];
      sheet.data[di + 1] = tile.data[si + 1];
      sheet.data[di + 2] = tile.data[si + 2];
      sheet.data[di + 3] = 255;
    }
  }
  console.log('rendered', s.name);
});

sheet.writePNG('tools/portraits.png');
console.log('wrote tools/portraits.png', sheet.width + 'x' + sheet.height);
