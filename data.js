// Where the site's data comes from. Running locally (`npm start`) it asks the server's API; the public site is a
// static copy (built by server/site.js) where the same answers are JSON files, so it needs no server at all.
// All paths are relative, so the site works at a domain's root or under a folder (e.g. user.github.io/project/).

import { playerKey, safeDecode } from './keys.js?v=2df34811c3';

export const isStatic = document.querySelector('meta[name="rpp-static"]')?.content === '1';
/** Site settings baked into a static build: { discord (invite link), publicUrl }. */
export const config = (() => { try { return JSON.parse(document.getElementById('rpp-config')?.textContent || '{}'); } catch { return {}; } })();

let covers = {};   // static builds: map id -> cover file extension

/** Loads what the synchronous URL helpers need. Call once before rendering. */
export async function ready() {
  if (isStatic) covers = await fetch('data/covers.json', FRESH).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
}

// Data is always checked with the server: browsers otherwise reuse GitHub Pages' copy for 10 minutes, and a new play
// wouldn't show. Unchanged files still come from the browser's cache (the server just says "not modified").
const FRESH = { cache: 'no-cache' };

/**
 * One data file. A file that is missing is "not found" only for what a visitor asked for by name (`entity`: a map, a player, a replay); a list the
 * site itself needs (the leaderboard, the feed) that is missing is a problem with the site, said as one. A file that arrives cut short is a damaged
 * answer, never an empty one (the tiles would read "undefined").
 */
async function json(url, { entity = false } = {}) {
  const res = await fetch(url, FRESH);
  const body = await res.json().catch(() => (res.ok ? null : {}));
  if (!res.ok) throw new Error(res.status === 404 ? (entity ? 'Not found.' : 'Part of the site’s data is missing (404).') : body?.error || `Request failed (${res.status})`);
  if (body === null) throw new Error('The site’s data came back damaged.');
  return body;
}

/** The site's API, e.g. api('api/maps/3'). On a static build this reads the matching JSON file. */
export async function api(path, opts) {
  // An address part that is only dots ("." or "..", also written %2e) names nothing, and a URL would quietly read it as a step back up.
  if (path.split(/[?#]/)[0].split('/').some(part => /^(\.|%2e){1,2}$/i.test(part))) throw new Error('Not found.');
  const url = new URL(path.replace(/^\//, ''), 'http://x/');
  if (!isStatic) {
    const res = await fetch(url.pathname.slice(1) + url.search, opts);
    const body = await res.json().catch(() => (res.ok ? null : {}));   // (an answer that is cut short is damaged data, not an empty one: the tiles would read "undefined")
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    if (body === null) throw new Error('The site’s data came back damaged.');
    return body;
  }
  if (opts?.method && opts.method !== 'GET') throw new Error('Plays are submitted in Discord on this site.');
  const parts = url.pathname.split('/').filter(Boolean).slice(1).map(safeDecode);   // after "api"
  const [a, b, c] = parts;
  if (a === 'stats') return json('data/stats.json');
  if (a === 'feed') return json('data/feed.json');
  if (a === 'top-plays') return json('data/top-plays.json');
  if (a === 'pool') return json('data/pool.json');
  if (a === 'activity') return json('data/activity.json');
  if (a === 'roundups') return json('data/roundups.json');
  if (a === 'roadmap') return json('data/roadmap.json');
  if (a === 'discord-players') return json('data/discord.json');
  if (a === 'leaderboard') {
    const rows = await json('data/leaderboard.json');
    const limit = Number(url.searchParams.get('limit')) || 50, offset = Number(url.searchParams.get('offset')) || 0;
    return rows.slice(offset, offset + limit);
  }
  if (a === 'maps' && !b) {
    const all = await json('data/maps.json'), status = url.searchParams.get('status') || 'ranked';
    return status === 'all' ? all : all.filter(m => m.status === status);
  }
  if (a === 'maps' && b && !c) return json(`data/maps/${Number(b)}.json`, { entity: true });
  if (a === 'players' && !b) return json('data/players.json');   // everyone registered, for search
  if (a === 'players' && b) return json(`data/players/${playerKey(b)}.json`, { entity: true });
  if (a === 'scores' && b && c === 'replay') return json(`data/replays/${Number(b)}.json`, { entity: true });
  throw new Error('Not found.');
}

/** A map's cover image, or null if it has none. */
export const coverUrl = id => (isStatic ? (covers[id] ? `covers/${id}.${covers[id]}` : null) : `api/maps/${id}/cover`);
/** The downloadable replay file for a play (replay viewer data carries it on static builds). */
export const replayFileUrl = v => (isStatic ? v.replayFile ?? null : `api/scores/${v.id}/replay-file`);
/** The map's song from the host's map library; static builds never serve songs. */
export const songUrl = mapId => (isStatic ? null : `api/maps/${mapId}/audio`);
