// Small helpers for getting a song for the replay viewer. No page code in here (it also runs under Node, in the tests).
import { mp3Frames, bitrateKind } from './mp3.js?v=340159337d';

/** raw.githubusercontent.com form of a GitHub file link (it allows cross-origin downloads). */
export const rawLink = link => { const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:raw|blob)\/(.+)$/.exec(link ?? ''); return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : link; };

/** The challenge sheet's copy of a map, when it is a GitHub file (the only host this page may fetch from); otherwise null. */
export const sheetLinkOf = link => { const raw = rawLink(link); return typeof raw === 'string' && /^https:\/\/raw\.githubusercontent\.com\//.test(raw) ? raw : null; };

/** The most a map file (with its song) may be. */
export const SHEET_MAX = 120 * 1024 * 1024;

/**
 * The body of a response, read as it arrives and given up as soon as it is more than `max` (not after all of it is in memory). An answer
 * with no stream (a 204, or a browser that has none) is read whole. A body over the limit throws Error(`${what} is too big to be a map.`), or what
 * `what` makes when it is a function.
 */
export async function readCapped(res, max, what = 'That file') {
  const tooBig = typeof what === 'function' ? what : () => new Error(`${what} is too big to be a map.`);
  if (Number(res.headers?.get?.('content-length')) > max) throw tooBig();
  if (!res.body) { const bytes = new Uint8Array(await res.arrayBuffer()); if (bytes.length > max) throw tooBig(); return bytes; }
  const reader = res.body.getReader(), chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { reader.cancel().catch(() => {}); throw tooBig(); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

/**
 * The most an MP3 may be to be decoded here (a phone, which has a touch screen and nothing finer, only a small one: a decoded song is about ten times its
 * size in memory while it is made), the longest a decoded song is kept, and how long a decode may take before the song is played as it was.
 * (A 6½ minute stereo song takes about a second, 70 MB as a WAV and about 210 MB of memory while it is being made, on a computer.)
 */
export const SEEKABLE_MAX_BYTES = 16 * 1024 * 1024, SEEKABLE_PHONE_MAX_BYTES = 3 * 1024 * 1024, SEEKABLE_MAX_SECONDS = 15 * 60, SEEKABLE_TIMEOUT_MS = 10_000;

/** A phone or tablet: no mouse or trackpad anywhere on it. (Where the browser cannot say, it is not.) */
export const isPhone = () => { try { const fine = globalThis.matchMedia?.('(any-pointer: fine)'); return fine ? !fine.matches : false; } catch { return false; } };

/** Decoded sound (one array of samples per channel) as a 16-bit WAV file: a browser seeks in one of those to the sample. */
export function wavBlob(channels, sampleRate) {
  const ch = channels.length, n = channels[0].length, header = new DataView(new ArrayBuffer(44));
  const put = (at, text) => { for (let i = 0; i < text.length; i++) header.setUint8(at + i, text.charCodeAt(i)); };
  put(0, 'RIFF'); header.setUint32(4, 36 + n * ch * 2, true); put(8, 'WAVE'); put(12, 'fmt '); header.setUint32(16, 16, true); header.setUint16(20, 1, true);
  header.setUint16(22, ch, true); header.setUint32(24, sampleRate, true); header.setUint32(28, sampleRate * ch * 2, true); header.setUint16(32, ch * 2, true); header.setUint16(34, 16, true);
  put(36, 'data'); header.setUint32(40, n * ch * 2, true);
  const pcm = new Int16Array(n * ch);
  for (let c = 0; c < ch; c++) {
    const from = channels[c];
    for (let i = 0; i < n; i++) { const v = from[i]; pcm[i * ch + c] = v >= 1 ? 32767 : v <= -1 ? -32768 : v * 32767; }
  }
  return new Blob([header, pcm], { type: 'audio/wav' });
}

/**
 * The song, in a form a browser seeks in exactly. A browser seeks in an MP3 by estimating where the time is (a variable-bitrate one, with or without
 * its table of contents, lands up to half a second away from where `currentTime` says it is, and keeps saying so), and the viewer seeks after the
 * intro skip, after every pause and when the timeline is dragged: the music then plays out of step with the notes and nothing can tell. So an MP3 is
 * decoded and kept as a WAV. Anything else (Ogg, WAV, FLAC seek well), a song that is too big or too long to keep decoded (less on a phone), one the
 * browser cannot decode, and one whose decode takes more than `timeoutMs` (a phone browser may never answer) are left exactly as they were: the
 * viewer never waits on this longer than that.
 */
export async function seekable(blob, { phone = isPhone(), timeoutMs = SEEKABLE_TIMEOUT_MS } = {}) {
  try {
    if (blob.size > (phone ? SEEKABLE_PHONE_MAX_BYTES : SEEKABLE_MAX_BYTES)) return blob;
    const head = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
    const mp3 = (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!mp3 || !Context) return blob;
    const context = new Context();
    let timer;
    try {
      const decode = (async () => {
        const sound = await context.decodeAudioData(await blob.arrayBuffer());
        if (!(sound.duration > 0) || sound.duration > SEEKABLE_MAX_SECONDS) return null;
        return wavBlob(Array.from({ length: sound.numberOfChannels }, (_, c) => sound.getChannelData(c)), sound.sampleRate);
      })().catch(() => null);
      const given = new Promise(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); });
      return (await Promise.race([decode, given])) ?? blob;
    } finally { clearTimeout(timer); context.close?.().catch?.(() => {}); }
  } catch { return blob; }
}

/**
 * The song as the viewer should play it: { blob, slice }. What decides is how a browser can seek in it. An MP3 whose frames all have the same bitrate (constant) is
 * seeked exactly as it is. A variable-bitrate one is not: it is made into a WAV where that is allowed (`seekable`: not on a phone, not a big or long one), and
 * otherwise played by cutting it at the right frame (`slice`: true; see web/slice.js), which needs no decode. Anything that is not an MP3, or an MP3 whose frames
 * cannot be read, is left to `seekable`. `decode: false` never makes a WAV.
 */
export async function prepareSong(blob, { phone = isPhone(), timeoutMs = SEEKABLE_TIMEOUT_MS, decode = true } = {}) {
  try {
    const head = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
    if (!((head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0))) return { blob, slice: false };
    const frames = mp3Frames(new Uint8Array(await blob.arrayBuffer()));
    if (frames.count < 10) return { blob: decode ? await seekable(blob, { phone, timeoutMs }) : blob, slice: false };   // (not frames this can read: as before)
    if (!bitrateKind(frames).variable) return { blob, slice: false };
    if (decode) { const wav = await seekable(blob, { phone, timeoutMs }); if (wav !== blob) return { blob: wav, slice: false }; }
    return { blob, slice: true };
  } catch { return { blob, slice: false }; }
}
