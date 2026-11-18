/**
 * Lightweight DOM sanity pass over index.html: every id the app script looks up
 * must exist, every markup section must be closed, and no media asset that the
 * page references may be missing from public/.
 */
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('src/main.js', 'utf8');
let fail = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond || !extra ? '' : ': ' + extra));
  if (!cond) fail++;
};

const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
ok('no duplicate element ids', dupes.length === 0, dupes.join(', '));

const refs = [...js.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
const missing = [...new Set(refs)].filter((r) => !ids.includes(r));
ok('every id the app looks up exists', missing.length === 0, missing.join(', '));

const imgs = [...html.matchAll(/src="\.\/(img\/[^"]+)"/g)].map((m) => m[1]);
const missingImg = [...new Set(imgs)].filter((p) => !fs.existsSync(path.join('public', p)));
ok('every <img> in the page exists on disk', missingImg.length === 0, missingImg.join(', '));

const openTags = (html.match(/<section/g) || []).length;
const closeTags = (html.match(/<\/section>/g) || []).length;
ok('<section> tags balance', openTags === closeTags, `${openTags} open / ${closeTags} close`);

ok('no leftover emoji in the markup', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html));
ok('no em dashes in the markup', !html.includes('\u2014'));
ok('no leftover glass helper class', !html.includes('class="hub-brand glass"'));
ok('the page still mounts the game script', html.includes('src="/src/main.js"'));

console.log('');
if (fail) {
  console.log(`HTML CHECKS FAILED (${fail} failed)`);
  process.exit(1);
}
console.log('HTML CHECKS PASSED');
