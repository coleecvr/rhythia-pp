// Rhythia Community PP: single-page site. No framework, no build step.
// The Calculator and the detailed How PP works page load the rating code (core/) only when opened. The public copy of
// the site has neither: it gets every number it shows from the data, so the rating code never leaves this computer.
import { api, ready, coverUrl, replayFileUrl, songUrl, isStatic, config } from './data.js?v=6a26c08b60';
import { playerKey, fromPlayerKey, safeDecode } from './keys.js?v=9c69f5e339';
import { compareBest } from './compare.js?v=33eaed7091';
import { medalSVG, tierName, groupColor } from './medals.js?v=4e9367232b';
import { finishLogin, refreshMe } from './me.js?v=a79932f474';
import { speedInfo, presetInfo, NIGHTLY_PRESETS, REWRITE_PRESETS, MAP_SPEEDS } from './speed.js?v=53b4278b15';
import { inBand, POOL_FILTERS, poolShows } from './filters.js?v=e39f505a04';

const app = document.getElementById('app');
// What is on screen is one container per draw (route() makes it and puts it in #app at once, so document.getElementById still finds what a page
// draws). A page takes its container when it is called, before its first await: a page whose data arrives late draws into the container it
// had, which is no longer on screen, and cannot overwrite the page the visitor has gone to since.
let shown = app;
const currentPage = () => shown;

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;
const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = a => `${fmt(a * 100)}%`;
const pp = n => `${fmt(n, 0)}pp`;
const dur = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const ago = t => { const s = Date.now() / 1000 - t; if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`; if (s < 86400) return `${Math.round(s / 3600)}h ago`; return `${Math.round(s / 86400)}d ago`; };
const tier = s => (s < 1.5 ? 'easy' : s < 3 ? 'medium' : s < 5 ? 'hard' : s < 7.5 ? 'insane' : 'illogical');
const TIER_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard', insane: 'Insane', illogical: 'Illogical' };
const stars = (s, big = false) => `<span class="stars t-${tier(s)}${big ? ' big' : ''}" title="${fmt(s)} stars">${fmt(s)}</span>`;
const GRADES = [['SS', 1], ['S', 0.98], ['A', 0.95], ['B', 0.9], ['C', 0.85], ['D', 0.8], ['F', 0]];   // the game's grades
const gradeOf = a => GRADES.find(([, min]) => a >= min - 1e-9)[0];
// A play's grade has its own look at the top (the same as the bot's grade emojis): an SS (always a full combo) shines,
// an S one miss short of it is silver, and either one set with a mod that raises PP is "charged": glowing on dark.
const grade = (a, lg = false, play = null) => {
  const g = gradeOf(a), near = g === 'S' && play?.misses === 1, charged = !!play?.boosted && (g === 'SS' || g === 'S');
  const look = `${near ? 'S1' : g}${charged ? 'x' : ''}`;
  const title = [`Grade ${g}`, g === 'SS' && play ? 'full combo' : near ? 'one miss from a full combo' : '', charged ? 'with a mod that raises PP' : ''].filter(Boolean).join(' · ');
  return `<span class="grade g-${look}${lg ? ' lg' : ''}" title="${title}">${charged ? `<b>${g}</b>` : g}</span>`;
};
/** In place of PP on an unranked map: it says so, with what the play would be worth beside it. */
const unranked = v => `<span class="unr" title="Unranked map: plays here don't count toward totals yet">UNRANKED</span><small>${pp(v)} if ranked</small>`;
// A play's speed (as its game says it: "< 87%" for Nightly's < button, "90%" for Rewrite) and its mods, as pills.
const speedPill = (speed, format) => { const i = speedInfo(speed, format); return i.normal ? '' : `<span class="pill speed" title="${esc(i.title)}">${esc(i.text)}</span>`; };
const mods = (list, speed, format = null) => [speedPill(speed, format), ...(list ?? []).map(m => `<span class="pill">${esc(m)}</span>`)].filter(Boolean).join(' ');
const demoPill = d => (d ? ' <span class="pill demo">demo</span>' : '');
/** A play's status as a small label: a failed run says "failed", not "rejected" (that word is for plays refused for a rule). */
const statusPill = (s, failed = false) => { const w = failed && s === 'rejected' ? 'failed' : s; return `<span class="pill ${esc(w)}">${esc(w)}</span>`; };
const PALETTE = ['#9670f5', '#e24479', '#0094fc', '#27c46f', '#ff9f2e', '#3fd4c4', '#d05ce3'];
const colorFor = name => PALETTE[[...String(name)].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7) % PALETTE.length];
/** A player's Discord profile picture when they have one, otherwise their initial on a colour. */
const avatar = (name, cls = '', url = null) => `<span class="avatar ${cls}" data-initial="${esc([...String(name)][0]?.toUpperCase() ?? '?')}" style="--av:${colorFor(name)}">${url ? `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>`;
const coverImg = id => (coverUrl(id) ? `<img src="${coverUrl(id)}" alt="" loading="lazy">` : '');
const cover = (mapId, size, s = null) => `<span class="cover ${size}${s != null ? ` t-${tier(s)}` : ''}">${coverImg(mapId)}</span>`;
const coverBg = id => (coverUrl(id) ? `<div class="bg" style="background-image:url('${coverUrl(id)}')"></div>` : '');
const playerLink = name => `#/player/${enc(name)}`;
/** "Copy link" button for a shareable path (/m/1, /p/name, /r/5): those links show a preview card in Discord. */
const share = path => `<button class="btn ghost small" data-share="${esc(path.replace(/^\//, ''))}" aria-live="polite">Copy link</button>`;

// Images that fail to load hide themselves (an initial or a note grid shows underneath).
document.addEventListener('error', e => { if (e.target instanceof HTMLImageElement) e.target.classList.add('broken'); }, true);

function setTab(name) {
  for (const a of document.querySelectorAll('.tabs a')) a.classList.toggle('active', a.dataset.tab === name);
  // On a phone the tabs are one swipeable row: bring the current one into view.
  document.querySelector('.tabs a.active')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

/**
 * Rows and tables that scroll sideways (the tabs, a player page's sections, wide tables) fade at the edge they continue
 * past, and only there: phones hide the scrollbar, so nothing else says there is more.
 */
function scrollHints(root = document) {
  for (const el of root.querySelectorAll('.tabs, .pf-nav, .table-wrap')) {
    if (!el.scrollHint) {
      el.scrollHint = () => {
        el.classList.toggle('more-right', el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
        el.classList.toggle('more-left', el.scrollLeft > 4);
      };
      el.addEventListener('scroll', el.scrollHint, { passive: true });
    }
    el.scrollHint();
  }
}
window.addEventListener('resize', () => scrollHints());

/**
 * Interactive line chart. values: numbers; opts: { min, max, invert (bigger = lower), yTicks: [{ v, label }],
 * xTicks: [{ i, label }], tip: i => html, rating: { v, label }, marker: index }.
 * Lines are SVG; labels are HTML so they stay crisp at any width.
 */
function chart(el, values, opts) {
  const { min = 0, max = Math.max(...values, 1), invert = false, yTicks = [], xTicks = [], tip, rating, marker } = opts;
  const n = values.length;
  const X = i => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const Y = v => { const f = (v - min) / (max - min || 1); return invert ? f * 100 : 100 - f * 100; };
  const pts = values.map((v, i) => `${X(i).toFixed(3)},${Y(v).toFixed(3)}`);
  const id = `g${Math.random().toString(36).slice(2, 8)}`;
  el.classList.add('chart');
  el.innerHTML = `
    ${yTicks.map(t => `<div class="grid-line" style="top:${Y(t.v)}%"></div><div class="ylab" style="top:${Y(t.v)}%">${t.label}</div>`).join('')}
    ${xTicks.map(t => `<div class="xlab" style="left:${X(t.i)}%;${X(t.i) < 4 ? 'transform:none' : X(t.i) > 96 ? 'transform:translateX(-100%)' : ''}">${t.label}</div>`).join('')}
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--line)" stop-opacity="0.45"/><stop offset="1" stop-color="var(--line)" stop-opacity="0.02"/></linearGradient></defs>
      <path d="M${pts.join('L')}L100,100L0,100Z" fill="url(#${id})"/>
      ${rating ? `<line x1="0" x2="100" y1="${Y(rating.v)}" y2="${Y(rating.v)}" stroke="rgba(255,255,255,.55)" stroke-dasharray="6 5" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` : ''}
      <polyline points="${pts.join(' ')}" fill="none" stroke="var(--line)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    </svg>
    ${rating ? `<div class="rating" style="top:${Y(rating.v)}%">${rating.label}</div>` : ''}
    ${marker != null ? `<div class="dot" style="left:${X(marker)}%;top:${Y(values[marker])}%"></div>` : ''}
    <div class="hover" role="img" tabindex="0" aria-label="Chart: move over it for values"></div>`;
  const hover = el.querySelector('.hover');
  let vline, dot, box;
  const show = i => {
    if (!vline) { vline = Object.assign(document.createElement('div'), { className: 'vline' }); dot = Object.assign(document.createElement('div'), { className: 'dot' }); box = Object.assign(document.createElement('div'), { className: 'tip' }); el.append(vline, dot, box); }
    vline.style.left = dot.style.left = box.style.left = `${X(i)}%`;
    dot.style.top = `${Y(values[i])}%`;
    box.style.left = `clamp(60px, ${X(i)}%, calc(100% - 60px))`;
    box.innerHTML = tip ? tip(i) : fmt(values[i]);
  };
  const hide = () => { vline?.remove(); dot?.remove(); box?.remove(); vline = dot = box = null; };
  const at = e => { const r = hover.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))); };
  hover.addEventListener('pointermove', e => show(at(e)));
  hover.addEventListener('pointerleave', hide);
  let kb = marker ?? n - 1;
  hover.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { kb = Math.max(0, Math.min(n - 1, kb + (e.key === 'ArrowLeft' ? -1 : 1))); show(kb); e.preventDefault(); } });
  hover.addEventListener('blur', hide);
}

const niceStep = (range, target) => [0.5, 1, 2, 2.5, 5, 10, 20, 50].find(s => range / s <= target) ?? 100;
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Difficulty-over-time chart for a map at a speed. d.strain: difficulty of each section, in stars. */
function strainChart(el, d, speed, starsAt) {
  const k = d.stars ? starsAt / d.stars : 1;
  const values = d.strain.map(v => v * k);
  if (!values.length) { el.innerHTML = '<p class="empty">No notes.</p>'; return; }
  const max = Math.max(starsAt * 1.35, Math.max(...values) * 1.08, 1);
  const start = d.firstNoteMs / speed / 1000, end = d.lastNoteMs / speed / 1000, span = Math.max(1, end - start);
  const timeAt = i => start + (i / Math.max(1, values.length - 1)) * span;
  const step = niceStep(max, 4), tStep = [5, 10, 15, 30, 60, 120, 300].find(s => span / s <= 7) ?? 600;
  const yTicks = []; for (let v = step; v < max; v += step) yTicks.push({ v, label: `${v}★` });
  const xTicks = []; for (let t = Math.ceil(start / tStep) * tStep; t <= end; t += tStep) xTicks.push({ i: ((t - start) / span) * (values.length - 1), label: clock(t) });
  const peak = values.indexOf(Math.max(...values));
  el.style.setProperty('--line', `color-mix(in srgb, var(--${tier(starsAt)}) 70%, white)`);
  chart(el, values, { min: 0, max, yTicks, xTicks, marker: peak, rating: { v: starsAt, label: `${fmt(starsAt)}★ rating` },
    tip: i => `<b>${fmt(values[i], 1)}★</b> at ${clock(timeAt(i))}${i === peak ? ' · hardest part' : ''}` });
}

// ---------- pages ----------

function podium(rows) {
  const spot = (r, rank) => (r ? `
    <a class="spot r${rank}" href="${playerLink(r.name)}">
      ${rank === 1 ? '<div class="crown"></div>' : ''}
      ${avatar(r.name, '', r.avatar)}
      <div class="name">${esc(r.name)}</div>
      <div class="ppv">${pp(r.pp)}</div>
      <div class="block">${rank}</div>
    </a>` : `
    <div class="spot r${rank} open" title="Nobody here yet">
      ${rank === 1 ? '<div class="crown"></div>' : ''}
      <span class="avatar open-avatar"></span>
      <div class="name">Open spot</div>
      <a class="ppv" href="#/submit">submit a play</a>
      <div class="block">${rank}</div>
    </div>`);
  return `<div class="card podium">${spot(rows[1], 2)}${spot(rows[0], 1)}${spot(rows[2], 3)}</div>`;
}

const playItem = s => `
  <a class="item" href="#/map/${s.mapId}">
    ${cover(s.mapId, 's48', s.stars)}
    <div class="main">
      <div class="title">${esc(s.player)} <span class="muted">on</span> ${esc(s.title)}</div>
      <div class="meta">${grade(s.accuracy, false, s)} ${pct(s.accuracy)} · ${stars(s.stars)} ${mods(s.mods, s.speed, s.format)} · ${ago(s.submittedAt)}</div>
    </div>
    <div class="ppv">${pp(s.pp)}</div>
  </a>`;

const mapCard = m => `
  <a class="card map-card t-${tier(m.stars)}" href="#/map/${m.id}">
    <span class="cover art t-${tier(m.stars)}">${coverImg(m.id)}${stars(m.stars)}</span>
    ${m.status && m.status !== 'ranked' ? (m.pool ? '<span class="pill pool unranked">challenge pool</span>' : '<span class="pill unranked">unranked</span>') : ''}
    <div class="body">
      <div class="title">${esc(m.title)}</div>
      <div class="meta"><span>${esc(m.artist)}</span>${m.players != null ? `<span>${m.players} player${m.players === 1 ? '' : 's'}</span>` : ''}</div>
    </div>
  </a>`;

async function home(app = currentPage()) {
  setTab('home');
  const [s, top, feed] = await Promise.all([api('/api/stats'), api('/api/leaderboard?limit=10'), api('/api/feed')]);
  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">Nightly &amp; Rewrite · community rankings</p>
        <h1>Every play, <em>ranked.</em></h1>
        <p class="sub">A community-made star rating and PP system. Pass a ranked map, <a href="#/submit">submit the replay</a>, and climb.</p>
        <div class="chips">${isStatic && config.discord ? `<a class="btn" href="${esc(config.discord)}" rel="noopener">Join the Discord</a><a class="btn ghost" href="#/submit">How to submit</a>` : '<a class="btn" href="#/submit">Submit a play</a>'}<a class="btn ghost" href="#/about">How PP works</a></div>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="v">${s.players}</div><div class="k">${plural(s.players, 'Player')}</div></div>
        <div class="stat"><div class="v">${s.rankedMaps}</div><div class="k">Ranked ${plural(s.rankedMaps, 'map')}</div></div>
        <div class="stat"><div class="v">${s.scores}</div><div class="k">Verified ${plural(s.scores, 'play')}</div></div>
      </div>
    </section>
    ${top.length ? podium(top.slice(0, 3)) : ''}
    <div class="layout-2">
      <section>
        <h2>Latest plays</h2>
        <div class="card list">${feed.plays.length ? feed.plays.slice(0, 12).map(playItem).join('') : '<p class="empty">No plays yet. Be the first!</p>'}</div>
      </section>
      <section>
        <h2>Top players</h2>
        <div class="card list">${top.length ? top.map(r => `
          <a class="item" href="${playerLink(r.name)}">
            <span class="rankno m${r.rank}">${r.rank}</span>${avatar(r.name, '', r.avatar)}
            <div class="main"><div class="title">${esc(r.name)}${demoPill(r.demo)}</div><div class="meta">${grade(r.accuracy)} ${pct(r.accuracy)} · ${r.plays} play${r.plays === 1 ? "" : "s"}</div></div>
            <div class="ppv">${pp(r.pp)}</div>
          </a>`).join('') : '<p class="empty">Nobody yet.</p>'}
          <a class="item" href="#/rankings"><div class="main"><div class="title" style="color:var(--accent-2)">Full rankings →</div></div></a>
        </div>
      </section>
    </div>
    ${feed.maps.length ? `<h2>Newly ranked</h2><div class="new-maps">${feed.maps.map(mapCard).join('')}</div>` : ''}`;
}

const rankingTabs = on => `<div class="seg" style="margin-bottom:18px"><a href="#/rankings"${on === 'players' ? ' class="on"' : ''}>Players</a><a href="#/rankings/plays"${on === 'plays' ? ' class="on"' : ''}>Top plays</a></div>`;

const flagOf = code => (/^[A-Z]{2}$/.test(code ?? '') ? [...code].map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('') : '');
const regionName = (() => { try { const d = new Intl.DisplayNames(['en'], { type: 'region' }); return c => d.of(c) ?? c; } catch { return c => c; } })();
let rankCountry = '';   // the rankings page's country filter (kept while the page refreshes)
/** What a page's controls were set to, so the 20-second data refresh (and coming back to the page) doesn't reset them. */
const RANK_PAGE = 100;   // players listed at a time on the rankings page
const kept = { rank: { shown: RANK_PAGE }, maps: { status: 'ranked', sort: 'hard', q: '', band: 'any', shown: 60 }, pool: { show: 'all', q: '', shown: {} }, roadmap: { doneOpen: false } };
const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

/** Every ranked player (the page and the country filter work over all of them): the static site has them in one file (all of them, however many), the local server hands out 100 at a time until a page is short. */
async function leaderboardRows() {
  if (isStatic) return api('/api/leaderboard?limit=1000000');
  const rows = [];
  for (let offset = 0; offset < 1e6; offset += 100) {
    const page = await api(`/api/leaderboard?limit=100&offset=${offset}`);
    rows.push(...page);
    if (page.length < 100) break;
  }
  return rows;
}

async function rankings(view, app = currentPage()) {
  setTab('rankings');
  if (view === 'plays') return topPlays(app);
  const all = await leaderboardRows();
  const countries = [...new Set(all.map(r => r.country).filter(Boolean))].sort((a, b) => regionName(a).localeCompare(regionName(b)));
  if (rankCountry && !countries.includes(rankCountry)) rankCountry = '';
  // A country's players ranked among themselves; the global rank stays beside it.
  const ranked = rankCountry ? all.filter(r => r.country === rankCountry).map((r, i) => ({ ...r, globalRank: r.rank, rank: i + 1 })) : all;
  const rows = ranked.slice(0, kept.rank.shown);   // 100 at a time: the rest is a "Show more" away
  app.innerHTML = `
    <p class="eyebrow">Leaderboard</p>
    <h1>Player rankings</h1>
    <p class="sub">Total PP = each player's best verified play on every ranked map, weighted 100%, 95%, 90%… from best to worst.</p>
    ${rankingTabs('players')}
    <div class="psearch page" role="search" aria-label="Find a player in the rankings"><input id="psearch-page" type="search" placeholder="Find any player, ranked or not" aria-label="Find a player" autocomplete="off" spellcheck="false"></div>
    ${countries.length ? `<label class="rank-filter">Country <select id="rank-country"><option value="">Everywhere (global)</option>${countries.map(c => `<option value="${esc(c)}"${c === rankCountry ? ' selected' : ''}>${flagOf(c)} ${esc(regionName(c))}</option>`).join('')}</select>
      <span class="muted">Players set theirs with <code>/country</code> in Discord.</span></label>` : ''}
    ${rows.length ? podium(rows.slice(0, 3)) : ''}
    <div class="card table-wrap"><table class="lb">
      <thead><tr><th>#</th><th>Player</th><th class="r">PP</th><th class="r">Accuracy</th><th class="r hide-sm">${rankCountry ? 'Global' : 'Ranked plays'}</th></tr></thead>
      <tbody>${rows.length ? rows.map(r => `
        <tr class="link" data-href="${playerLink(r.name)}">
          <td><span class="rankno m${r.rank}">${r.rank}</span></td>
          <td><a class="who" href="${playerLink(r.name)}">${avatar(r.name, '', r.avatar)}${r.country && !rankCountry ? `<span class="flag" title="${esc(regionName(r.country))}">${flagOf(r.country)}</span>` : ''}${esc(r.name)}${demoPill(r.demo)}</a></td>
          <td class="ppc r">${pp(r.pp)}</td><td class="r num">${grade(r.accuracy)} ${pct(r.accuracy)}</td><td class="r num hide-sm">${rankCountry ? `#${r.globalRank} <span class="unit">global</span>` : `${r.plays} <span class="unit">ranked ${r.plays === 1 ? 'play' : 'plays'}</span>`}</td>
        </tr>`).join('') : `<tr><td colspan="5" class="empty">No verified plays yet. Be the first: <a href="#/submit">submit a replay</a>.</td></tr>`}
      </tbody></table></div>
    ${ranked.length > rows.length ? `<p class="more"><button class="btn ghost" id="rank-more">Show ${Math.min(RANK_PAGE, ranked.length - rows.length)} more</button> <span class="muted">${rows.length} of ${ranked.length} players</span></p>` : ''}`;
  document.getElementById('rank-more')?.addEventListener('click', () => { kept.rank.shown += RANK_PAGE; rankings(view); });
  document.getElementById('rank-country')?.addEventListener('change', e => { rankCountry = e.target.value; kept.rank.shown = RANK_PAGE; rankings(view); });
  playerSearch(document.getElementById('psearch-page'));
}

/** The best plays of all time, each player's best per map. */
async function topPlays(app) {
  const rows = await api('/api/top-plays');
  app.innerHTML = `
    <p class="eyebrow">Leaderboard</p>
    <h1>Top plays</h1>
    <p class="sub">The highest-PP plays on ranked maps, one per player per map. Click one to watch it.</p>
    ${rankingTabs('plays')}
    <div class="card table-wrap"><table class="plays-table lb">
      <thead><tr><th>#</th><th>Player</th><th>Map</th><th class="r">PP</th><th class="r hide-sm">Accuracy</th><th class="hide-sm">Mods</th><th><span class="sr-only">Replay</span></th></tr></thead>
      <tbody>${rows.length ? rows.map(s => `
        <tr class="link" data-href="#/replay/${s.id}">
          <td><span class="rankno m${s.rank}">${s.rank}</span></td>
          <td><a class="who" href="${playerLink(s.player)}">${avatar(s.player, '', s.avatar)}${esc(s.player)}${demoPill(s.playerDemo)}</a></td>
          <td class="clip"><a href="#/map/${s.mapId}">${esc(s.title)}</a> <span class="muted hide-sm">· ${esc(s.artist)}</span> <span class="hide-sm">${stars(s.stars)}</span></td>
          <td class="ppc r">${pp(s.pp)}</td><td class="r num hide-sm">${grade(s.accuracy, false, s)} ${pct(s.accuracy)}</td>
          <td class="hide-sm">${mods(s.mods, s.speed, s.format) || '<span class="muted">—</span>'}</td>
          <td class="r"><a class="btn ghost small watch" href="#/replay/${s.id}" aria-label="Watch this play">▶<span class="hide-sm"> Watch</span></a></td></tr>`).join('')
        : `<tr><td colspan="7" class="empty">No verified plays yet. Be the first: <a href="#/submit">submit a replay</a>.</td></tr>`}
      </tbody></table></div>`;
}

async function maps(app = currentPage()) {
  setTab('maps');
  const all = await api('/api/maps?status=all');
  const k = kept.maps;   // the controls' state lives outside this call, so a data refresh or coming back keeps it
  let { status, sort, q, band, shown } = k;   // 60 cards at a time: a phone isn't one endless column
  app.innerHTML = `
    <p class="eyebrow">Maps</p>
    <h1>Maps</h1>
    <p class="sub">Every downloaded map is here, with its star rating, theoretical PP and leaderboard. Only <b>ranked</b> maps count toward totals; <b>challenge pool</b> maps are on the challenge sheet and waiting for a curator. <a href="#/pool">See the whole pool →</a></p>
    <div class="toolbar">
      <div class="seg" id="status"><button data-v="ranked">Ranked</button><button data-v="pool">Challenge pool</button><button data-v="other">Other</button><button data-v="all">All</button></div>
      <div class="seg" id="band" role="group" aria-label="Star rating"><button data-v="any">Any ★</button><button data-v="low">Under 3★</button><button data-v="mid">3–5★</button><button data-v="high">5–7★</button><button data-v="top">7★+</button></div>
      <div class="seg" id="sort"><button data-v="hard">Hardest</button><button data-v="easy">Easiest</button><button data-v="played">Most played</button></div>
      <input class="search" id="q" type="search" placeholder="Search title or artist" aria-label="Search maps" value="${esc(q)}">
    </div>
    <div class="map-grid" id="grid"></div>
    <p class="more-wrap" id="more"></p>`;
  const draw = () => {
    const needle = q.toLowerCase();
    const keep = m => status === 'all' || (status === 'ranked' ? m.status === 'ranked' : status === 'pool' ? m.pool && m.status !== 'ranked' : !m.pool && m.status !== 'ranked');
    const list = all.filter(m => keep(m) && inBand(m.stars, band) && (!needle || `${m.title} ${m.artist}`.toLowerCase().includes(needle)))
      .sort((a, b) => (sort === 'easy' ? a.stars - b.stars : sort === 'played' ? b.players - a.players || b.stars - a.stars : b.stars - a.stars));
    document.getElementById('grid').innerHTML = list.length ? list.slice(0, shown).map(mapCard).join('') : '<p class="empty">No maps match.</p>';
    document.getElementById('more').innerHTML = list.length > shown ? `<button class="btn ghost" id="more-btn">Show ${Math.min(60, list.length - shown)} more <span class="muted">· ${list.length - shown} left</span></button>` : '';
    document.getElementById('more-btn')?.addEventListener('click', () => { shown = k.shown += 60; draw(); });
  };
  for (const [id, set] of [['status', v => { status = k.status = v; }], ['band', v => { band = k.band = v; }], ['sort', v => { sort = k.sort = v; }]]) {
    const seg = document.getElementById(id);
    for (const x of seg.children) x.classList.toggle('on', x.dataset.v === { status, band, sort }[id]);
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      for (const x of b.parentElement.children) x.classList.toggle('on', x === b);
      set(b.dataset.v); shown = k.shown = 60; draw();
    });
  }
  document.getElementById('q').addEventListener('input', e => { q = k.q = e.target.value; shown = k.shown = 60; draw(); });
  draw();
}

const sameSpeed = (a, b) => Math.abs(a - b) < 5e-4;
/** One game's speed buttons for a map page: its own labels (Nightly's arrows), each with the speed it stands for. */
const speedRow = (game, presets, rated) => `<div class="seg"><span class="seg-k">${game}</span>${presets.map(([label, r]) => {
  const ok = rated.some(s => sameSpeed(s.speed, r)), info = speedInfo(r, game === 'Nightly' ? 'sspre' : 'phxr');
  return `<button data-v="${r}"${sameSpeed(r, 1) ? ' class="on"' : ''}${ok ? '' : ' disabled'} title="${esc(info.title.replace(/ Stars.*$/, ''))}">${label ? `<b>${esc(label)}</b> ` : ''}${esc(info.short)}</button>`;
}).join('')}</div>`;

async function mapPage(id, app = currentPage()) {
  setTab('maps');
  const d = await api(`/api/maps/${id}`);
  const fp = d.fingerprint, most = Math.max(1, ...fp.cells), total = Math.max(1, fp.cells.reduce((a, b) => a + b, 0));
  let speed = 1;
  app.innerHTML = `
    <section class="page-hero t-${tier(d.stars)}" id="hero">
      ${coverBg(d.id)}
      <div class="hero-row">
        ${cover(d.id, 's160', d.stars)}
        <div class="main">
          <p class="eyebrow" id="tiername"></p>
          <h1>${esc(d.title)}</h1>
          <div class="by">${esc(d.artist)} · mapped by ${esc(d.mappers.join(', '))}</div>
          <div class="big-stars"><span id="bigstars"></span>
            <div class="speedpick" id="speed">${speedRow('Nightly', NIGHTLY_PRESETS, d.speeds)}${speedRow('Rewrite', REWRITE_PRESETS.map(r => [null, r]), d.speeds)}</div>
          </div>
          <div class="chips" id="facts"></div>
          <div class="chips" style="margin-top:12px">${share(`m/${d.id}/`)}</div>
        </div>
        <div class="fp-box">
          <p class="eyebrow">Where notes land</p>
          <div class="fp">${fp.cells.map(c => `<div class="${c / most > 0.55 ? 'hot' : ''}" style="--k:${(c / most).toFixed(3)}">${Math.round((c / total) * 100)}%</div>`).join('')}</div>
          <div class="foot">avg jump ${fmt(fp.avgJump, 2)} · ${Math.round(fp.stackShare * 100)}% stacks</div>
        </div>
      </div>
    </section>
    <h2>Difficulty over the map</h2>
    <section class="card chart-card t-${tier(d.stars)}"><div id="strain"></div></section>
    ${d.status !== 'ranked' ? `<div class="card pad unranked-note"><span class="unr">UNRANKED MAP</span> Plays here are saved and ranked against each other, but they don't count toward anyone's total yet. PP below is what they'd be worth if the map gets ranked.</div>` : ''}
    ${d.pool ? poolPanel(d) : ''}
    <h2>Leaderboard</h2>
    <div class="card table-wrap"><table class="lb">
      <thead><tr><th>#</th><th>Player</th><th class="r">${d.status === 'ranked' ? 'PP' : 'PP if ranked'}</th><th class="r">Accuracy</th><th class="r hide-sm">Misses</th><th class="hide-sm">Mods</th><th class="r hide-sm">When</th><th><span class="sr-only">Replay</span></th></tr></thead>
      <tbody>${d.leaderboard.length ? d.leaderboard.map(s => `
        <tr><td><span class="rankno m${s.rank}">${s.rank}</span></td>
          <td><a class="who" href="${playerLink(s.player)}">${avatar(s.player, '', s.avatar)}${esc(s.player)}${demoPill(s.demo)}</a></td>
          <td class="ppc r${d.status === 'ranked' ? '' : ' muted'}">${pp(s.pp)}</td><td class="r num">${grade(s.accuracy, false, s)} ${pct(s.accuracy)}</td><td class="r num hide-sm">${s.misses}</td>
          <td class="hide-sm">${mods(s.mods, s.speed, s.format) || '<span class="muted">—</span>'}</td><td class="r muted hide-sm">${ago(s.submittedAt)}</td>
          <td class="r"><a class="btn ghost small" href="#/replay/${s.id}">▶ Watch</a></td></tr>`).join('')
        : `<tr><td colspan="8" class="empty">No verified plays on this map yet.</td></tr>`}
      </tbody></table></div>
    ${isStatic ? '' : `<p class="muted" style="margin-top:14px;font-size:12.5px">Map hash <code>${esc(d.hash.slice(0, 16))}…</code> (identifies this exact chart; edited versions get their own leaderboard).</p>`}`;
  const draw = () => {
    const at = d.speeds.find(s => sameSpeed(s.speed, speed)) ?? d.speeds.find(s => s.speed === 1);
    const st = at.stars, fc = at.fcPP;
    document.getElementById('hero').className = `page-hero t-${tier(st)}`;
    document.getElementById('tiername').textContent = `${TIER_NAME[tier(st)]} · ${d.status === 'ranked' ? 'Ranked' : d.pool ? 'Challenge pool, not ranked yet' : 'Unranked, no PP'}`;
    document.getElementById('bigstars').innerHTML = stars(st, true);
    document.getElementById('facts').innerHTML = `${d.status === 'ranked' ? `<span class="chip accent">${pp(fc)} full combo</span>` : `<span class="chip unr-chip">UNRANKED</span><span class="chip">${pp(fc)} full combo if ranked</span>`}<span class="chip">${d.notes.toLocaleString('en-US')} notes</span><span class="chip">${dur(d.lengthMs / speed)}</span><span class="chip">${fmt(fp.nps * speed, 1)} notes/s</span>`;
    const box = document.getElementById('strain');
    box.parentElement.className = `card chart-card t-${tier(st)}`;
    strainChart(box, d, speed, st);
  };
  document.getElementById('speed').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    speed = Number(b.dataset.v);
    for (const x of document.querySelectorAll('#speed button')) x.classList.toggle('on', sameSpeed(Number(x.dataset.v), speed));   // 80% is both games' button
    draw();
  });
  draw();
  for (const seg of document.querySelectorAll('#speed .seg')) {   // a row that swipes (a phone) starts with the chosen speed in view
    const on = seg.querySelector('button.on');
    if (on && seg.scrollWidth > seg.clientWidth) seg.scrollLeft = on.getBoundingClientRect().left - seg.getBoundingClientRect().left - (seg.clientWidth - on.offsetWidth) / 2;
  }
}

const POOL_STATE = { ranked: ['ranked', 'Ranked'], pending: ['review', 'Waiting'], mismatch: ['rejected', 'Other version'], missing: ['', 'Not downloaded'], kept: ['', 'Unranked on purpose'] };
const poolState = st => { const [cls, label] = POOL_STATE[st] ?? ['', String(st)]; return `<span class="pill ${cls}">${esc(label)}</span>`; };

function poolPanel(d) {
  const p = d.pool;
  return `<h2>On the challenge sheet</h2><section class="card pad pool-panel">
    <div class="chips" style="align-items:center">
      <span class="chip accent">${esc(p.tier ?? 'Pool')}</span>
      ${p.sheetStars != null ? `<span class="chip">Sheet rating <b>${esc(p.sheetStars)}</b></span>` : ''}
      ${p.bpm ? `<span class="chip">${esc(p.bpm)} BPM</span>` : ''}
      ${poolState(p.state)}
    </div>
    ${p.patterns.length ? `<div class="chips" style="margin-top:10px">${p.patterns.map(x => `<span class="pill">${esc(x)}</span>`).join(' ')}</div>` : ''}
    ${p.bestCamlock || p.bestSpin ? `<p class="muted" style="margin:12px 0 0;font-size:13.5px">Best passes on the sheet: ${[p.bestCamlock && p.bestCamlock !== 'NONE' ? `camlock ${esc(p.bestCamlock)}` : '', p.bestSpin && p.bestSpin !== 'NONE' ? `spin ${esc(p.bestSpin)}` : ''].filter(Boolean).join(' · ') || 'none yet'}</p>` : ''}
    ${p.link ? `<p style="margin:12px 0 0"><a class="btn ghost small" href="${esc(p.link)}" rel="noopener">Download the sheet's copy</a></p>` : ''}
  </section>`;
}

async function poolPage(app = currentPage()) {
  setTab('maps');
  const p = await api('/api/pool');
  if (!p.entries.length) { app.innerHTML = '<p class="eyebrow">Challenge pool</p><h1>Challenge pool</h1><p class="sub">No challenge sheet has been loaded yet. Curators can load one with <b>/pool</b> in Discord.</p>'; return; }
  let { show, q } = kept.pool;   // kept across the data refresh
  const POOL_PAGE = 20;   // rows a tier shows before "Show more": the whole sheet is 500 maps and a phone would scroll for minutes
  const matches = e => !q || `${e.song} ${e.mapper ?? ''}`.toLowerCase().includes(q);
  const tiers = [...new Set(p.entries.map(e => e.tier))];
  app.innerHTML = `
    <p class="eyebrow">Challenge pool</p>
    <h1>${esc(p.source ?? 'Challenge pool')}</h1>
    <p class="sub">Maps the challenge sheet puts in the competitive pool. Curators rank them here; until then they're playable but don't count toward totals. In the tables, <b>Sheet</b> is the challenge sheet's own difficulty number and <b>Stars</b> is this site's rating.</p>
    <div class="stat-row" style="margin-bottom:18px">
      <div class="stat"><div class="v">${p.totals.ranked}</div><div class="k">Ranked</div></div>
      <div class="stat"><div class="v">${p.totals.pending}</div><div class="k">Waiting</div></div>
      <div class="stat"><div class="v">${p.totals.missing}</div><div class="k">Not downloaded</div></div>
      ${p.totals.mismatch ? `<div class="stat"><div class="v">${p.totals.mismatch}</div><div class="k">Different version</div></div>` : ''}
      ${p.totals.kept ? `<div class="stat"><div class="v">${p.totals.kept}</div><div class="k">Unranked on purpose</div></div>` : ''}
    </div>
    <div class="toolbar"><div class="seg" id="show">${POOL_FILTERS.filter(f => f.v === 'all' || f.v === 'ranked' || f.v === 'pending' || f.v === 'missing' || p.totals[f.v]).map(f => `<button data-v="${f.v}">${f.label}</button>`).join('')}</div>
      <input class="search" id="pool-q" type="search" placeholder="Find a map or mapper on the sheet" aria-label="Find a map or mapper on the sheet" autocomplete="off" spellcheck="false" value="${esc(q)}"></div>
    <div id="pool"></div>`;
  const draw = () => {
    document.getElementById('pool').innerHTML = tiers.map(t => {
      const list = p.entries.filter(e => e.tier === t && poolShows(e, show) && matches(e));
      if (!list.length) return '';
      const shown = kept.pool.shown[t] ?? POOL_PAGE, rows = list.slice(0, shown);
      return `<h2>${esc(t)} <span class="muted" style="font-family:var(--body);font-weight:600;font-size:14px">${list.length}</span></h2>
        <div class="card table-wrap"><table class="sheet"><thead><tr><th>Map</th><th class="hide-sm">Mapper</th><th class="r" title="The challenge sheet's own difficulty number">Sheet</th><th class="r" title="This site's star rating">Stars</th><th>Status</th></tr></thead><tbody>
        ${rows.map(e => `<tr${e.mapId ? ` class="link" data-href="#/map/${e.mapId}"` : ''}>
          <td class="wrapcell" style="white-space:normal">${e.mapId ? `<a href="#/map/${e.mapId}"><b>${esc(e.song)}</b></a>` : `<b>${esc(e.song)}</b>`}<div class="muted" style="font-size:12.5px">${esc(e.patterns.slice(0, 4).join(', '))}</div></td>
          <td class="hide-sm">${esc(e.mapper ?? '')}</td>
          <td class="r num">${e.sheetStars ?? '—'}</td><td class="r">${e.stars != null ? stars(e.stars) : '—'}</td>
          <td>${!e.mapId && e.link ? `<a class="btn ghost small" href="${esc(e.link)}" rel="noopener" title="Not in the library yet">Download</a>` : poolState(e.state)}</td></tr>`).join('')}
        </tbody></table></div>
        ${list.length > rows.length ? `<p class="more"><button class="btn ghost small" data-more="${esc(t)}">Show ${Math.min(50, list.length - rows.length)} more</button> <span class="muted">${rows.length} of ${list.length}</span></p>` : ''}`;
    }).join('') || `<p class="empty">${q ? 'No map or mapper on the sheet matches that.' : 'Nothing here.'}</p>`;
  };
  document.getElementById('pool').addEventListener('click', e => {
    const b = e.target.closest('button[data-more]'); if (!b) return;
    kept.pool.shown[b.dataset.more] = (kept.pool.shown[b.dataset.more] ?? POOL_PAGE) + 50; draw();
  });
  document.getElementById('pool-q').addEventListener('input', e => { q = kept.pool.q = e.target.value.trim().toLowerCase(); kept.pool.shown = {}; draw(); });
  const seg = document.getElementById('show');
  for (const x of seg.children) x.classList.toggle('on', x.dataset.v === show);
  seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of b.parentElement.children) x.classList.toggle('on', x === b);
    show = kept.pool.show = b.dataset.v; draw();
  });
  draw();
}

// ---------- player profile ----------

const playTime = ms => {
  const m = Math.round((ms ?? 0) / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d ? `${d}d ${h}h ${m % 60}m` : h ? `${h}h ${m % 60}m` : `${m}m`;
};
const longDate = t => new Date(t * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const rarity = r => (!r ? 'nobody yet' : r < 0.01 ? 'under 1% of players' : `${fmt(r * 100, 0)}% of players`);
/** A bio as shown: plain text, line breaks kept, web links clickable. */
/** (The text is split into links and the rest before anything is escaped: a link found in already-escaped text could end half way through an entity like &#39;.) */
const bioHtml = t => String(t ?? '').split(/(https?:\/\/[^\s<]+[^\s<.,:;)!?])/).map((part, i) => (i % 2 ? `<a href="${esc(part)}" rel="noopener nofollow" target="_blank">${esc(part)}</a>` : esc(part))).join('').replace(/\n/g, '<br>');

/** One play in a profile list. best: show its weight in the total. */
/** Consecutive attempts on one map that didn't count are one row: a hard map retried ten times isn't ten rows. */
function groupAttempts(recent) {
  const out = [];
  for (const s of recent) {
    const last = out[out.length - 1];
    if (last && s.status !== 'verified' && last.status === s.status && last.mapId === s.mapId && !!last.failed === !!s.failed) {
      last.attempts = (last.attempts ?? 1) + 1;
      last.bestAccuracy = Math.max(last.bestAccuracy ?? last.accuracy, s.accuracy);
    } else out.push({ ...s });
  }
  return out;
}

function profileRow(s, { best = false, rank = null } = {}) {
  return `
    <a class="item" href="#/map/${s.mapId}">
      ${rank ? `<span class="rankno m${rank}">${rank}</span>` : ''}${cover(s.mapId, 's48', s.stars)}
      <div class="main">
        <div class="title">${esc(s.title)} <span class="muted" style="font-weight:500">· ${esc(s.artist)}</span></div>
        <div class="meta">${best || s.status === 'verified' ? `${grade(s.accuracy, false, s)} ${pct(s.accuracy)}` : `${statusPill(s.status, s.failed)}${s.attempts > 1 ? ` · <b>${s.attempts} attempts</b> · best ${pct(s.bestAccuracy)}` : ''}`} · ${stars(s.stars)} ${mods(s.mods, s.speed, s.format)} · ${ago(s.submittedAt)}</div>
      </div>
      <div class="ppv">${s.status !== 'verified' ? '—' : s.ranked === false ? unranked(s.pp) : pp(s.pp)}${best ? `<small title="This play is worth ${pp(s.pp)}. In your total it counts at ${fmt(s.weight * 100, 0)}%, so ${pp(s.weightedPP)}.">counts ${pp(s.weightedPP)} · ${fmt(s.weight * 100, 0)}%</small>` : ''}</div>
    </a>`;
}

/** Medals: the latest few up front, then every group as a row of icons. Hovering (or tapping) one explains it.
 *  (Each icon carries the medal's name and what it takes; the classic look keeps them for the hover card only, the
 *  next look shows them beside the icon.) */
function medalsBlock(p) {
  const all = p.medals ?? [], got = all.filter(m => m.earnedAt);
  const latest = [...got].sort((a, b) => b.earnedAt - a.earnedAt).slice(0, 6);
  const icon = (m, size, text = false, next = false) => `<button class="mdl${m.earnedAt ? ' got' : ''}${next ? ' nxt' : ''}" data-medal="${esc(m.id)}" aria-label="${esc(m.name)}" style="--g:${groupColor(m.group)}">${medalSVG(m, size)}${text ? `<span class="mtx"><b>${esc(m.name)}</b><span>${esc(m.about)}</span></span>` : ''}</button>`;
  return `
    <section class="pf-sec" id="pf-medals">
      <h2>Medals <span class="count">${got.length} of ${all.length}</span></h2>
      <div class="card pad pf-medals">
        ${latest.length ? `<div class="latest"><p class="eyebrow">Latest</p><div class="latest-row">${latest.map(m => `<div class="lm">${icon(m, 58)}<span>${esc(m.name)}</span></div>`).join('')}</div></div>` : '<p class="muted" style="margin:0 0 14px">No medals yet. They come with plays: hover one to see what it takes.</p>'}
        <div class="groups">${(p.medalGroups ?? []).map(g => {
          const list = all.filter(m => m.group === g.id), n = list.filter(m => m.earnedAt).length, next = list.find(m => !m.earnedAt);   // the group's next medal to go for
          return `<div class="mg" style="--g:${groupColor(g.id)}"><div class="mg-name">${esc(g.name)} <span class="muted">${n}/${list.length}</span><span class="mg-bar" aria-hidden="true"><i style="width:${list.length ? Math.round((100 * n) / list.length) : 0}%"></i></span></div><div class="mg-icons">${list.map(m => icon(m, 42, true, m === next)).join('')}</div></div>`;
        }).join('')}</div>
        <p class="medal-note">A medal's stars are your play's stars: speed and Hard Rock raise them, so a 3★ map played faster can earn a 4★ medal.</p>
      </div>
    </section>`;
}

/** The hover card for medals: art, name, tier, flavour, what it takes, when it was earned, how rare it is. */
function medalTips(p, app) {
  const byId = new Map((p.medals ?? []).map(m => [m.id, m]));
  let tip = document.getElementById('medal-tip');
  if (!tip) { tip = Object.assign(document.createElement('div'), { id: 'medal-tip', role: 'tooltip' }); document.body.append(tip); }
  const show = el => {
    const m = byId.get(el.dataset.medal);
    if (!m) return;
    tip.innerHTML = `
      <div class="art${m.earnedAt ? '' : ' locked'}">${medalSVG(m, 96)}</div>
      <div class="txt">
        <div class="nm">${esc(m.name)}</div>
        <div class="tier t${m.tier}">${tierName(m.tier)} · ${esc(m.groupName)}</div>
        <p class="flavor">“${esc(m.flavor)}”</p>
        <p class="how"><b>How:</b> ${esc(m.about)}</p>
        <p class="when">${m.earnedAt ? `Earned ${longDate(m.earnedAt)}` : 'Not earned yet'} · held by ${rarity(m.rarity)}</p>
      </div>`;
    tip.classList.add('on');
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const left = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
    const top = r.top - h - 10 > 8 ? r.top - h - 10 : r.bottom + 10;
    tip.style.left = `${left}px`; tip.style.top = `${top + window.scrollY}px`;
  };
  const hide = () => { tip.classList.remove('on'); delete tip.dataset.for; };
  // With a mouse, hovering shows the card and leaving hides it; a click toggles it. On a touch screen a tap also fires the
  // mouse events (enter, then click), which used to show the card and hide it again in one tap, so there only the tap counts.
  const canHover = window.matchMedia?.('(hover: hover)').matches ?? true;
  for (const el of app.querySelectorAll('[data-medal]')) {
    const open = () => { show(el); tip.dataset.for = el.dataset.medal; };
    if (canHover) { el.addEventListener('mouseenter', open); el.addEventListener('mouseleave', hide); }
    el.addEventListener('focus', () => { if (el.matches(':focus-visible')) open(); });
    el.addEventListener('blur', hide);
    el.addEventListener('click', e => { e.preventDefault(); tip.classList.contains('on') && tip.dataset.for === el.dataset.medal ? hide() : open(); });
  }
  if (!tip.dataset.bound) { tip.dataset.bound = '1'; document.addEventListener('pointerdown', e => { if (!e.target.closest?.('[data-medal]')) hide(); }); }
  window.addEventListener('rpp:leave', hide, { once: true });
}

async function playerPage(name, app = currentPage()) {
  setTab('rankings');
  const p = await api(`/api/players/${enc(name)}`);
  const st = p.stats ?? {}, lv = st.level ?? { level: 1, progress: 0, next: 0 };
  const accent = p.accent != null ? `#${Number(p.accent).toString(16).padStart(6, '0')}` : colorFor(p.name);
  const joined = p.joined ? new Date(p.joined * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
  const medalsGot = (p.medals ?? []).filter(m => m.earnedAt).length;
  const side = [
    ['Accuracy', p.plays || p.accuracy ? pct(p.accuracy) : '—'], ['Play count', (st.plays ?? 0).toLocaleString('en-US')], ['Pass rate', st.plays ? pct(st.passRate ?? 0) : '—'], ['Ranked plays', p.plays],
    ['Total hits', (st.totalHits ?? 0).toLocaleString('en-US')], ['Hits per play', fmt(st.hitsPerPlay ?? 0, 0)],
    ['Max combo', `${(st.maxCombo ?? 0).toLocaleString('en-US')}×`], ['#1 plays', (p.firsts ?? []).length], ['Peak rank', p.peakRank ? `#${p.peakRank}` : '—'],
  ];
  const sections = [['about', 'About'], ['scores', 'Scores'], ['recent', 'Recent'], ['medals', 'Medals'], ['history', 'History']];
  const hist = p.historical ?? { monthly: [], mostPlayed: [], last24h: 0 };
  app.innerHTML = `
    <section class="pf" style="--pf:${accent}">
      <div class="pf-cover">${p.banner ? `<img src="${esc(p.banner)}" alt="" referrerpolicy="no-referrer">` : p.top[0] ? coverBg(p.top[0].mapId) : ''}<div class="shade"></div></div>
      <div class="pf-head">
        ${avatar(p.name, 'xl', p.avatar)}
        <div class="pf-name">
          <h1>${esc(p.name)}${demoPill(p.demo)}${p.staff ? ` <span class="staff-badge" title="Builds and runs Rhythia Community Ranked">${esc(p.staff)}</span>` : ''}</h1>
          <div class="where">${[p.country && `<span class="flag">${esc(p.country.flag)}</span> ${esc(p.country.name)}`, joined && `joined ${joined}`].filter(Boolean).join('<span class="dot">·</span>')}</div>
        </div>
        <div class="pf-level" title="Level ${lv.level}. It grows with every note you hit: ${fmt(lv.next, 0)} more to level ${lv.level + 1}.">
          <div class="lvl-text"><span class="lvl-k">Level</span><div class="bar"><i style="width:${Math.round(lv.progress * 100)}%"></i></div><span class="pct">${Math.floor(lv.progress * 100)}% to level ${lv.level + 1}</span></div>
          <div class="hex"><span>${lv.level}</span></div>
        </div>
      </div>
      <div class="pf-body">
        <div class="pf-main">
          <div class="ranks">
            <div><div class="k">Global ranking</div><div class="v">${p.rank ? `#${p.rank.toLocaleString('en-US')}` : '—'}</div></div>
            <div><div class="k">Country ranking</div><div class="v">${p.countryRank ? `#${p.countryRank.toLocaleString('en-US')}` : '—'}</div></div>
          </div>
          <div class="pf-rankline" id="pf-rank">${p.history.length >= 2 ? '' : `<p class="muted">${p.rank ? 'The rank graph fills in day by day.' : 'Your first play on a ranked map puts you on the leaderboard. The rank graph fills in day by day after that.'}</p>`}</div>
          <div class="facts">
            <div><div class="k">Medals</div><div class="v">${medalsGot}</div></div>
            <div><div class="k">PP</div><div class="v">${p.plays ? fmt(p.pp, 0) : '—'}</div></div>
            <div><div class="k">Play time</div><div class="v">${playTime(st.playTimeMs)}</div></div>
            <div class="grades">${['SS', 'S', 'A'].map(g => `<div title="Best plays graded ${g}"><span class="grade g-${g}">${g}</span><b>${st.grades?.[g] ?? 0}</b></div>`).join('')}</div>
          </div>
        </div>
        <aside class="pf-side">${side.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</aside>
      </div>
      <div class="pf-foot"><span class="chips">${share(`p/${playerKey(p.name)}/`)}<a class="btn ghost small" href="#/compare/${enc(p.name)}">Compare</a></span></div>
    </section>
    <nav class="pf-nav">${sections.map(([id, label]) => `<button data-go="pf-${id}">${label}</button>`).join('')}</nav>
    <section class="pf-sec" id="pf-about">
      <h2>About</h2>
      <div class="card pad pf-bio">${p.bio ? bioHtml(p.bio) : `<span class="muted">No bio yet.${p.demo ? '' : ' Players write theirs with <code>/bio</code> in the Discord server.'}</span>`}</div>
    </section>
    <section class="pf-sec" id="pf-scores">
      <h2>Best performance <span class="count">${p.top.length}</span></h2>
      ${p.top.length > 1 ? `<p class="weight-note">The total isn't a plain sum: each play counts a bit less than the one above it (100%, 95%, 90%…), so these plays, ${pp(p.top.reduce((a, s) => a + s.pp, 0))} added up, make a total of <b>${pp(p.pp)}</b>. Playing well counts for more than playing a lot.</p>` : ''}
      <div class="card list" id="pf-best">${p.top.length ? p.top.slice(0, 10).map(s => profileRow(s, { best: true })).join('') : '<p class="empty">No verified plays on ranked maps yet.</p>'}</div>
      ${p.top.length > 10 ? '<div class="more"><button class="btn ghost small" id="pf-more">Show more</button></div>' : ''}
      <h2>First place plays <span class="count">${(p.firsts ?? []).length}</span></h2>
      <div class="card list">${(p.firsts ?? []).length ? p.firsts.map(s => profileRow(s, { rank: 1 })).join('') : '<p class="empty">No #1s right now.</p>'}</div>
    </section>
    <section class="pf-sec" id="pf-recent">
      <h2>Recent <span class="count">${hist.last24h} in the last 24 hours</span></h2>
      <div class="card list">${p.recent.length ? groupAttempts(p.recent).slice(0, 10).map(s => profileRow(s)).join('') : '<p class="empty">Nothing submitted yet.</p>'}</div>
      ${p.inReview ? `<p class="muted" id="pf-inreview">${p.inReview} ${plural(p.inReview, 'play')} ${plural(p.inReview, 'is', 'are')} waiting for a curator to check ${plural(p.inReview, 'it', 'them')}.</p>` : ''}
    </section>
    ${medalsBlock(p)}
    <section class="pf-sec" id="pf-history">
      <h2>History</h2>
      <div class="card chart-card"><p class="eyebrow">Plays per month</p>${hist.monthly.length >= 2 ? '<div id="pf-monthly"></div>' : `<p class="muted">${hist.monthly.length ? `${hist.monthly[0].plays} play${hist.monthly[0].plays === 1 ? '' : 's'} so far, all this month.` : 'No plays yet.'}</p>`}</div>
      <h2>Most played maps</h2>
      <div class="card list">${hist.mostPlayed.length ? hist.mostPlayed.map(m => `
        <a class="item" href="#/map/${m.mapId}">${cover(m.mapId, 's48', m.stars)}
          <div class="main"><div class="title">${esc(m.title)} <span class="muted" style="font-weight:500">· ${esc(m.artist)}</span></div><div class="meta">${stars(m.stars)} · mapped by ${esc(m.mappers.join(', '))}${m.ranked ? '' : ' · <span class="unr">UNRANKED</span>'}</div></div>
          <div class="ppv plays">▶ ${m.plays}<small>${m.passes ?? m.plays} passed${m.fails ? ` · ${m.fails} attempt${m.fails === 1 ? '' : 's'}` : ''}</small></div></a>`).join('') : '<p class="empty">Nothing yet.</p>'}</div>
    </section>`;

  for (const b of app.querySelectorAll('[data-go]')) b.addEventListener('click', () => document.getElementById(b.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  document.getElementById('pf-more')?.addEventListener('click', e => { document.getElementById('pf-best').innerHTML = p.top.map(s => profileRow(s, { best: true })).join(''); e.target.remove(); });
  medalTips(p, app);
  if (p.history.length >= 2) {
    const h = p.history, el = document.getElementById('pf-rank');
    const ranks = h.map(x => x.rank), lo = Math.max(1, Math.min(...ranks) - 1), hi = Math.max(Math.max(...ranks) + 1, lo + 3);
    const day = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    el.style.setProperty('--line', accent);
    chart(el, ranks, { min: lo, max: hi, invert: true, marker: h.length - 1, tip: i => `<b>#${h[i].rank}</b> · ${pp(h[i].pp)} · ${day(h[i].day)}` });
  }
  if (hist.monthly.length >= 2) {
    const m = hist.monthly, el = document.getElementById('pf-monthly'), max = Math.max(...m.map(x => x.plays));
    const label = s => new Date(`${s}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const step = niceStep(max, 4), yTicks = []; for (let v = step; v <= max * 1.1; v += step) yTicks.push({ v, label: String(v) });
    const xTicks = (m.length <= 4 ? m.map((_, i) => i) : [0, Math.round((m.length - 1) / 2), m.length - 1]).map(i => ({ i, label: label(m[i].month) }));
    el.style.setProperty('--line', accent);
    chart(el, m.map(x => x.plays), { min: 0, max: max * 1.15, yTicks, xTicks, tip: i => `<b>${m[i].plays}</b> play${m[i].plays === 1 ? '' : 's'}${m[i].passes != null && m[i].passes < m[i].plays ? ` (${m[i].passes} passed, ${m[i].plays - m[i].passes} attempt${m[i].plays - m[i].passes === 1 ? '' : 's'})` : ''} · ${label(m[i].month)}` });
  }
}

function readFile(file) { return file.arrayBuffer().then(b => new Uint8Array(b)); }
const inflateRaw = async bytes => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());

function dropZone(el, accept, onFile) {
  const input = Object.assign(document.createElement('input'), { type: 'file', accept, hidden: true });
  el.after(input);
  el.tabIndex = 0;
  el.addEventListener('click', () => input.click());
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('over'); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); });
  input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); input.value = ''; });
}

/** Drawn steps for the public Submit page: no screenshots of other people's software, just the shape of each step. */
const howtoArt = {
  // Step 2a: the File Explorer address bar with the replays folder pasted in.
  folder: (path) => `<svg viewBox="0 0 320 150" role="img" aria-label="A file window. Its address bar holds ${esc(path)}, ready to open.">
    <rect x="1" y="1" width="318" height="148" rx="14" fill="var(--surface-2)" stroke="var(--border-strong)"/>
    <circle cx="20" cy="18" r="4" fill="var(--faint)"/><circle cx="34" cy="18" r="4" fill="var(--faint)"/><circle cx="48" cy="18" r="4" fill="var(--faint)"/>
    <rect x="14" y="34" width="292" height="30" rx="9" fill="var(--bg)" stroke="var(--accent)" stroke-width="1.5"/>
    <text x="26" y="54" class="mono">${esc(path)}<tspan class="caret" fill="var(--accent-2)">▏<animate attributeName="opacity" values="1;1;0;0" dur="1.1s" repeatCount="indefinite"/></tspan></text>
    <text x="294" y="54" text-anchor="end" class="key">↵</text>
    <g fill="var(--surface-3)"><rect x="14" y="80" width="88" height="52" rx="8"/><rect x="116" y="80" width="88" height="52" rx="8"/><rect x="218" y="80" width="88" height="52" rx="8"/></g>
    <g fill="var(--faint)"><rect x="26" y="90" width="26" height="8" rx="2"/><rect x="128" y="90" width="26" height="8" rx="2"/><rect x="230" y="90" width="26" height="8" rx="2"/></g>
    <g fill="var(--dim)"><rect x="26" y="112" width="52" height="6" rx="3"/><rect x="128" y="112" width="44" height="6" rx="3"/><rect x="230" y="112" width="58" height="6" rx="3"/></g>
  </svg>`,
  // Step 2b: the folder's files, newest first, with the top one picked.
  newest: (ext) => `<svg viewBox="0 0 320 150" role="img" aria-label="The replays folder sorted by date, newest first. The top file, saved just now, is selected.">
    <rect x="1" y="1" width="318" height="148" rx="14" fill="var(--surface-2)" stroke="var(--border-strong)"/>
    <text x="16" y="24" class="label">Name</text><text x="304" y="24" text-anchor="end" class="label">Date modified ▾</text>
    <line x1="14" y1="32" x2="306" y2="32" stroke="var(--border)"/>
    <rect x="10" y="40" width="300" height="30" rx="8" fill="var(--accent)" fill-opacity="0.22" stroke="var(--accent)"/>
    <g class="file"><rect x="20" y="47" width="13" height="16" rx="2" fill="var(--accent-2)"/><text x="42" y="60" class="name on">today-21-04${esc(ext)}</text><text x="298" y="60" text-anchor="end" class="when on">just now</text></g>
    <g class="file"><rect x="20" y="83" width="13" height="16" rx="2" fill="var(--faint)"/><text x="42" y="96" class="name">yesterday-19-30${esc(ext)}</text><text x="298" y="96" text-anchor="end" class="when">yesterday</text></g>
    <g class="file"><rect x="20" y="117" width="13" height="16" rx="2" fill="var(--faint)"/><text x="42" y="130" class="name">last-week-18-12${esc(ext)}</text><text x="298" y="130" text-anchor="end" class="when">last week</text></g>
  </svg>`,
  // Step 3: the /submit command in Discord with the replay attached.
  send: (ext) => `<svg viewBox="0 0 320 150" role="img" aria-label="A chat box in the bot commands channel. The /submit command is typed and the replay file is attached, ready to send.">
    <rect x="1" y="1" width="318" height="148" rx="14" fill="var(--surface-2)" stroke="var(--border-strong)"/>
    <text x="16" y="24" class="label"># bot-commands</text>
    <rect x="14" y="40" width="292" height="40" rx="10" fill="var(--bg)" stroke="var(--border-strong)"/>
    <rect x="24" y="48" width="18" height="24" rx="5" fill="var(--accent)"/><text x="33" y="65" text-anchor="middle" class="plus">+</text>
    <rect x="50" y="49" width="40" height="22" rx="6" fill="var(--surface-3)"/><text x="70" y="64" text-anchor="middle" class="name on">${esc(ext)}</text>
    <rect x="96" y="49" width="104" height="22" rx="6" fill="var(--accent)" fill-opacity="0.28" stroke="var(--accent)"/><text x="148" y="64" text-anchor="middle" class="name on">replay · attached</text>
    <text x="30" y="110" class="cmd">/submit</text>
    <text x="104" y="110" class="hint">replay: ✓</text>
    <circle cx="282" cy="60" r="12" fill="var(--accent)"/><path d="M276 60h12m-4-4 4 4-4 4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="30" y="134" class="hint faint">press Enter: the bot answers with a card</text>
  </svg>`,
};

function submitPage(app = currentPage()) {
  setTab('submit');
  if (isStatic) {
    app.innerHTML = `
      <p class="eyebrow">Submit</p>
      <h1>How to submit a play</h1>
      <p class="sub">Plays are submitted in our Discord server, where the bot checks your replay, scores it and signs you up. Your Discord account is your leaderboard account, so there's nothing to log in to here.</p>
      <section class="card pad howto-card">
        <ol class="howto">
          <li>
            <div class="step-text"><b>Pass a map</b> in <b>Nightly</b> (Sound Space Plus) or <b>Rewrite</b>. <a href="#/maps">Ranked maps</a> count toward your total: curators choose them. Plays on other maps are saved too, and start counting if the map gets ranked. First play? Pick something under 3 stars on the <a href="#/maps">Maps page</a>.</div>
          </li>
          <li>
            <div class="step-art">${howtoArt.folder('%APPDATA%\\SoundSpacePlus\\replays')}</div>
            <div class="step-text"><b>Open the replays folder.</b> On Windows, paste <code>%APPDATA%\\SoundSpacePlus\\replays</code> (Nightly) or <code>%APPDATA%\\Rhythia\\replays</code> (Rewrite) into the File Explorer address bar and press Enter.</div>
          </li>
          <li>
            <div class="step-art">${howtoArt.newest('.sspre')}</div>
            <div class="step-text"><b>Pick the newest file.</b> Sort by date modified and take the top one: that's the run you just finished (<code>.sspre</code> for Nightly, <code>.phxr</code> for Rewrite).</div>
          </li>
          <li>
            <div class="step-art">${howtoArt.send('.sspre')}</div>
            <div class="step-text"><b>Send it to the bot.</b> In the Discord server's bot commands channel, run <b>/submit</b> and attach the replay. If the bot says it doesn't know the map, run it again with the map file in the <b>map</b> option (its reply says where that file is).</div>
          </li>
        </ol>
        <h2 style="font-size:16px;margin:22px 0 8px">What happens next</h2>
        <p class="muted" style="margin:0">The bot replies with a card: <b>verified</b> (your PP and new rank), <b>held for review</b> (a curator checks it by hand and the bot messages you when it's decided), or <b>not counted</b>, with why and what to do. Your first play signs you up under your Discord name; change it with <b>/rename</b>. This website shows the play a minute or two later.</p>
        ${config.discord ? `<p style="margin:18px 0 0"><a class="btn" href="${esc(config.discord)}" rel="noopener">Join the Discord</a></p>` : ''}
      </section>`;
    return;
  }
  let saved = ''; try { saved = localStorage.getItem('rpp-token') || ''; } catch { /* storage unavailable */ }
  app.innerHTML = `
    <p class="eyebrow">Submit</p>
    <h1>Submit a play</h1>
    <p class="sub">The easiest way is <b>/submit</b> in the Discord server. You can also upload here: a Nightly replay (<code>.sspre</code>, in <code>%APPDATA%\\SoundSpacePlus\\replays</code>) or a Rewrite replay (<code>.phxr</code>, in <code>%APPDATA%\\Rhythia\\replays</code>). The server re-checks the whole run before it counts.</p>
    <div class="grid2">
      <section class="card pad">
        <h2 style="margin-top:0">1 · Get a player token</h2>
        <p class="muted" style="margin-top:0">No email or password. Pick a name and you'll get a token that works as your login. Keep it private.</p>
        <form id="reg" class="row"><div><label for="name">Player name</label><input id="name" type="text" maxlength="20" autocomplete="off" placeholder="3-20 letters, digits, _ - ."></div><button>Create</button></form>
        <div id="reg-out"></div>
      </section>
      <section class="card pad">
        <h2 style="margin-top:0">2 · Upload a replay</h2>
        <label for="token">Your token</label><input id="token" type="password" autocomplete="off" value="${esc(saved)}" placeholder="paste your token">
        <div id="drop" class="drop" style="margin-top:12px"><b>Drop a .phxr replay here</b><br>or click to choose a file</div>
        <div id="sub-out"></div>
      </section>
    </div>
    <p class="muted" style="margin-top:18px;font-size:12.5px">Only full passes on ranked maps, without NoFail or Autoplay, award PP. Plays that look unusual are held for a curator to review instead of being rejected automatically.</p>`;

  document.getElementById('reg').addEventListener('submit', async e => {
    e.preventDefault();
    const out = document.getElementById('reg-out');
    try {
      const r = await api('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('name').value.trim() }) });
      out.innerHTML = `<p class="msg ok">Welcome, ${esc(r.name)}. Your token (shown once):</p><div class="token">${esc(r.token)}</div><button class="ghost" id="use">Use this token</button>`;
      document.getElementById('use').onclick = () => { document.getElementById('token').value = r.token; try { localStorage.setItem('rpp-token', r.token); } catch { /* ignore */ } };
    } catch (err) { out.innerHTML = `<p class="msg err">${esc(err.message)}</p>`; }
  });

  dropZone(document.getElementById('drop'), '.phxr,.sspre', async file => {
    const out = document.getElementById('sub-out');
    const token = document.getElementById('token').value.trim();
    if (!token) { out.innerHTML = '<p class="msg err">Paste your token first.</p>'; return; }
    try { localStorage.setItem('rpp-token', token); } catch { /* ignore */ }
    out.innerHTML = '<p class="msg">Verifying…</p>';
    try {
      const r = await api('/api/scores', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: await readFile(file) });
      out.innerHTML = `<div class="result">${statusPill(r.status, r.failed)} <b>${esc(r.map.title)}</b> ${stars(r.stars)}
        <div class="breakdown">
          <div><div class="k">PP</div><div class="v">${r.status === 'verified' && r.ranked ? pp(r.pp) : '—'}</div></div>
          <div><div class="k">Accuracy</div><div class="v">${pct(r.accuracy)}</div></div>
          <div><div class="k">Would be worth</div><div class="v">${pp(r.potentialPP)}</div></div>
        </div>
        ${!r.ranked ? '<p class="msg">This map is not ranked, so the play is stored but awards no PP.</p>' : ''}
        ${r.reasons.length ? `<ul class="reasons">${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${r.flags.length ? `<p class="msg">Held for review:</p><ul class="reasons">${r.flags.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
    } catch (err) { out.innerHTML = `<p class="msg err">${esc(err.message)}</p>`; }
  });
}

/** The public site's explanation: what the numbers mean, without the formula itself. */
const aboutPublic = () => `<div class="prose">
    <h1>How PP works</h1>
    <p class="sub">Two numbers: a map's <b>star rating</b> (how hard it is to play) and a play's <b>PP</b> (how impressive the result was).</p>
    <h2>Star rating</h2>
    <p>There's no clicking in Rhythia: a note counts the moment your cursor touches it. So a map's difficulty is about <i>steering</i>: how far and how fast the cursor has to travel, and how often it has to change direction sharply. Notes right next to each other are easy; wide jumps and quick reversals are hard, and long hard sections count for more than a single tricky moment.</p>
    <p>Speed changes the whole map: a play at 115% is rated on the map as it plays at 115%, and one at 80% on the map slowed to 80%. Nightly's speed buttons are arrows (&lt; is 1 ÷ 1.15, about 87%; &gt; is 115%), Rewrite's are percentages; plays show the speed in the game's own terms, and every map page shows its rating at each game's speeds.</p>
    <h2>PP for a play</h2>
    <p>A play's PP comes from the map's stars and your accuracy. A full combo on a 5★ map is worth 120pp, and harder maps are worth much more. Every miss costs, and the gap to a full combo grows steadily: on a typical 2,000-note map one miss keeps 99% of the play, five keep 95%, twenty keep 82%. On a 1,000-note map an S (98%) keeps about three quarters of a full combo, an A (95%) about half, a B (90%) about a third. Longer maps forgive a little more, but not in proportion to their length, so a long map can't hide misses. Longer maps are worth a little more. Mods that make a map harder add a little, valued by the rules of the game the play was in, and Nightly's Hard Rock is rated on its spread-out notes. NoFail, Autoplay, Extra Energy and spin plays don't count.</p>
    <h2>Grades</h2>
    <p>SS ${grade(1)} 100% · S ${grade(0.98)} 98%+ · A 95%+ · B 90%+ · C 85%+ · D 80%+ · F below. Every hit counts fully, so an SS is always a full combo, and it shines. An S just one miss from it is silver ${grade(0.99, false, { misses: 1 })}. Set either with a mod that adds PP in the game it was played in, or faster than 100%, and it's charged: ${grade(1, false, { misses: 0, boosted: true })} ${grade(0.99, false, { misses: 2, boosted: true })} ${grade(0.99, false, { misses: 1, boosted: true })}</p>
    <h2>Total PP</h2>
    <p>Your best play on each ranked map, sorted high to low: your best counts in full, the next 95%, the one after about 90%, and so on. You rank up by setting great scores on many maps, not by grinding one.</p>
    <h2>Keeping it fair</h2>
    <ul>
      <li>Only curator-approved <b>ranked maps</b> give PP, and each is identified by its exact notes, so an edited copy can't borrow a ranked leaderboard.</li>
      <li>Every replay is re-checked before it counts: it has to be a real pass with allowed settings, and the recorded cursor has to touch every note it claims to hit.</li>
      <li>Plays that look automated are <b>held for a person to check</b>, never banned automatically.</li>
    </ul>
  </div>`;

/** The weekly roundups, kept as they were posted in Discord. */
async function roundupsPage(app = currentPage()) {
  setTab('stats');
  const list = await api('/api/roundups');
  const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const medal = ['🥇', '🥈', '🥉'];
  const one = r => `<section class="card" style="padding:16px 18px;margin-bottom:12px">
      <h2 style="margin:0 0 2px">${esc(day(r.from))} – ${esc(day(r.to))}</h2>
      <p class="muted" style="margin:0 0 10px">${r.plays} verified play${r.plays === 1 ? '' : 's'} · ${r.newPlayers} new player${r.newPlayers === 1 ? '' : 's'}</p>
      ${r.best.length ? `<h3 style="margin:8px 0 4px">Best plays</h3><ol class="rd-list">${r.best.map((b, i) => `<li>${medal[i] ?? ''} <a href="${playerLink(b.player)}">${esc(b.player)}</a> · <a href="#/map/${b.mapId}">${esc(b.title)}</a> · <b>${pp(b.pp)}</b> · ${pct(b.accuracy)}</li>`).join('')}</ol>` : '<p class="muted">No ranked plays that week.</p>'}
      ${r.top.length ? `<h3 style="margin:8px 0 4px">Top players then</h3><p class="muted" style="margin:0">${r.top.map(t => `#${t.rank} <a href="${playerLink(t.name)}">${esc(t.name)}</a> (${pp(t.pp)})`).join(' · ')}</p>` : ''}
      ${r.map ? `<h3 style="margin:8px 0 4px">🎯 Map of the week</h3><p style="margin:0"><a href="#/map/${r.map.id}">${esc(r.map.title)}</a>${r.map.artist ? ` · ${esc(r.map.artist)}` : ''} · ${fmt(r.map.stars)}★</p>` : ''}
    </section>`;
  app.innerHTML = `<p class="eyebrow">Stats</p><h1>Weekly roundups</h1>
    <p class="sub">The roundup posted in the Discord every Monday, kept here. <a href="#/stats">Back to the stats</a></p>
    ${list.length ? list.map(one).join('') : '<p class="empty">The first roundup is posted on a Monday evening and will appear here.</p>'}`;
}

/** Two players side by side: the maps they've both played, who is ahead on each, and the biggest gaps. */
async function comparePage(nameA, nameB, app = currentPage()) {
  setTab('rankings');
  const pick = (which, other) => p => { location.hash = which === 'a' ? `#/compare/${enc(p.name)}${other ? `/${enc(other)}` : ''}` : `#/compare/${enc(other)}/${enc(p.name)}`; };
  const picker = (id, label) => `<div class="psearch" role="search" aria-label="${label}"><input id="${id}" type="search" placeholder="${label}" aria-label="${label}" autocomplete="off" spellcheck="false"></div>`;
  const wire = () => {
    const a = document.getElementById('cmp-a'), b = document.getElementById('cmp-b');
    if (a) playerSearch(a, pick('a', nameB));
    if (b) playerSearch(b, pick('b', nameA));
  };
  if (!nameA || !nameB) {
    app.innerHTML = `<p class="eyebrow">Compare</p><h1>Compare two players</h1>
      <p class="sub">See who's ahead on the maps you've both played.</p>
      <div class="toolbar">${nameA ? `<b>${esc(nameA)}</b> vs ` : picker('cmp-a', 'First player')}${nameB ? ` <b>${esc(nameB)}</b>` : ''}${nameA ? picker('cmp-b', 'Second player') : nameB ? '' : picker('cmp-b', 'Second player')}</div>`;
    wire();
    return;
  }
  const [a, b] = await Promise.all([api(`/api/players/${enc(nameA)}`), api(`/api/players/${enc(nameB)}`)]);
  const mapsOf = p => p.ranked ?? p.top;   // every ranked map (`top` is only the best 100; files built before `ranked` existed have just that)
  const c = compareBest(mapsOf(a), mapsOf(b));
  const head = (p, lead) => `<a class="card cmp-head" href="${playerLink(p.name)}">${avatar(p.name, '', p.avatar)}<div><div class="title">${esc(p.name)}</div><div class="meta">${p.rank ? `#${p.rank} · ` : ''}${pp(p.pp)} · ${mapsOf(p).length} ranked map${mapsOf(p).length === 1 ? '' : 's'}</div></div><div class="ppv">${lead}</div></a>`;
  const row = s => `<tr class="link" data-href="#/map/${s.mapId}">
      <td><a href="#/map/${s.mapId}">${esc(s.title)}</a> ${stars(s.stars)}</td>
      <td class="r num${s.diff > 0 ? ' cmp-win' : ''}">${pp(s.a.pp)}<span class="muted hide-sm"> · ${pct(s.a.accuracy)}</span></td>
      <td class="r num${s.diff < 0 ? ' cmp-win' : ''}">${pp(s.b.pp)}<span class="muted hide-sm"> · ${pct(s.b.accuracy)}</span></td>
      <td class="r num hide-sm">${Math.abs(s.diff) < 0.005 ? 'tied' : `${esc((s.diff > 0 ? a : b).name)} +${fmt(Math.abs(s.diff), 0)}pp`}</td></tr>`;
  app.innerHTML = `
    <p class="eyebrow">Compare</p>
    <h1>${esc(a.name)} vs ${esc(b.name)}</h1>
    <div class="cmp-heads">${head(a, `ahead on ${c.aAhead}`)}${head(b, `ahead on ${c.bAhead}`)}</div>
    <p class="sub">${c.shared.length ? `${c.shared.length} shared map${c.shared.length === 1 ? '' : 's'}${c.tied ? `, tied on ${c.tied}` : ''}. Only ${esc(a.name)} has played ${c.aOnly} of their maps, only ${esc(b.name)} ${c.bOnly} of theirs.` : 'No shared maps yet: they haven\'t both set a play on the same ranked map.'}</p>
    ${c.shared.length ? `<div class="card table-wrap"><table class="cmp">
      <thead><tr><th>Map</th><th class="r">${esc(a.name)}</th><th class="r">${esc(b.name)}</th><th class="r hide-sm">Gap</th></tr></thead>
      <tbody>${c.shared.map(row).join('')}</tbody></table></div>` : ''}
    <div class="toolbar" style="margin-top:18px">${picker('cmp-b', 'Compare with…')}</div>`;
  wire();
}

/** Community activity: plays and active players per week, and how the two clients compare. */
async function statsPage(app = currentPage()) {
  setTab('stats');
  const [a, s] = await Promise.all([api('/api/activity'), api('/api/stats')]);
  const max = Math.max(1, ...a.weeks.map(w => w.plays));
  const W = 640, H = 180, gap = 8, bar = (W - gap * (a.weeks.length - 1)) / a.weeks.length;
  const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const bars = a.weeks.map((w, i) => {
    const h = Math.round((w.plays / max) * (H - 24)), x = i * (bar + gap);
    return `<rect x="${x}" y="${H - 20 - h}" width="${bar}" height="${Math.max(h, w.plays ? 2 : 0)}" rx="3" fill="var(--accent)"${i === a.weeks.length - 1 ? ' opacity=".6"' : ''}><title>Week of ${esc(day(w.start))}: ${w.plays} plays</title></rect>
      ${(a.weeks.length - 1 - i) % 3 === 0 ? `<text x="${x + bar / 2}" y="${H - 4}" text-anchor="${i === a.weeks.length - 1 ? 'end' : 'middle'}" font-size="16" fill="var(--dim)">${esc(day(w.start))}</text>` : ''}`;
  }).join('');
  const now = a.weeks[a.weeks.length - 1], last = a.weeks[a.weeks.length - 2];
  const c = a.clients, both = c.nightly.plays + c.rewrite.plays;
  const share = n => (both ? `${Math.round((n / both) * 100)}%` : '–');
  app.innerHTML = `
    <h1>Community stats</h1>
    <p class="sub">Verified plays and players, by week. The current week is lighter because it isn't over yet.</p>
    <div class="stat-row four" style="margin:18px 0">
      <div class="stat"><div class="v">${s.players}</div><div class="k">${plural(s.players, 'Player')}</div></div>
      <div class="stat"><div class="v">${s.scores}</div><div class="k">Verified ${plural(s.scores, 'play')}</div></div>
      <div class="stat"><div class="v">${now.plays}</div><div class="k">${plural(now.plays, 'Play')} this week</div></div>
      <div class="stat"><div class="v">${now.newPlayers}</div><div class="k">New ${plural(now.newPlayers, 'player')} this week</div></div>
    </div>
    <section class="card" style="padding:18px">
      <h2 style="margin-top:0">Plays per week</h2>
      <svg class="weekly" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verified plays per week for the last ${a.weeks.length} weeks. This week: ${now.plays}. Last week: ${last?.plays ?? 0}." style="width:100%;height:auto">${bars}</svg>
    </section>
    <p style="margin:18px 0 0"><a href="#/roundups">Past weekly roundups →</a></p>
    <h2>By client</h2>
    <div class="stat-row four">
      <div class="stat"><div class="v">${c.nightly.plays}</div><div class="k">Nightly plays (${share(c.nightly.plays)}) · ${c.nightly.players} player${c.nightly.players === 1 ? '' : 's'}</div></div>
      <div class="stat"><div class="v">${c.rewrite.plays}</div><div class="k">Rewrite plays (${share(c.rewrite.plays)}) · ${c.rewrite.players} player${c.rewrite.players === 1 ? '' : 's'}</div></div>
    </div>`;
}

/** The public roadmap: docs/roadmap/ (one file per item), filtered by server/roadmap.js to what may be seen (no private notes, no unapproved ideas). */
const LANES = [
  ['now', 'Now', 'What we are working on right now.'],
  ['next', 'Next', 'Decided, and coming after what\'s above.'],
  ['later', 'Later', 'Ideas we want to get to, with no date yet.'],
  ['done', 'Done', 'Already live.'],
];
const AREA_NAME = { website: 'Website', discord: 'Discord', rankings: 'Rankings', fairness: 'Fairness', bot: 'Bot', network: 'Network' };
const PRIORITY = { critical: 'Top priority', high: 'High priority', medium: 'Medium priority', low: 'Low priority' };
const EFFORT = { small: 'Small job', medium: 'Medium job', large: 'Large job', huge: 'Huge job' };
async function roadmapPage(app = currentPage()) {
  setTab('roadmap');
  const r = await api('/api/roadmap');
  const updated = new Date(`${r.updated}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const item = (it, meta = true) => `<li class="rm-card"><span class="rm-tags"><span class="pill">${esc(AREA_NAME[it.area] ?? it.area)}</span>${meta && it.lane !== 'done' ? `<span class="pill rm-${esc(it.importance)}">${esc(PRIORITY[it.importance])}</span><span class="pill">${esc(EFFORT[it.difficulty])}</span>` : ''}</span><h3>${esc(it.title)}</h3><p>${esc(it.summary)}</p></li>`;
  const by = lane => r.items.filter(i => i.lane === lane);
  const section = ([id, name, blurb]) => {
    const items = by(id);
    const list = id === 'done' ? `<details id="rm-done"${kept.roadmap.doneOpen ? ' open' : ''}><summary>Show what's finished</summary><ul class="rm-list">${items.map(i => item(i)).join('')}</ul></details>`
      : items.length ? `<ul class="rm-list">${items.map(i => item(i)).join('')}</ul>` : '<p class="muted">Nothing here right now.</p>';
    return `<section class="rm-lane rm-${id}" aria-labelledby="rm-${id}"><h2 id="rm-${id}">${esc(name)} <span class="rm-count">${items.length}</span></h2><p class="rm-blurb">${esc(blurb)}</p>${list}</section>`;
  };
  const notPlanned = by('not-planned');
  const invite = isStatic && config.discord ? `<a class="btn" href="${esc(config.discord)}" rel="noopener">Share an idea in the Discord</a>` : '';
  app.innerHTML = `
    <p class="eyebrow">Roadmap</p>
    <h1>Where this is going</h1>
    <p class="sub">What we're working on, what comes next, and what's already finished. Updated ${esc(updated)}. These are plans, not promises: the order and timing can change.</p>
    <div class="stat-row four" style="margin:18px 0">
      ${LANES.map(([id, name]) => `<a class="stat" href="#rm-${id}" data-rm="${id}"><div class="v">${by(id).length}</div><div class="k">${esc(name)}</div></a>`).join('')}
    </div>
    ${LANES.map(section).join('')}
    ${notPlanned.length ? `<section class="rm-lane" aria-labelledby="rm-not">
      <h2 id="rm-not">Not planned</h2>
      <p class="rm-blurb">Things we've decided against, so nobody waits for them.</p>
      <ul class="rm-list">${notPlanned.map(i => item(i, false)).join('')}</ul>
    </section>` : ''}
    <section class="card rm-ask"><div><h2 style="margin:0 0 4px">Got an idea?</h2><p class="rm-blurb" style="margin:0">Tell us what would make the rankings better for you. Good ideas end up on this page.</p></div>${invite}</section>`;
  app.querySelectorAll('[data-rm]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); document.getElementById(`rm-${a.dataset.rm}`)?.scrollIntoView({ behavior: 'smooth' }); }));
  document.getElementById('rm-done')?.addEventListener('toggle', e => { kept.roadmap.doneOpen = e.target.open; });
}

const calcPage = () => { location.hash = '#/'; }, aboutFull = calcPage;   // local server only

async function aboutPage(app = currentPage()) {
  setTab('about');
  if (isStatic) { app.innerHTML = aboutPublic(); return; }
  return aboutFull(app);
}

// ---------- player search ----------
// Everyone who has submitted a play has a profile, ranked or not (data/players.json). Loaded the first time it's used.
let playerList = null;
const loadPlayers = () => (playerList ??= api('/api/players').catch(() => { playerList = null; return []; }));
function playerSearch(input, onPick = null) {
  if (!input || input.dataset.ready) return;
  input.dataset.ready = '1';
  const box = document.createElement('div');
  box.className = 'psearch-list'; box.id = `${input.id}-list`; box.setAttribute('role', 'listbox'); box.hidden = true;
  input.after(box);
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-controls', box.id); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-autocomplete', 'list');
  let items = [], at = -1;
  const close = () => { box.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
  const mark = () => {
    [...box.querySelectorAll('.psearch-item')].forEach((el, i) => el.classList.toggle('on', i === at));
    if (at >= 0) input.setAttribute('aria-activedescendant', `${box.id}-${at}`); else input.removeAttribute('aria-activedescendant');
  };
  const show = async () => {
    const q = input.value.trim().toLowerCase();
    if (!q) return close();
    const all = await loadPlayers();
    if (input.value.trim().toLowerCase() !== q) return;   // they kept typing
    const starts = p => p.name.toLowerCase().startsWith(q);
    items = all.filter(p => p.name.toLowerCase().includes(q)).sort((a, b) => starts(b) - starts(a)).slice(0, 8);
    at = items.length ? 0 : -1;
    box.innerHTML = items.length ? items.map((p, i) => `<a role="option" id="${box.id}-${i}" class="psearch-item" href="${playerLink(p.name)}">${avatar(p.name, 'sm', p.avatar)}
        <span class="n">${p.country ? `<span class="flag">${esc(p.country)}</span> ` : ''}${esc(p.name)}${p.staff ? ` <span class="staff-mini">${esc(p.staff)}</span>` : ''}${demoPill(p.demo)}</span>
        <span class="m">${p.rank ? `#${p.rank} · ${pp(p.pp)}` : 'no ranked plays yet'}</span></a>`).join('')
      : `<div class="psearch-none">No player called “${esc(input.value.trim())}”.</div>`;
    mark(); box.hidden = false; input.setAttribute('aria-expanded', 'true');
  };
  const go = p => { if (onPick) onPick(p); else location.hash = playerLink(p.name).replace(/^.*#/, '#'); input.value = ''; close(); input.blur(); };
  input.addEventListener('input', show);
  input.addEventListener('focus', () => { loadPlayers(); if (input.value.trim()) show(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && items.length) { at = (at + 1) % items.length; mark(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && items.length) { at = (at - 1 + items.length) % items.length; mark(); e.preventDefault(); }
    else if (e.key === 'Enter' && at >= 0 && !box.hidden) { go(items[at]); e.preventDefault(); }
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));   // after a click on a result
  box.addEventListener('mousedown', e => e.preventDefault());       // keep focus while clicking a result
  box.addEventListener('click', e => { const a = e.target.closest('.psearch-item'); if (a) { e.preventDefault(); go(items[Number(a.id.split('-').pop())]); } });
}

// ---------- router ----------
/** What a wrong or stale link gets: what wasn't found, and where to go instead. */
function missingPage(page, arg = '') {
  const name = safeDecode(arg);
  const [title, why] = page === 'player' ? [`No player named “${name}”`, 'Players appear here after their first play in the Discord server. Names can change (/rename), so an old link can go stale: try the player search on the Rankings page.']
    : page === 'map' ? ['This map isn’t on the site', 'It may have been removed, or the link is wrong. The Maps page lists every map here.']
    : page === 'replay' ? ['This play isn’t here', 'Only verified plays have a replay page. A play held for review appears once a curator approves it.']
    : ['Page not found', 'There’s nothing at this address. Check the link, or start from the home page.'];
  return `<section class="missing"><p class="eyebrow">Not found</p><h1>${esc(title)}</h1><p class="sub">${why}</p>
    <p class="ways"><a class="btn ghost small" href="#/">Home</a><a class="btn ghost small" href="#/rankings">Rankings</a><a class="btn ghost small" href="#/maps">Maps</a></p></section>`;
}
const errorPage = e => `<section class="missing"><p class="eyebrow">Something went wrong</p><h1>This page couldn’t load</h1>
  <p class="sub">${esc(String(e.message).replace(/\.?$/, '.'))} It may be a connection hiccup: <a href="#" id="retry">try again</a>, or start from the <a href="#/">home page</a>.</p></section>`;

/** Draws the page for the address. `focus`: a navigation, so the new page's heading takes focus (screen readers say it). */
async function route({ keepScroll = false, focus = false } = {}) {
  const hash = location.hash.slice(1) || '/';
  const [, page, arg, arg2] = hash.split('/');
  // This draw's own container, in #app at once. A refresh in place (keepScroll) keeps what is on screen until the new page replaces it.
  const container = document.createElement('div');
  container.className = 'page';
  if (keepScroll) container.append(...app.childNodes); else container.innerHTML = '<p class="loading">Loading…</p>';
  app.replaceChildren(container);
  shown = container;
  try {
    if (!page) await home();
    else if (page === 'rankings') await rankings(arg);
    else if (page === 'maps') await maps();
    else if (page === 'pool') await poolPage();
    else if (page === 'map' && arg) await mapPage(arg);
    else if (page === 'player' && arg) await playerPage(safeDecode(arg));
    else if (page === 'player') { history.replaceState(null, '', '#/rankings'); await rankings(); }   // an address with no name: the Rankings page, where players are found
    else if (page === 'replay' && arg) { setTab('maps'); await (await import('./replay.js?v=6d31c76940')).mount(container, Number(arg), { api, esc, fmt, pct, pp, grade, stars, avatar, playerLink, share, coverUrl, replayFileUrl, songUrl }); }
    else if (page === 'submit') submitPage();
    else if (page === 'calc' && !isStatic) await calcPage();
    else if (page === 'about') await aboutPage();
    else if (page === 'roadmap') await roadmapPage();
    else if (page === 'stats') await statsPage();
    else if (page === 'roundups') await roundupsPage();
    else if (page === 'compare') await comparePage(arg && safeDecode(arg), arg2 && safeDecode(arg2));
    else container.innerHTML = missingPage(page);
  } catch (e) {
    if (shown === container) container.innerHTML = /not found/i.test(e.message) ? missingPage(page, arg) : errorPage(e);   // (not when the visitor has moved on while it loaded)
    container.querySelector('#retry')?.addEventListener('click', ev => { ev.preventDefault(); route({ focus: true }); });
  }
  if (!keepScroll && shown === container) window.scrollTo(0, 0);
  if (focus && shown === container) { const h = container.querySelector('h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  scrollHints();
}

app.addEventListener('click', async e => {
  const btn = e.target.closest('[data-share]');
  if (btn) {
    const url = new URL(btn.dataset.share, document.baseURI).href;
    try { await navigator.clipboard.writeText(url); btn.textContent = 'Copied!'; } catch { prompt('Copy this link:', url); }
    setTimeout(() => { btn.textContent = 'Copy link'; }, 1600);
    return;
  }
  const tr = e.target.closest('tr[data-href]');
  if (tr && !e.target.closest('a')) location.hash = tr.dataset.href;
});
window.addEventListener('hashchange', () => { window.dispatchEvent(new Event('rpp:leave')); route({ focus: true }); });
if (isStatic) document.querySelector('[data-tab="calc"]')?.remove();   // the public site has no Calculator
if (isStatic) { const t = document.querySelector('[data-tab="submit"]'); if (t) t.textContent = 'How to submit'; }   // nothing is uploaded there
// The bot refreshes the public site's heartbeat (aliveAt) about once an hour; much older means it has stopped.
const OFFLINE_AFTER = 3 * 3600;
const showStats = s => {
  document.getElementById('demo-banner').hidden = !s.demoData;
  const offline = isStatic && s.aliveAt > 0 && Date.now() / 1000 - s.aliveAt > OFFLINE_AFTER;
  document.getElementById('offline-banner').hidden = !offline;
  if (offline) document.getElementById('offline-since').textContent = ago(s.aliveAt);
  document.getElementById('algo').textContent = isStatic ? (s.updatedAt ? `Updated ${ago(s.updatedAt)}` : '') : `version ${s.version} · algorithm ${s.algorithm}`;
};
let seenUpdate = null;
api('api/stats').then(s => { seenUpdate = s.updatedAt; showStats(s); }).catch(() => {});
// While the public site is open it checks for new data every 20 seconds and redraws the page when there is some, so a
// new play just appears. Not the replay viewer (it would lose its place) or while someone is typing.
if (isStatic) setInterval(async () => {
  if (document.hidden) return;
  const s = await api('api/stats').catch(() => null);
  if (!s) return;
  showStats(s);
  if (!s.updatedAt || s.updatedAt === seenUpdate) return;
  const first = seenUpdate === null;
  seenUpdate = s.updatedAt;
  const page = (location.hash.slice(1) || '/').split('/')[1];
  playerList = null;   // new players show up in search without a reload
  if (!first && page !== 'replay' && !document.activeElement?.matches?.('input, textarea, select')) { await ready(); route({ keepScroll: true }); }   // ready(): new maps get their covers
  if (!first) refreshMe();   // new notifications, and a popup for a medal earned just now
}, 20_000);
/** On narrow screens the header's search box is folded behind a magnifier button; it opens on its own row and closes when left empty. */
function searchToggle() {
  const tog = document.getElementById('search-toggle'), bar = document.querySelector('.topbar-inner'), box = document.getElementById('psearch');
  if (!tog || !bar || !box) return;
  const open = on => { bar.classList.toggle('search-open', on); tog.setAttribute('aria-expanded', String(on)); if (on) box.focus(); };
  tog.addEventListener('click', () => open(!bar.classList.contains('search-open')));
  box.addEventListener('keydown', e => { if (e.key === 'Escape') { open(false); tog.focus(); } });
  box.addEventListener('blur', () => setTimeout(() => { if (!box.value && document.activeElement !== box) open(false); }, 150));
  window.addEventListener('hashchange', () => { box.value = ''; open(false); });
}
// Shareable links (/m/1, /p/name, /r/5) open the matching page.
const shared = location.pathname.match(/\/(m|p|r)\/([^/]+)\/?$/);
if (shared) history.replaceState(null, '', `${location.pathname.slice(0, shared.index)}/#/${{ m: 'map', p: 'player', r: 'replay' }[shared[1]]}/${shared[1] === 'p' ? enc(fromPlayerKey(shared[2])) : shared[2]}`);
// Coming back from logging in with Discord: finish that first (it puts the page you were on back in the address bar).
ready().then(finishLogin).then(() => { route(); refreshMe(); playerSearch(document.getElementById('psearch')); searchToggle(); });
