// MP3 frames: where each one starts and when. Pure functions on bytes (no page code: it also runs under Node, in the tests and in the bot's diagnostics).

const BITRATE = { 3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], 0: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
const RATE = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** The header of the Layer III frame that starts at byte `i`, or null when no frame does: { length, rate, kbps, samples, channels, version, crc }. */
export function frameHeader(b, i) {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const version = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3, bitrate = b[i + 2] >> 4, rate = (b[i + 2] >> 2) & 3, pad = (b[i + 2] >> 1) & 1;
  if (version === 1 || layer !== 1 || bitrate === 0 || bitrate === 15 || rate === 3) return null;
  const kbps = BITRATE[version][bitrate], hz = RATE[version][rate], v1 = version === 3;
  return { length: Math.floor(((v1 ? 144 : 72) * kbps * 1000) / hz) + pad, rate: hz, kbps, samples: v1 ? 1152 : 576, channels: ((b[i + 3] >> 6) & 3) === 3 ? 1 : 2, version, crc: !(b[i + 1] & 1) };
}

/**
 * Every frame of an MP3, in order: `at` (byte where it starts), `time` (seconds into the song), and `kbps`, as typed arrays, with how long the song is and
 * what the first frame is (a Xing, Info or VBRI frame carries no sound: it says how the file was made). A tag at the start (ID3v2) is skipped, junk between
 * frames is searched past (a frame that comes after junk counts only when the next one follows it, so junk that looks like a header is not taken for one), and a
 * tag at the end (ID3v1) ends the list.
 * Returns { count, at, time, kbps, seconds, rate, channels, first: { tag, toc, delay, padding } | null } (count 0: not an MP3 this can read).
 */
export function mp3Frames(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let i = 0;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) i = 10 + (((b[6] & 127) << 21) | ((b[7] & 127) << 14) | ((b[8] & 127) << 7) | (b[9] & 127)) + (b[5] & 16 ? 10 : 0);
  let cap = Math.ceil(b.length / 160) + 16, at = new Uint32Array(cap), time = new Float64Array(cap), kbps = new Uint16Array(cap);   // (a frame is mostly 400 to 1000 bytes; the arrays grow when a file has smaller ones)
  const grow = () => { cap *= 2; for (const [name, T, old] of [['at', Uint32Array, at], ['time', Float64Array, time], ['kbps', Uint16Array, kbps]]) { const bigger = new T(cap); bigger.set(old); if (name === 'at') at = bigger; else if (name === 'time') time = bigger; else kbps = bigger; } };
  let count = 0, seconds = 0, rate = 0, channels = 0, first = null, end = -1;
  while (i < b.length - 4) {
    const h = frameHeader(b, i);
    // A frame counts when the next one follows it, or when it follows the one before without a break (the stream has not been lost), or when only a tag is left after it.
    if (h && (i === end || i + h.length >= b.length - 256 || frameHeader(b, i + h.length))) {
      if (!count) { rate = h.rate; channels = h.channels; first = tagOf(b, i, h); }
      if (count === cap) grow();
      at[count] = i; time[count] = seconds; kbps[count] = h.kbps; count++;
      seconds += h.samples / h.rate; i += h.length; end = i;
    } else i++;
  }
  return { count, at: at.subarray(0, count), time: time.subarray(0, count), kbps: kbps.subarray(0, count), seconds, rate, channels, first };
}

/** What the first frame says about how the file was made: its tag ('Xing', 'Info', 'VBRI' or null), whether it has a table of contents, and the encoder's delay and padding in samples (LAME). */
function tagOf(b, i, h) {
  const text = o => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  const side = h.version === 3 ? (h.channels === 1 ? 17 : 32) : (h.channels === 1 ? 9 : 17), at = i + 4 + (h.crc ? 2 : 0) + side;
  if (text(i + 4 + (h.crc ? 2 : 0) + 32) === 'VBRI') return { tag: 'VBRI', toc: true, delay: null, padding: null };
  const tag = text(at);
  if (tag !== 'Xing' && tag !== 'Info') return null;
  const flags = b[at + 7], lame = at + 8 + (flags & 1 ? 4 : 0) + (flags & 2 ? 4 : 0) + (flags & 4 ? 100 : 0) + (flags & 8 ? 4 : 0);
  const known = text(lame) === 'LAME' || text(lame) === 'Lavc' || text(lame) === 'Lavf';
  return { tag, toc: !!(flags & 4), delay: known ? (b[lame + 21] << 4) | (b[lame + 22] >> 4) : null, padding: known ? ((b[lame + 22] & 15) << 8) | b[lame + 23] : null };
}

/**
 * What a browser needs to know to seek in an MP3: whether every sound frame has the same bitrate (constant: a seek lands exactly) or the bitrate varies
 * (a seek is an estimate that can be off by half a second). The first frame is left out when it is a tag with no sound in it.
 */
export function bitrateKind(frames) {
  const from = frames.first?.tag ? 1 : 0, seen = new Set();
  for (let k = from; k < frames.count; k++) seen.add(frames.kbps[k]);
  return { variable: seen.size > 1, bitrates: seen.size, kbps: seen.size === 1 ? [...seen][0] : null };
}
