// Medal artwork: every medal is drawn as SVG from its id. A frame for its group, a colour for its tier (bronze,
// silver, gold, platinum, prismatic) and a symbol of its own. Original designs for this site.

const TIER_NAMES = ['', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Prismatic'];
// Per tier: rim light, rim mid, rim dark, symbol colour.
const TIERS = {
  1: ['#ffc797', '#c8773a', '#6b3412', '#ffd9b5'],
  2: ['#ffffff', '#b4c0d2', '#566078', '#f2f6ff'],
  3: ['#fff1b8', '#f2b52c', '#87560a', '#ffe89a'],
  4: ['#e4fdff', '#62cdea', '#1b5a82', '#d7f8ff'],
  5: ['#ffffff', '#c39bff', '#3b2a7a', '#ffffff'],
};
const PRISM = ['#ff7ad9', '#ffb36b', '#fff27a', '#7dffb0', '#5ad1ff', '#a98bff'];
const GROUP_COLOR = { skill: '#f0a030', fc: '#3aa6ff', accuracy: '#e0476f', mods: '#2fc4b4', dedication: '#f0703a', performance: '#2fb866', mastery: '#8a4ff0' };

// Frames (100 × 100). The face is the same shape, scaled in.
const scallop = (() => {
  const n = 14, pts = [];
  for (let i = 0; i < n * 2; i++) { const a = (Math.PI * i) / n - Math.PI / 2, r = i % 2 ? 41 : 47; pts.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`); }
  return `M${pts.join(' L')} Z`;
})();
const FRAMES = {
  skill: 'M50 4 A46 46 0 1 1 49.9 4 Z',
  fc: 'M50 3 L97 50 L50 97 L3 50 Z',
  accuracy: 'M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z',
  mods: 'M32 6 H68 A26 26 0 0 1 94 32 V68 A26 26 0 0 1 68 94 H32 A26 26 0 0 1 6 68 V32 A26 26 0 0 1 32 6 Z',
  dedication: 'M50 4 L88 16 V46 C88 70 72 86 50 96 C28 86 12 70 12 46 V16 Z',
  performance: 'M31 4 H69 L96 31 V69 L69 96 H31 L4 69 V31 Z',
  mastery: scallop,
};

// Symbols: stroked lines (class f fills, class t is text), drawn in the 26..74 box. Each one shows what the medal asks
// for (its condition), not its name: the stars of the map, the accuracy, the count, the PP, the mod or the speed.
const T = (txt, size = 26, y = 59) => `<text class="t" x="50" y="${y}" font-size="${size}">${txt}</text>`;
const heart = (s = 1, dy = 0) => `<path transform="translate(50 ${50 + dy}) scale(${s}) translate(-50 -50)" d="M50 68 C32 56 28 45 33 38 C38 31 47 33 50 40 C53 33 62 31 67 38 C72 45 68 56 50 68 Z"/>`;
/** A filled five-point star at (x, y), r across. */
const star = (x, y, r) => `<path class="f" stroke="none" d="M${Array.from({ length: 10 }, (_, i) => { const a = (Math.PI * i) / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; return `${(x + q * Math.cos(a)).toFixed(2)} ${(y + q * Math.sin(a)).toFixed(2)}`; }).join(' L')} Z"/>`;
/** n stars in an arc over the top of the face: the star rating the medal asks for. */
const stars = n => {
  const r = n > 7 ? 3.1 : n > 4 ? 3.7 : 4.6, span = Math.min(156, (n - 1) * (n > 7 ? 17.5 : 24)) * Math.PI / 180;
  return Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (n > 1 ? -span / 2 + (span * i) / (n - 1) : 0); return star(50 + 25 * Math.cos(a), 61 + 25 * Math.sin(a), r); }).join('');
};
const small = d => `<path stroke-width="2.8" d="${d}"/>`;
const PLAY = '<path class="f" stroke="none" d="M45 25 L57 32 L45 39 Z"/>';   // one play
const BARS = small('M42 38 V34 M48 38 V30 M54 38 V27 M60 38 V24');   // a total, adding up
const GRID = small('M42 25 H58 V39 H42 Z M47.3 25 V39 M52.7 25 V39 M42 29.7 H58 M42 34.3 H58');   // a map (the 3×3 grid)
const count = (icon, n) => icon + T(n, n.length > 2 ? 17 : n.length > 1 ? 21 : 25, 66);
const points = (icon, n) => icon + T(n, n.length > 2 ? 18 : 21, 60) + T('pp', 10, 72);
const chevrons = (k, pct) => small(Array.from({ length: k }, (_, i) => { const x = 50 - (k - 1) * 4 + i * 8; return `M${x - 3} 27 L${x + 2} 32 L${x - 3} 37`; }).join(' ')) + T(pct, 15, 62);
const PASS = '<path d="M39 57 L47 65 L62 49"/>';   // passed
const CHAIN = '<rect x="31" y="51" width="22" height="13" rx="6.5"/><rect x="47" y="51" width="22" height="13" rx="6.5"/>';   // unbroken: no misses
const SHEET = '<rect x="34" y="31" width="32" height="40" rx="4"/><path d="M43 31 V27 H57 V31"/>';   // the challenge sheet
const SYMBOLS = {
  // Skill: pass a ranked map at n stars
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`pass-${i + 1}`, PASS + stars(i + 1)])),
  // Full combo: no misses on a ranked map at n stars
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`fc-${i + 1}`, CHAIN + stars(i + 1)])),
  // Accuracy
  'ss': T('SS', 27),
  'ss-3': T('SS', 21, 68) + stars(3),
  'ss-5': T('SS', 21, 68) + stars(5),
  'acc99-5': T('99%', 17, 68) + stars(5),
  'acc98-7': T('98%', 17, 68) + stars(7),
  'nopause-5': '<path d="M45 50 V70 M55 50 V70"/><path d="M37 71 L63 49"/>' + stars(5),
  'ss-10': T('SS', 21, 53) + T('×10', 14, 71),
  'acc98-25': T('98%', 17, 53) + T('×25', 14, 71),
  // Mods & speed: the mod itself
  'ghost': '<path d="M36 70 V46 A14 14 0 0 1 64 46 V70 L59 65 L54 70 L50 65 L46 70 L41 65 Z"/><circle class="f" cx="44" cy="48" r="2.6"/><circle class="f" cx="56" cy="48" r="2.6"/>',
  'strobe': '<circle cx="50" cy="50" r="8"/><path d="M50 28 V36 M50 64 V72 M28 50 H36 M64 50 H72 M35 35 L40 40 M60 60 L65 65 M65 35 L60 40 M35 65 L40 60"/>',
  'chaos': '<path d="M29 40 H39 C49 40 51 60 61 60 H71 M65 54 L71 60 L65 66 M29 60 H39 C43 60 45 56 47 52 M53 47 C55 43 57 40 61 40 H71 M65 34 L71 40 L65 46"/>',
  'earthquake': '<path d="M50 25 L44 37 L55 45 L42 57 L53 65 L48 75"/><path d="M28 71 H40 M60 71 H72"/>',
  'vortex': '<path d="M50 50 a2 2 0 1 1 4 0 a6 6 0 1 1 -12 0 a10 10 0 1 1 20 0 a14 14 0 1 1 -28 0 a18 18 0 1 1 36 0"/>',
  'hardrock': '<path d="M27 68 L33 45 L47 32 L64 35 L73 51 L69 68 Z"/><path d="M47 32 L52 49 L73 51 M52 49 L41 68"/>',
  'flashlight': '<path d="M31 60 L45 46 L56 57 L42 71 Z M45 46 L50 41 L61 52 L56 57"/><path d="M58 37 L64 29 M64 43 L74 39 M53 33 L54 23"/>',
  'nearsighted': '<circle cx="37" cy="53" r="10"/><circle cx="63" cy="53" r="10"/><path d="M47 52 Q50 47 53 52 M27 51 L22 43 M73 51 L78 43"/>',
  'mirror': '<path d="M50 27 V73" stroke-dasharray="4 5"/><path d="M44 35 L29 61 H44 Z M56 35 L71 61 H56 Z"/>',
  'suddendeath': heart(1.05) + '<path d="M50 41 L45 50 L54 56 L50 66"/>',
  'noregen': heart(0.8, -6) + '<path d="M50 64 V74 M45 69 L50 74 L55 69"/>',
  'invert': '<path d="M40 29 V71 M33 36 L40 29 L47 36 M60 71 V29 M53 64 L60 71 L67 64"/>',
  'quickstep': chevrons(1, '115%'),
  'speed': chevrons(2, '130%'),
  'overdrive': chevrons(3, '145%'),
  // Dedication: how many plays, how many maps
  'plays-1': count(PLAY, '1'),
  'plays-10': count(PLAY, '10'),
  'plays-50': count(PLAY, '50'),
  'plays-100': count(PLAY, '100'),
  'plays-250': count(PLAY, '250'),
  'plays-500': count(PLAY, '500'),
  'plays-1000': count(PLAY, '1K'),
  'maps-25': count(GRID, '25'),
  'maps-100': count(GRID, '100'),
  'maps-250': count(GRID, '250'),
  'marathon': '<circle cx="50" cy="54" r="18"/><path d="M45 31 H55 M50 31 V36 M64 40 L67 37"/>' + T('5:00', 11, 58.5),
  'pioneer': '<path d="M40 70 V29 M40 31 H65 L58 39 L65 47 H40"/><path d="M29 70 H54"/>',
  'persistence': '<path d="M66 47 A17 17 0 1 1 61 37"/><path d="M62 29 V38 H53"/>' + T('10', 14, 58),
  // Performance: PP in total, PP in one play
  'total-100': points(BARS, '100'),
  'total-500': points(BARS, '500'),
  'total-1000': points(BARS, '1K'),
  'total-2500': points(BARS, '2.5K'),
  'total-5000': points(BARS, '5K'),
  'total-10000': points(BARS, '10K'),
  'play-100': points(PLAY, '100'),
  'play-200': points(PLAY, '200'),
  'play-300': points(PLAY, '300'),
  'play-400': points(PLAY, '400'),
  // Mastery
  'first-1': T('#1', 27),
  'first-5': T('#1', 22, 53) + T('×5', 14, 71),
  'first-25': T('#1', 22, 53) + T('×25', 14, 71),
  'dethrone': small('M36 30 H62 M58 26 L62 30 L58 34 M64 40 H38 M42 36 L38 40 L42 44') + T('#1', 22, 68),
  'tiers': ['#77f379', '#fff832', '#e24479', '#9d6eff', '#0094fc'].map((c, i) => `<path stroke="${c}" d="M${26 + i * 5} 64 A${24 - i * 5} ${24 - i * 5} 0 0 1 ${74 - i * 5} 64"/>`).join(''),
  'sheet-10': SHEET + T('10', 15, 58),
  'sheet-50': SHEET + T('50', 15, 58),
  'sheet-100': SHEET + T('100', 12, 57),
};

let uid = 0;
/** A medal's artwork as an SVG string. medal: { id, group, tier }. size in pixels. */
export function medalSVG(medal, size = 64) {
  const tier = Math.min(5, Math.max(1, medal.tier || 1)), [light, mid, dark, ink] = TIERS[tier];
  const frame = FRAMES[medal.group] ?? FRAMES.skill, g = GROUP_COLOR[medal.group] ?? '#9670f5';
  const id = `md${++uid}`;
  const rim = tier === 5
    ? `<linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1">${PRISM.map((c, i) => `<stop offset="${i / (PRISM.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`
    : `<linearGradient id="${id}r" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.45" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`;
  const number = /^(pass|fc)-(\d+)$/.exec(medal.id)?.[2];
  // Series medals (1★ to 10★) carry their number on a small ribbon at the bottom.
  const series = number ? `<g class="ribbon"><rect x="${number.length > 1 ? 33 : 36}" y="80" width="${number.length > 1 ? 34 : 28}" height="15" rx="7.5" fill="#120e22" stroke="${tier === 5 ? '#c39bff' : mid}" stroke-width="1.6"/><text class="n" x="50" y="91.5" font-size="10.5" fill="${ink}">${number}★</text></g>` : '';
  const symbol = SYMBOLS[medal.id] ?? T('★', 26);
  return `<svg class="medal-art tier-${tier}" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${String(medal.name ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}">
    <defs>${rim}
      <radialGradient id="${id}f" cx="0.5" cy="0.32" r="0.78"><stop class="g" offset="0" stop-color="${g}" stop-opacity="0.55"/><stop offset="0.55" stop-color="#1c1633"/><stop offset="1" stop-color="#0d0a18"/></radialGradient>
    </defs>
    <path class="rim" d="${frame}" fill="url(#${id}r)"/>
    <path d="${frame}" fill="url(#${id}f)" transform="translate(50 50) scale(0.84) translate(-50 -50)"/>
    <path d="${frame}" fill="none" stroke="${tier === 5 ? '#fff' : light}" stroke-opacity="0.35" stroke-width="1.2" transform="translate(50 50) scale(0.84) translate(-50 -50)"/>
    <g class="sym" fill="none" stroke="${ink}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" style="--ink:${ink}">${symbol}</g>
    ${series}
  </svg>`;
}

export const tierName = tier => TIER_NAMES[tier] ?? '';
/** The colour a medal group is drawn in (its face tint), for the page to echo. */
export const groupColor = group => GROUP_COLOR[group] ?? '#9670f5';
