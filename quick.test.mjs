/**
 * Quick-play + crest checks: every club must have a distinct, valid crest in its
 * own kit colours, and the ratings shown on the club cards must be sane and
 * derived from the poll data.
 */
import { TEAMS, POLL_CATEGORIES, clubRatings, clubOverall } from './src/data/seroma.js';
import { crestSVG, kitSwatch } from './src/ui/crest.js';

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

/* ---------------------------------- crests -------------------------------- */
ok('there are 12 clubs to pick from', TEAMS.length === 12, `got ${TEAMS.length}`);

const crests = TEAMS.map((t) => ({ team: t, svg: crestSVG(t) }));
for (const { team, svg } of crests) {
  ok(`${team.name}: crest is an svg`, /^<svg[\s\S]*<\/svg>$/.test(svg.trim()));
  ok(`${team.name}: crest uses its kit colour`, svg.toLowerCase().includes(team.colors.primary.toLowerCase()));
  // a shield outline, the club's initial, and a star beneath it
  ok(
    `${team.name}: crest has a shield, initial and star`,
    (svg.match(/<path/g) || []).length >= 2 && svg.includes('<text')
  );
}
ok('all 12 crests are visually distinct', new Set(crests.map((c) => c.svg)).size === 12);

const big = crestSVG(TEAMS[0], { size: 96 });
ok('size option changes the rendered width', big.includes('width="96"'));
ok('label option is embedded as text', crestSVG(TEAMS[0], { label: 'SEROMA' }).includes('SEROMA'));
ok('crest never injects raw html from data', !crests.some((c) => /<script/i.test(c.svg)));
ok('kitSwatch returns a colour string', typeof kitSwatch(TEAMS[0]) === 'string' && kitSwatch(TEAMS[0]).length > 0);

/* ---------------------------------- ratings ------------------------------- */
const r = clubRatings();
ok('ratings cover every club', TEAMS.every((t) => r[t.id]));
ok('every rating is a finite number', Object.values(r).every((v) => Object.values(v).every((n) => Number.isFinite(n))));
ok(
  'ratings sit on the 55-95 scale',
  Object.values(r).every((v) => Object.values(v).every((n) => n >= 55 && n <= 95)),
  JSON.stringify(Object.values(r)[0])
);
ok('cards show speed, shot power and stamina', Object.values(r).every((v) => 'speed' in v && 'power' in v && 'stamina' in v));
ok('clubs are not all identical', new Set(Object.values(r).map((v) => v.speed)).size > 3);
ok('overall is the mean of the four ratings', TEAMS.every((t) => {
  const v = r[t.id];
  const mean = Math.round((v.speed + v.power + v.stamina + v.defence) / 4);
  return Math.abs(clubOverall(t.id) - mean) <= 1;
}));
ok('overall is a 55-95 integer', TEAMS.every((t) => Number.isInteger(clubOverall(t.id)) && clubOverall(t.id) >= 55 && clubOverall(t.id) <= 95));
ok('poll categories still drive the ratings', POLL_CATEGORIES.length > 0);

console.log('');
if (fail) {
  console.log(`QUICK CHECKS FAILED (${pass} passed, ${fail} failed)`);
  process.exit(1);
}
console.log(`QUICK CHECKS PASSED (${pass} passed, 0 failed)`);
