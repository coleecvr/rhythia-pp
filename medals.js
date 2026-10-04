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

// Symbols: stroked lines (class f fills, class t is text), drawn in the 26..74 box.
const T = (txt, size = 26, y = 59) => `<text class="t" x="50" y="${y}" font-size="${size}">${txt}</text>`;
const heart = (s = 1, dy = 0) => `<path transform="translate(50 ${50 + dy}) scale(${s}) translate(-50 -50)" d="M50 68 C32 56 28 45 33 38 C38 31 47 33 50 40 C53 33 62 31 67 38 C72 45 68 56 50 68 Z"/>`;
const crown = 'M33 62 L30 38 L41 48 L50 32 L59 48 L70 38 L67 62 Z';
const SYMBOLS = {
  // Skill: a journey into space
  'pass-1': '<path d="M28 62 H72"/><path d="M37 62 A13 13 0 0 1 63 62"/><path d="M50 41 V33 M36 47 L31 42 M64 47 L69 42"/>',
  'pass-2': '<path d="M50 27 C58 33 60 45 58 57 H42 C40 45 42 33 50 27 Z"/><circle cx="50" cy="43" r="4"/><path d="M42 50 L35 59 H42 M58 50 L65 59 H58"/><path d="M46 62 L50 72 L54 62"/>',
  'pass-3': '<circle cx="50" cy="50" r="11"/><ellipse cx="50" cy="50" rx="25" ry="8" transform="rotate(-20 50 50)"/>',
  'pass-4': '<circle class="f" cx="60" cy="40" r="8"/><path d="M53 47 L31 69 M51 39 L33 51 M61 49 L49 67"/>',
  'pass-5': '<path d="M50 50 C56 44 66 46 66 54 C66 64 54 70 44 66 M50 50 C44 56 34 54 34 46 C34 36 46 30 56 34"/><circle class="f" cx="50" cy="50" r="3.5"/><path d="M30 30 h0 M70 68 h0 M68 30 h0"/>',
  'pass-6': '<path d="M34 62 C25 62 25 49 34 49 C34 38 49 36 53 45 C57 38 69 41 67 51 C75 51 75 62 67 62 Z"/><path d="M42 27 V35 M38 31 H46 M66 26 V32 M63 29 H69"/>',
  'pass-7': '<path d="M50 25 L54 42 L69 33 L60 48 L75 51 L60 55 L69 70 L54 61 L50 76 L46 61 L31 70 L40 55 L25 51 L40 48 L31 33 L46 42 Z"/><circle class="f" cx="50" cy="51" r="4"/>',
  'pass-8': '<circle class="f" cx="50" cy="50" r="6"/><path d="M47 44 L41 26 H59 L53 44 M47 56 L41 74 H59 L53 56"/><circle cx="50" cy="50" r="15" stroke-dasharray="3 6"/>',
  'pass-9': '<ellipse cx="50" cy="52" rx="23" ry="7"/><circle class="f" cx="50" cy="52" r="5"/><path d="M50 44 V25 M50 60 V77 M45 30 L50 25 L55 30 M45 72 L50 77 L55 72"/>',
  'pass-10': '<ellipse cx="50" cy="50" rx="25" ry="9" transform="rotate(-12 50 50)"/><circle cx="50" cy="50" r="13"/><circle class="hole" cx="50" cy="50" r="9"/>',
  // Full combo: chains and gems
  'fc-1': '<rect x="33" y="42" width="34" height="16" rx="8" transform="rotate(-35 50 50)"/>',
  'fc-2': '<rect x="36" y="47" width="28" height="22" rx="4"/><path d="M42 47 V40 A8 8 0 0 1 58 40 V47"/><path d="M50 55 V61"/>',
  'fc-3': '<rect x="26" y="44" width="28" height="14" rx="7" transform="rotate(-30 40 51)"/><rect x="46" y="42" width="28" height="14" rx="7" transform="rotate(-30 60 49)"/>',
  'fc-4': '<circle cx="50" cy="50" r="21"/><path d="M39 51 L47 59 L62 42"/>',
  'fc-5': '<path d="M27 44 C33 38 39 38 45 44 S57 50 63 44 S73 40 73 40 M27 58 C33 52 39 52 45 58 S57 64 63 58 S73 54 73 54"/>',
  'fc-6': '<circle cx="50" cy="50" r="16"/><path d="M50 26 V36 M50 64 V74 M26 50 H36 M64 50 H74"/><circle class="f" cx="50" cy="50" r="3"/>',
  'fc-7': '<circle cx="50" cy="31" r="5"/><path d="M50 36 V71 M40 45 H60 M31 57 C33 67 42 71 50 71 C58 71 67 67 69 57"/>',
  'fc-8': '<path d="M35 50 C27 50 27 38 36 38 C37 30 49 28 53 35 C59 30 70 34 68 42 C74 43 74 50 66 50"/><path d="M52 45 L44 58 H54 L48 72"/>',
  'fc-9': '<path d="M50 25 C52 42 58 48 75 50 C58 52 52 58 50 75 C48 58 42 52 25 50 C42 48 48 42 50 25 Z"/>',
  'fc-10': '<ellipse cx="50" cy="30" rx="14" ry="4"/><path d="M50 39 L54 49 L65 50 L57 57 L59 68 L50 62 L41 68 L43 57 L35 50 L46 49 Z"/>',
  // Accuracy
  'ss': T('SS', 27),
  'ss-3': '<path d="M50 27 C58 39 64 47 64 56 A14 14 0 0 1 36 56 C36 47 42 39 50 27 Z"/><path d="M43 57 A7 7 0 0 0 50 64"/>',
  'ss-5': '<path d="M38 35 H62 L71 46 L50 72 L29 46 Z M29 46 H71 M44 35 L40 46 L50 72 M56 35 L60 46 L50 72"/>',
  'acc99-5': '<circle cx="45" cy="55" r="16"/><circle cx="45" cy="55" r="7"/><path d="M45 55 L70 30 M62 30 H70 V38"/>',
  'acc98-7': '<path d="M27 50 C35 37 65 37 73 50 C65 63 35 63 27 50 Z"/><circle class="f" cx="50" cy="50" r="6.5"/>',
  'nopause-5': '<path d="M42 35 V65 M58 35 V65"/><path d="M31 69 L69 31"/>',
  'ss-10': '<path d="M37 70 C25 62 25 40 35 29 M63 70 C75 62 75 40 65 29"/><path d="M32 59 l-6 -2 M30 48 l-6 0 M33 37 l-4 -4 M68 59 l6 -2 M70 48 l6 0 M67 37 l4 -4"/>' + T('SS', 17, 56),
  'acc98-25': '<path d="M34 64 V44 M44 64 V44 M54 64 V44 M64 64 V44 M29 67 H71 M31 40 H69" />',
  // Mods & speed
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
  'quickstep': '<path d="M42 33 L59 50 L42 67"/>',
  'speed': '<path d="M33 33 L50 50 L33 67 M50 33 L67 50 L50 67"/>',
  'overdrive': '<path d="M26 35 L41 50 L26 65 M41 35 L56 50 L41 65 M56 35 L71 50 L56 65"/><path d="M30 74 H70" stroke-dasharray="2 5"/>',
  // Dedication
  'plays-1': '<path d="M42 33 L65 48 L42 63 Z"/>',
  'plays-10': '<path d="M50 28 C58 38 62 45 62 53 A12 12 0 0 1 38 53 C38 45 43 43 46 37 C48 43 50 45 52 45 C52 39 51 33 50 28 Z"/>',
  'plays-50': '<rect x="33" y="35" width="34" height="29" rx="4"/><path d="M33 43 H67 M42 30 V37 M58 30 V37"/><path d="M42 51 h0 M50 51 h0 M58 51 h0 M42 58 h0 M50 58 h0"/>',
  'plays-100': T('100', 21, 55),
  'plays-250': '<path class="f" d="M50 66 C32 54 28 43 33 36 C38 29 47 31 50 38 C53 31 62 29 67 36 C72 43 68 54 50 66 Z"/>',
  'plays-500': '<path d="M50 48 C44 39 31 39 31 48 C31 57 44 57 50 48 C56 39 69 39 69 48 C69 57 56 57 50 48 Z"/>',
  'plays-1000': '<path d="M38 31 H62 V41 A12 12 0 0 1 38 41 Z M38 35 H31 A7 7 0 0 0 38 45 M62 35 H69 A7 7 0 0 1 62 45 M50 53 V59 M41 64 H59"/>',
  'maps-25': '<rect x="33" y="40" width="26" height="22" rx="3"/><path d="M39 35 H61 A3 3 0 0 1 64 38 V55"/><path d="M45 30 H66 A3 3 0 0 1 69 33 V49"/>',
  'maps-100': '<path d="M33 64 V33 H41 V64 Z M44 64 V37 H52 V64 Z M55 64 L61 33 L68 35 L62 66 Z M29 67 H71"/>',
  'maps-250': '<path d="M32 37 l3 3 l6 -6 M32 49 l3 3 l6 -6 M32 61 l3 3 l6 -6 M47 37 H67 M47 49 H67 M47 61 H67"/>',
  'marathon': '<circle cx="50" cy="53" r="16"/><path d="M50 53 V43 M45 31 H55 M50 31 V37 M62 39 L66 35"/>',
  'pioneer': '<path d="M40 70 V29 M40 31 H65 L58 39 L65 47 H40"/><path d="M29 70 H54"/>',
  'persistence': '<path d="M27 40 L39 62 L50 50 L71 31 M62 31 H71 V40"/><path d="M27 70 H73" stroke-dasharray="3 5"/>',
  // Performance
  'total-100': '<path d="M50 70 V32 M39 43 L50 32 L61 43"/>',
  'total-500': '<path d="M34 66 V57 M44 66 V49 M54 66 V41 M64 66 V32"/>',
  'total-1000': T('1K', 26),
  'total-2500': '<path d="M29 50 H71 M34 40 V60 M41 35 V65 M59 35 V65 M66 40 V60"/>',
  'total-5000': '<path d="M50 32 L55 43 L66 44 L58 52 L60 63 L50 57 L40 63 L42 52 L34 44 L45 43 Z"/><path d="M33 67 C40 72 60 72 67 67"/>',
  'total-10000': '<path d="M50 39 L57 50 L50 61 L43 50 Z"/><path d="M42 47 C34 43 28 45 25 39 C32 39 36 37 41 40 M42 54 C34 54 30 58 25 54 C32 52 36 50 42 51 M58 47 C66 43 72 45 75 39 C68 39 64 37 59 40 M58 54 C66 54 70 58 75 54 C68 52 64 50 58 51"/>',
  'play-100': '<path d="M55 27 L38 54 H50 L45 73 L63 45 H51 Z"/>',
  'play-200': '<path d="M50 27 L55 39 L68 35 L62 47 L73 55 L60 57 L61 70 L50 62 L39 70 L40 57 L27 55 L38 47 L32 35 L45 39 Z"/><path d="M50 42 V51 M50 56 V57"/>',
  'play-300': '<path d="M27 63 C33 57 37 57 41 61 C45 65 50 65 54 59 C58 47 50 37 40 41 C50 31 66 35 70 47 C72 55 68 63 73 63"/>',
  'play-400': '<circle cx="50" cy="50" r="21"/><circle cx="50" cy="50" r="5"/><path d="M61 30 L54 42 L62 46 L55 57"/>',
  // Mastery
  'first-1': T('#1', 27),
  'first-5': `<path d="${crown}"/><path d="M33 68 H67"/>`,
  'first-25': '<path d="M34 70 V40 H40 V33 H46 V40 H54 V33 H60 V40 H66 V70 Z M45 70 V58 A5 5 0 0 1 55 58 V70"/>',
  'dethrone': `<path transform="rotate(-24 50 46)" d="${crown}"/><path d="M58 70 L67 74 M63 64 L71 67"/>`,
  'tiers': ['#77f379', '#fff832', '#e24479', '#9d6eff', '#0094fc'].map((c, i) => `<path stroke="${c}" d="M${26 + i * 5} 64 A${24 - i * 5} ${24 - i * 5} 0 0 1 ${74 - i * 5} 64"/>`).join(''),
  'sheet-10': '<path d="M32 32 L64 64 M68 32 L36 64 M57 63 L65 55 M35 55 L43 63"/>',
  'sheet-50': '<rect x="35" y="33" width="30" height="37" rx="4"/><path d="M43 33 V29 H57 V33 M42 52 L48 58 L60 45"/>',
  'sheet-100': '<path d="M37 35 H57 L64 42 V69 H37 Z"/><path d="M28 72 L73 27 M66 27 H73 V34"/>',
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
