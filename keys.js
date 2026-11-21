// Player names in share links and file names (/p/<key>/, data/players/<key>.json). A key is the name in lower case
// with anything but a-z 0-9 _ - written as ".xx" bytes, so it's a valid file name on every system and a URL path
// that needs no escaping (static hosts look files up by the unescaped path, so "%20" in a link would never match).
// Used by the browser and by server/site.js.

// On Windows a file called con, prn, aux, nul, com1-9 or lpt1-9 (with any extension, even con.json or con.2etxt) is a device, not a
// file, so a player called Con would stop the whole website from being written and published. The first letter of such a key is
// written as .xx like any other special character ("con" is ".63on"), and it reads back as the same name.
const DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?=\.|$)/;
export const playerKey = name => {
  const key = String(name).toLowerCase().replace(/[^a-z0-9_-]/gu, c => [...new TextEncoder().encode(c)].map(b => `.${b.toString(16).padStart(2, '0')}`).join(''));
  return DEVICE.test(key) ? `.${key.charCodeAt(0).toString(16)}${key.slice(1)}` : key;
};

/** The lower-case name a key stands for. Anything that isn't a key (an older link like /p/some%20name/) is returned as is. */
export function fromPlayerKey(key) {
  if (!/^(?:[a-z0-9_-]|\.[0-9a-f]{2})+$/.test(key)) return key;
  const bytes = key.match(/\.[0-9a-f]{2}|./g).map(t => (t.length === 3 ? parseInt(t.slice(1), 16) : t.charCodeAt(0)));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** decodeURIComponent that never throws: a stray % in a link ("#/player/100%") is read as it is instead of breaking the page with "URI malformed". */
export function safeDecode(text) {
  if (typeof text !== 'string') return text;
  try { return decodeURIComponent(text); } catch { return text; }
}

/** The tab's title for a page: the page's own heading, then the site's short name; the plain title where there is no heading to name (the home page, a page that is not there). */
export const PLAIN_TITLE = 'Rhythia Community PP';
export function pageTitle(heading) {
  const name = String(heading ?? '').replace(/\s+/g, ' ').trim();
  return name ? `${name} · Rhythia PP` : PLAIN_TITLE;
}

/** The name part of a page's heading: its first text, not what sits beside it (a player's heading has a demo pill and a staff badge after the name). */
export const headingName = h1 => [...(h1?.childNodes ?? [])].find(n => n.nodeType === 3 && n.textContent.trim())?.textContent;

// SHA-256 written out (a browser's crypto.subtle only answers on a secure page, and it answers later; this answers now, the same in the browser and in Node).
const PRIMES = [], isPrime = n => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
for (let n = 2; PRIMES.length < 64; n++) if (isPrime(n)) PRIMES.push(n);
const frac = x => Math.floor((x % 1) * 2 ** 32), K = PRIMES.map(p => frac(Math.cbrt(p))), H0 = PRIMES.slice(0, 8).map(p => frac(Math.sqrt(p)));
export function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text)), padded = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64), view = new DataView(padded.buffer);
  padded.set(data); padded[data.length] = 0x80;
  view.setUint32(padded.length - 8, Math.floor((data.length * 8) / 2 ** 32)); view.setUint32(padded.length - 4, (data.length * 8) >>> 0);
  const h = Uint32Array.from(H0), w = new Uint32Array(64), rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let at = 0; at < padded.length; at += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(at + i * 4);
    for (let i = 16; i < 64; i++) w[i] = (w[i - 16] + (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) + w[i - 7] + (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10))) >>> 0;
    let [a, b, c, d, e, f, g, i2] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (i2 + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0, t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      i2 = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, i2].forEach((v, i) => { h[i] = (h[i] + v) >>> 0; });
  }
  return [...h].map(v => v.toString(16).padStart(8, '0')).join('');
}

/**
 * A Discord account as the public site knows it: a one-way key, never the id. The site lists `{ key: player name }` (data/discord.json) and the browser
 * works out the key of whoever logged in, so "Log in with Discord" still finds the player and nobody can read the account ids off the list.
 * (Someone who already knows an id can still check it against a key: this hides the ids, it does not make them secret.)
 */
export const discordKey = id => sha256Hex(`rpp-discord:${id}`).slice(0, 32);

/**
 * The logged-in visitor's player: `knownName` is what was found earlier (null: not looked up yet). A name that no longer has a
 * page (the player used /rename, /optout or was banned) is looked up again instead of being trusted for the rest of the visit.
 * `io`: { discordPlayers() -> { discordKey(id): name }, playerByName(name) -> the player, throwing when there is none }.
 */
export async function findMyPlayer(userId, knownName, io) {
  const nameFor = async () => (await io.discordPlayers().catch(() => ({})))[discordKey(userId)] ?? null;
  let name = knownName ?? await nameFor();
  let player = name ? await io.playerByName(name).catch(() => null) : null;
  if (!player && knownName) { name = await nameFor(); player = name ? await io.playerByName(name).catch(() => null) : null; }
  return { name, player };
}
