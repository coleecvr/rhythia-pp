// Logging in with Discord on the website, only to know who's looking: the top-right corner then shows your picture and
// name, your notifications, and a popup when you earn a medal. It uses Discord's browser login (no server needed):
// the token Discord hands back is used once to ask who you are, then dropped. Everything shown is public leaderboard
// data, so being logged in changes what's highlighted, never what can be seen.
import { api, config } from './data.js?v=1e811fa8d4';
import { findMyPlayer } from './keys.js?v=2df34811c3';
import { medalSVG } from './medals.js?v=c632b7ea6a';

const ME = 'rpp-me', READ = 'rpp-notes-read', SEEN = 'rpp-medals-seen';
const store = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: not remembered */ } },
  del: k => { try { localStorage.removeItem(k); } catch { /* nothing to forget */ } },
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt0 = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const when = t => { const s = Date.now() / 1000 - t; return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };

export const loginAvailable = () => !!config.clientId;
export const currentUser = () => store.get(ME);

/** Sends the browser to Discord to log in; it comes back to the page it left. */
export function login() {
  const state = Array.from(crypto.getRandomValues(new Uint32Array(3))).join('-');
  try { sessionStorage.setItem('rpp-login', JSON.stringify({ state, back: location.hash })); } catch { /* still works, lands on Home */ }
  const q = new URLSearchParams({ client_id: config.clientId, response_type: 'token', redirect_uri: location.origin + location.pathname, scope: 'identify', state, prompt: 'none' });
  location.href = `https://discord.com/oauth2/authorize?${q}`;
}

export function logout() { store.del(ME); }

/** Finishes a login when Discord sends the browser back with #access_token=…. Call before routing. */
export async function finishLogin() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.has('access_token') && !h.has('error')) return;
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem('rpp-login') || '{}'); sessionStorage.removeItem('rpp-login'); } catch { /* no saved state */ }
  history.replaceState(null, '', location.pathname + location.search + (saved.back || '#/'));
  if (h.get('error') === 'access_denied') return;   // cancelled on Discord's page: nothing to say
  if (!h.has('access_token')) return notice('Logging in with Discord didn\'t finish. Try again from the top-right corner.');
  if (h.get('state') !== saved.state) return notice('That login link was started somewhere else, so it was ignored. Log in again from the top-right corner.');
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', { headers: { authorization: `Bearer ${h.get('access_token')}` } });
    if (!res.ok) return notice('Discord didn\'t confirm who you are. Try logging in again.');
    const u = await res.json();
    const first = !store.get(ME);
    store.set(ME, { id: u.id, name: u.global_name || u.username, avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : null });
    // A first login starts clean: what happened before isn't announced as new.
    if (first) { const now = Math.floor(Date.now() / 1000); store.set(READ, now); store.set(SEEN, now); }
  } catch { notice('Discord couldn\'t be reached, so you\'re not logged in. Try again in a moment.'); }
}

/** A short message at the bottom of the page that goes away by itself. */
export function notice(text) {
  const el = document.createElement('div');
  el.className = 'notice';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.classList.add('out'), 7000);
  setTimeout(() => el.remove(), 7600);
}

/** Notifications from the player's own public data, newest first. */
function notificationsFor(p) {
  const pp = n => `${fmt0(n)}pp`, list = [];
  for (const m of p.medals ?? []) if (m.earnedAt) list.push({ at: m.earnedAt, icon: medalSVG(m, 30), text: `Medal unlocked: <b>${esc(m.name)}</b>`, sub: esc(m.about), href: `#/player/${encodeURIComponent(p.name)}` });
  for (const s of p.recent ?? []) {
    const text = s.status === 'verified' ? (s.ranked === false ? `Verified on <b>${esc(s.title)}</b> (unranked map)` : `<b>${pp(s.pp)}</b> on ${esc(s.title)}`)
      : s.status === 'review' ? `Held for review: <b>${esc(s.title)}</b>` : `Not counted: <b>${esc(s.title)}</b>`;
    // Only verified plays have a public replay page; the others link to the profile, and say what happens next.
    list.push({ at: s.submittedAt, icon: `<span class="ni">${s.status === 'verified' ? '✅' : s.status === 'review' ? '⏳' : '❌'}</span>`, text,
      sub: s.status === 'review' ? 'A curator will check it by hand. The bot messages you when it\'s decided.' : s.status === 'verified' ? '' : 'The bot\'s reply to /submit says why, and what to do.',
      href: s.status === 'verified' ? `#/replay/${s.id}` : `#/player/${encodeURIComponent(p.name)}` });
  }
  for (const s of p.firsts ?? []) list.push({ at: s.submittedAt + 1, icon: '<span class="ni">🏆</span>', text: `You're <b>#1</b> on ${esc(s.title)}`, sub: '', href: `#/map/${s.mapId}` });
  const h = p.history ?? [];
  for (let i = 1; i < h.length; i++) {
    if (h[i].rank === h[i - 1].rank) continue;
    const up = h[i].rank < h[i - 1].rank;
    list.push({ at: Date.parse(`${h[i].day}T12:00:00Z`) / 1000, icon: `<span class="ni">${up ? '📈' : '📉'}</span>`, text: up ? `You climbed to <b>#${h[i].rank}</b>` : `You dropped to #${h[i].rank}`, sub: `${pp(h[i].pp)} total`, href: '#/rankings' });
  }
  const sorted = list.sort((a, b) => b.at - a.at).slice(0, 40);
  // Plays waiting for a curator are not listed on a public page, only counted: a line at the top (not an event, so never "new"), and the bot messages the player about each one when it is decided.
  if (p.inReview) sorted.unshift({ at: 0, icon: '<span class="ni">⏳</span>', text: `<b>${p.inReview}</b> ${p.inReview === 1 ? 'play is' : 'plays are'} waiting for a curator`, sub: 'A curator will check it by hand. The bot messages you when it\'s decided.', href: `#/player/${encodeURIComponent(p.name)}` });
  return sorted;
}

let mine = null;   // { user, player } once known
let playerName = null;

/** The top-right corner. Call on start and whenever the site's data changes (it re-reads your page then). */
export async function refreshMe(slot = document.getElementById('me')) {
  if (!slot) return;
  const user = currentUser();
  if (!user) {
    // Quiet on purpose: logging in only highlights your own plays; signing up is the first /submit in Discord.
    slot.innerHTML = loginAvailable() ? '<button class="btn small ghost login" id="me-login" title="See your own plays and notifications. Signing up is your first /submit in the Discord server." aria-label="Log in with Discord to see your own plays and notifications">Log in</button>' : '';
    slot.querySelector('#me-login')?.addEventListener('click', login);
    return;
  }
  const found = await findMyPlayer(user.id, playerName, { discordPlayers: () => api('api/discord-players'), playerByName: name => api(`api/players/${encodeURIComponent(name)}`) });
  playerName = found.name;
  const player = found.player;
  mine = { user, player };
  const notes = player ? notificationsFor(player) : [];
  const read = store.get(READ, 0), unread = notes.filter(n => n.at > read).length;
  const pic = player?.avatar ?? user.avatar;
  const open = { notes: slot.querySelector('#me-notes')?.hidden === false, menu: slot.querySelector('#me-drop')?.hidden === false };   // a list that is open when the data refreshes is still open after it
  slot.innerHTML = `
    ${player ? `<button class="bell" id="me-bell" aria-label="Notifications${unread ? `, ${unread} new` : ''}">🔔${unread ? `<span class="badge">${unread > 9 ? '9+' : unread}</span>` : ''}</button>` : ''}
    <button class="who-me" id="me-menu" aria-label="Your account"><span class="avatar sm" data-initial="${esc([...String(player?.name ?? user.name)][0]?.toUpperCase() ?? '?')}">${pic ? `<img src="${esc(pic)}" alt="" referrerpolicy="no-referrer">` : ''}</span><span class="nm">${esc(player?.name ?? user.name)}</span></button>
    <div class="me-panel" id="me-notes" hidden>
      <div class="hd"><b>Notifications</b>${notes.length ? `<span class="muted">${unread ? `${unread} new` : 'all read'}</span>` : ''}</div>
      <div class="list">${notes.length ? notes.map(n => `<a class="note${n.at > read ? ' new' : ''}" href="${n.href}">${n.icon}<span class="tx">${n.text}${n.sub ? `<small>${n.sub}</small>` : ''}</span><time>${n.at ? when(n.at) : ''}</time></a>`).join('') : '<p class="empty">Nothing yet. Submit a play in the Discord server!</p>'}</div>
    </div>
    <div class="me-panel menu" id="me-drop" hidden>
      ${player ? `<a href="#/player/${encodeURIComponent(player.name)}">My profile</a>` : '<p class="muted">You\'re not on the leaderboard yet. Submit a play with <code>/submit</code> in the Discord server.</p>'}
      <button id="me-out">Log out</button>
    </div>`;
  const notesEl = slot.querySelector('#me-notes'), drop = slot.querySelector('#me-drop');
  notesEl.hidden = !open.notes; drop.hidden = !open.menu;
  const close = () => { notesEl.hidden = true; drop.hidden = true; };
  slot.querySelector('#me-bell')?.addEventListener('click', e => {
    e.stopPropagation(); drop.hidden = true; notesEl.hidden = !notesEl.hidden;
    if (!notesEl.hidden && unread) { store.set(READ, Math.floor(Date.now() / 1000)); slot.querySelector('.bell .badge')?.remove(); }
  });
  slot.querySelector('#me-menu').addEventListener('click', e => { e.stopPropagation(); notesEl.hidden = true; drop.hidden = !drop.hidden; });
  slot.querySelector('#me-out').addEventListener('click', () => { logout(); playerName = null; mine = null; refreshMe(slot); });
  for (const a of slot.querySelectorAll('.me-panel a')) a.addEventListener('click', close);
  if (!slot.dataset.outside) { slot.dataset.outside = '1'; document.addEventListener('click', e => { if (!slot.contains(e.target)) for (const pnl of slot.querySelectorAll('.me-panel')) pnl.hidden = true; }); }
  if (player) celebrate(player);
}

/** A congratulations popup for each medal earned since the last one shown, one after another (a play often earns several). */
function celebrate(p) {
  if (document.getElementById('celebrate')) return;   // one already showing
  const seen = store.get(SEEN, Math.floor(Date.now() / 1000));
  const fresh = (p.medals ?? []).filter(m => m.earnedAt && m.earnedAt > seen).sort((a, b) => a.earnedAt - b.earnedAt || b.tier - a.tier);
  if (!fresh.length) return;
  const el = Object.assign(document.createElement('div'), { id: 'celebrate', className: 'celebrate' });
  document.body.append(el);
  let i = 0;
  const show = () => {
    const m = fresh[i];
    el.innerHTML = `
      <div class="box" role="dialog" aria-modal="true" aria-label="Medal unlocked: ${esc(m.name)}">
        <div class="rays"></div>
        <div class="art">${medalSVG(m, 150)}</div>
        <p class="eyebrow">Medal unlocked${fresh.length > 1 ? ` · ${i + 1} of ${fresh.length}` : ''}</p>
        <h2>${esc(m.name)}</h2>
        <p class="flavor">${esc(m.flavor)}</p>
        <p class="how">${esc(m.about)}</p>
        <button class="btn">${i + 1 < fresh.length ? 'Next' : 'Nice!'}</button>
      </div>`;
    el.querySelector('button').addEventListener('click', next);
    el.querySelector('button').focus();
  };
  const next = () => {
    if (++i < fresh.length) return show();
    store.set(SEEN, Math.max(...fresh.map(m => m.earnedAt)));   // all of them seen
    el.remove();
  };
  el.addEventListener('click', e => { if (e.target === el) next(); });
  show();
}
