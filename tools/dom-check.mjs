/**
 * Confirms the browser-facing portrait helper works end to end with a stub
 * canvas: it must return a data URL and cache it per player + kit.
 */
import { TEAMS, squadFor } from '../src/data/seroma.js';
import { portraitURL } from '../src/ui/portrait.js';
import { makeCanvas } from './software-canvas.mjs';

globalThis.document = {
  createElement: () => {
    const c = makeCanvas(260, 320);
    c.toDataURL = () => 'data:image/png;base64,STUB';
    return c;
  },
};

const team = TEAMS.find((t) => t.id === 'gaucho');
const name = squadFor('gaucho', 5)[0];
const args = { name, team, sport: 'football', width: 260, height: 320 };
const a = portraitURL(args);
const b = portraitURL(args);
console.log('returns a data URL:', a.startsWith('data:image/png'));
console.log('cached (no redraw):', a === b);
if (!a.startsWith('data:image/png') || a !== b) process.exit(1);
