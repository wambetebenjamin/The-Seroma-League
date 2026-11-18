/**
 * Portrait checks: the player illustrations must be varied, on-palette and
 * actually drawn (not blank canvases). Uses the software canvas so the pixel
 * output can be inspected without a GPU.
 */
import { makeCanvas } from './tools/software-canvas.mjs';
import { TEAMS, squadFor } from './src/data/seroma.js';
import { drawPortrait, portraitLook } from './src/ui/portrait.js';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    console.log('  ✗ ' + name + (extra ? ' — ' + extra : ''));
  }
};

const W = 200;
const H = 250;
const team = (id) => TEAMS.find((t) => t.id === id) || TEAMS[0];

function render(name, t, sport = 'football') {
  const c = makeCanvas(W, H);
  drawPortrait(c.getContext(), W, H, { name, team: t, sport });
  return c;
}

function stats(c) {
  let opaque = 0;
  const colors = new Set();
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  for (let i = 0; i < c.data.length; i += 4) {
    if (c.data[i + 3] > 8) opaque++;
    rSum += c.data[i];
    gSum += c.data[i + 1];
    bSum += c.data[i + 2];
    if (c.data[i + 3] > 200) {
      colors.add(
        `${Math.round(c.data[i] / 16)},${Math.round(c.data[i + 1] / 16)},${Math.round(c.data[i + 2] / 16)}`
      );
    }
  }
  const n = c.data.length / 4;
  return {
    coverage: opaque / n,
    colors: colors.size,
    avg: [rSum / n, gSum / n, bSum / n],
  };
}

function diff(a, b) {
  let d = 0;
  for (let i = 0; i < a.data.length; i += 4) d += Math.abs(a.data[i] - b.data[i]);
  return d / (a.data.length / 4) / 255;
}

/* ------------------------------ individuals ------------------------------- */
const gaucho = team('gaucho');
const theos = team('theos');

const deng = render('Deng Martin', team('levites'));
const s1 = stats(deng);
ok('portrait fills the card', s1.coverage > 0.98, 'coverage ' + s1.coverage.toFixed(2));
ok('portrait is a rich illustration, not flat colour', s1.colors > 40, s1.colors + ' colour buckets');
ok('portrait is bright, like the renders', s1.avg[0] + s1.avg[1] + s1.avg[2] > 240, s1.avg.map((v) => v.toFixed(0)).join(','));

const same = render('Deng Martin', team('levites'));
ok('same player renders identically every time', diff(deng, same) < 0.001);

const other = render('Arinda Baker', team('levites'));
ok('different players look different', diff(deng, other) > 0.02, 'diff ' + diff(deng, other).toFixed(3));

/* kit colours must actually change the illustration */
const red = render('Deng Martin', gaucho);
const teal = render('Deng Martin', theos);
ok('club colours change the kit', diff(red, teal) > 0.02, 'diff ' + diff(red, teal).toFixed(3));

/* sport changes the kit cut */
const ball = render('Deng Martin', gaucho, 'basketball');
const swim = render('Deng Martin', gaucho, 'swimming');
ok('basketball kit differs from football', diff(red, ball) > 0.008, 'diff ' + diff(red, ball).toFixed(3));
ok('swimming kit differs from football', diff(red, swim) > 0.02, 'diff ' + diff(red, swim).toFixed(3));

/* --------------------------- squad-wide variety ---------------------------- */
const seen = new Set();
const squads = TEAMS.flatMap((t) => squadFor(t.id, 5).map((n) => ({ n, t })));
for (const { n, t } of squads) {
  const look = portraitLook(n, t, 'football');
  seen.add(`${look.skin.base}|${look.hairStyle}|${look.hair}|${look.number}`);
}
ok('the whole league is not clones', seen.size > squads.length * 0.7, `${seen.size} distinct looks / ${squads.length} players`);

const styles = new Set(TEAMS.flatMap((t) => squadFor(t.id, 5)).map((n) => portraitLook(n, team('theos'), 'football').hairStyle));
ok('several hair styles appear across the league', styles.size >= 4, [...styles].join(', '));

const skinTones = new Set(TEAMS.flatMap((t) => squadFor(t.id, 5)).map((n) => portraitLook(n, team('theos')).skin.base));
ok('skin tones vary across the league', skinTones.size >= 4, skinTones.size + ' tones');

/* every player in every club renders without throwing (squads vary in size) */
let rendered = 0;
let expected = 0;
for (const t of TEAMS) {
  const squad = squadFor(t.id, 5);
  expected += squad.length;
  for (const n of squad) {
    const c = render(n, t, 'football');
    if (stats(c).coverage > 0.9) rendered++;
  }
}
ok('all squads render cleanly', rendered === expected, `${rendered} / ${expected} portraits`);

/* name robustness */
for (const weird of ['', 'A', 'Ssenyondo Nelly', 'Kaaya Joel', 'FC Gaucho Captain', 'xx'.repeat(20)]) {
  const c = render(weird, gaucho);
  ok(`handles name "${weird.slice(0, 20)}"`, stats(c).coverage > 0.9);
}

console.log(`\nPORTRAIT CHECKS ${fail === 0 ? 'PASSED' : 'FAILED'} (${pass} passed, ${fail} failed)`);
if (fail) process.exit(1);
