/**
 * Club crests, drawn as SVG so they stay crisp at any size and cost nothing to
 * download. Each club gets a shield in its own kit colours with its initials,
 * a stripe and a star — so the twelve clubs read as distinct badges rather
 * than twelve coloured chips.
 */
import { initials } from '../data/seroma.js';

function esc(v) {
  return String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Is this a light colour? Drives the text colour on the badge. */
function isLight(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
}

/**
 * A shield crest for a club.
 * @param {object} team  a TEAMS entry
 * @param {object} opts  { size, label }
 * @returns {string} SVG markup
 */
export function crestSVG(team, { size = 64, label = null } = {}) {
  const primary = team.colors?.primary || '#0f5132';
  const secondary = team.colors?.secondary || '#f6efdc';
  const text = isLight(primary) ? '#12211a' : '#ffffff';
  const name = label || initials(team.name) || team.name.slice(0, 2).toUpperCase();
  const id = 'c-' + team.id;

  return `<svg class="crest-svg" width="${size}" height="${size}" viewBox="0 0 64 72" role="img"
    aria-label="${esc(team.name)} crest" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${primary}" stop-opacity="1"/>
        <stop offset="1" stop-color="${primary}" stop-opacity="0.82"/>
      </linearGradient>
      <clipPath id="${id}-clip">
        <path d="M32 2 L60 10 V38 C60 54 46 64 32 70 C18 64 4 54 4 38 V10 Z"/>
      </clipPath>
    </defs>
    <path d="M32 2 L60 10 V38 C60 54 46 64 32 70 C18 64 4 54 4 38 V10 Z"
      fill="url(#${id})" stroke="${secondary}" stroke-width="2.5"/>
    <g clip-path="url(#${id}-clip)">
      <rect x="26" y="-4" width="12" height="80" fill="${secondary}" opacity="0.85"/>
      <rect x="4" y="52" width="56" height="4" fill="${secondary}" opacity="0.5"/>
    </g>
    <text x="32" y="34" text-anchor="middle" font-family="system-ui, sans-serif"
      font-size="${name.length > 2 ? 17 : 21}" font-weight="900" fill="${text}"
      letter-spacing="0.5">${esc(name)}</text>
    <path d="M32 44 l2.6 5.4 6 .8 -4.4 4.2 1.1 5.9 -5.3 -2.9 -5.3 2.9 1.1 -5.9 -4.4 -4.2 6 -.8 Z"
      fill="${secondary}" opacity="0.92"/>
  </svg>`;
}

/** Small pill of the club colours, for lists. */
export function kitSwatch(team) {
  const a = team.colors?.primary || '#0f5132';
  const b = team.colors?.secondary || '#f6efdc';
  return `<span class="kit-swatch" style="--a:${a};--b:${b}" aria-hidden="true"></span>`;
}
