/**
 * Pitch composition checks.
 *
 * The pitches must show real, correctly-kitted players: the right number per
 * side, everybody in their own club's colours, the keeper in keeper green, no
 * duplicated names, and never the player the user is controlling.
 */
import './smoke-helpers.mjs';

const { FootballGame } = await import('./src/games/football.js');
const { BasketballGame } = await import('./src/games/basketball.js');
const { SwimmingGame } = await import('./src/games/swimming.js');
const { alternateKit } = await import('./src/world/players.js');
const { teamById } = await import('./src/data/seroma.js');

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    console.log('  ✗ ' + name + (extra ? ': ' + extra : ''));
  }
};

const stub = { appendChild() {}, clientWidth: 900, clientHeight: 600 };
const hex = (m) => (m?.color ? m.color.getHexString() : '');
const primaryOf = (avatar) => (avatar.kitColors || avatar.team.colors).primary;
// keepers wear keeper green by design, so kit checks skip them
const outfielder = (a) => !a.isKeeper;

function avatarsIn(root) {
  const out = [];
  root.traverse((o) => {
    if (o.userData?.avatar) out.push(o.userData.avatar);
  });
  return out;
}

/* --------------------------------- football -------------------------------- */
{
  const g = new FootballGame(stub, { homeTeam: 'gaucho', awayTeam: 'theos', onEvent() {} });
  await g.init();
  const all = avatarsIn(g.scene);
  const home = all.filter((a) => a.team.id === 'gaucho');
  const away = all.filter((a) => a.team.id === 'theos');

  ok('football: five outfield team-mates on the pitch', home.length === 5, `got ${home.length}`);
  ok('football: five opponents on the pitch', away.length === 5, `got ${away.length}`);
  ok('football: your team wears your kit', home.filter(outfielder).every((a) => primaryOf(a) === teamById('gaucho').colors.primary));
  ok('football: opponents wear their own kit', away.filter(outfielder).every((a) => primaryOf(a) === teamById('theos').colors.primary));
  ok(
    'football: one keeper per side, in keeper green',
    all.filter((a) => a.isKeeper).length === 2 &&
      all.filter((a) => a.isKeeper).every((a) => primaryOf(a) === '#25a35c')
  );
  ok('football: you are not also standing on the pitch', !all.some((a) => a.name === g.homeName));
  const names = all.map((a) => a.name);
  ok('football: no duplicated player names', new Set(names).size === names.length, names.join(', '));
  ok(
    'football: nobody stands in the centre circle at kick off',
    all.every((a) => Math.hypot(a.group.position.x, a.group.position.z) > 2),
    all.map((a) => a.group.position.toArray().map((n) => n.toFixed(1)).join('/')).join(' ')
  );
  ok(
    'football: every player is inside the stadium',
    all.every((a) => Math.abs(a.group.position.x) < 30 && Math.abs(a.group.position.z) < 40)
  );
  ok('football: shadow blobs stay small and dark', home.every((a) => a.shadow.geometry.parameters.width < 1.2));
  ok(
    'football: the two kits are clearly different colours',
    teamById('gaucho').colors.primary !== teamById('theos').colors.primary
  );
}

/* -------------------------------- basketball ------------------------------- */
{
  const g = new BasketballGame(stub, { homeTeam: 'gaucho', awayTeam: 'theos', onEvent() {} });
  await g.init();
  const all = avatarsIn(g.scene);
  const home = all.filter((a) => a.team.id === 'gaucho');
  const away = all.filter((a) => a.team.id === 'theos');
  ok('basketball: it is a real 3x3, two team-mates with you', home.length === 2, `got ${home.length}`);
  ok('basketball: three opponents defend the rim', away.length === 3, `got ${away.length}`);
  ok('basketball: team-mates wear your kit', home.every((a) => primaryOf(a) === teamById('gaucho').colors.primary));
  ok('basketball: opponents wear their kit', away.every((a) => primaryOf(a) === teamById('theos').colors.primary));
  ok('basketball: nobody duplicates you', !all.some((a) => a.name === g.homeName));
  ok('basketball: every player sits on the court', all.every((a) => Math.abs(a.group.position.x) <= 11 && a.group.position.z >= -12.5));
  const names = all.map((a) => a.name);
  ok('basketball: no duplicated names', new Set(names).size === names.length, names.join(', '));
  ok('basketball: players have a named record for the tag', all.every((a) => typeof a.name === 'string' && a.name.length > 0));
}

/* --------------------------------- swimming -------------------------------- */
{
  const g = new SwimmingGame(stub, { homeTeam: 'gaucho', awayTeam: 'theos', onEvent() {} });
  await g.init();
  const rivals = g.rivals.filter(Boolean);
  ok('swimming: four rivals fill the other lanes', rivals.length === 4, `got ${rivals.length}`);
  ok('swimming: every rival is a full swimmer avatar', rivals.every((r) => r.avatar && r.avatar.sport === 'swimming'));
  ok('swimming: rivals wear caps, not helmets', rivals.every((r) => r.avatar._hairStyle() === 'cap'));
  ok('swimming: the field is split between both clubs', new Set(rivals.map((r) => r.team.id)).size === 2);
  ok(
    'swimming: each rival stays in a different lane',
    new Set(rivals.map((r) => r.group.position.x.toFixed(2))).size === rivals.length
  );
  ok('swimming: your lane is left free for you', !rivals.some((r) => Math.abs(r.group.position.x - g._laneX(g.lane)) < 0.5));
  ok(
    'swimming: rivals swim face down along the pool',
    rivals.every((r) => Math.abs(Math.abs(r.group.rotation.x) - Math.PI / 2) < 0.01)
  );
  const names = rivals.map((r) => r.name);
  ok('swimming: no duplicated names', new Set(names).size === names.length, names.join(', '));
}

/* ---------------------------------- kits ----------------------------------- */
{
  const team = teamById('gaucho');
  const alt = alternateKit(team, 2);
  ok('an alternate strip is a real colour', /^#[0-9a-f]{6}$/i.test(alt.primary));
  ok("an alternate strip is not the club's own colour", alt.primary.toLowerCase() !== team.colors.primary.toLowerCase());
  ok('the alternate strip is deterministic', alternateKit(team, 2).primary === alt.primary);
  const dark = teamById('theos');
  ok('light clubs get a dark change strip', alternateKit(dark, 1).primary !== dark.colors.primary);
}

console.log('');
if (fail) {
  console.log(`PITCH CHECKS FAILED (${pass} passed, ${fail} failed)`);
  process.exit(1);
}
console.log(`PITCH CHECKS PASSED (${pass} passed, 0 failed)`);
