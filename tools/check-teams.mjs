/** Prints every figure placed on each pitch, so team/kit problems are visible. */
import '../smoke-helpers.mjs';
import * as THREE from 'three';

const { FootballGame } = await import('../src/games/football.js');
const { BasketballGame } = await import('../src/games/basketball.js');
const { SwimmingGame } = await import('../src/games/swimming.js');

const stub = { appendChild() {}, clientWidth: 800, clientHeight: 600 };
const opts = { homeTeam: 'gaucho', awayTeam: 'theos', onEvent: () => {} };

function walk(root, out = []) {
  root.traverse((o) => {
    if (o.userData?.avatar) out.push(o.userData.avatar);
  });
  return out;
}

for (const [name, Cls] of [
  ['football', FootballGame],
  ['basketball', BasketballGame],
  ['swimming', SwimmingGame],
]) {
  const g = new Cls(stub, opts);
  await g.init();
  console.log('\n===', name, '| home', g.homeTeam.id, 'away', g.awayTeam?.id, '| user:', g.homeName);
  const avatars = walk(g.scene);
  for (const a of avatars) {
    console.log('  avatar', a.sport.padEnd(10), 'team', String(a.team.id).padEnd(12), (a.team.colors?.primary || '').padEnd(8), a.name, '@', a.group.position.toArray().map((n) => n.toFixed(1)).join(','));
  }
  if (g.rivals) {
    for (const r of g.rivals) if (r) console.log('  rival  swimming  ', r.name, '@', r.group.position.toArray().map((n) => n.toFixed(2)).join(','));
  }
  if (g.defenders) console.log('  defenders:', g.defenders.length);
  console.log('  scene children:', g.scene.children.length);
}
