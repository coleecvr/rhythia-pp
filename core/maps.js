// Map parsers for the formats the open-source Rhythia client plays:
//   .sspm v1 / v2  (Sound Space Plus maps, still importable by the client)
//   .phxm          (the client's native format: a zip with metadata.json + objects.phxmo)
//   objects.phxmo  (raw note data)
//
// Every parser returns notes in the client's *internal* coordinate space, exactly as
// scripts/map/MapParser.cs produces them (x right, y up, grid cells at -1/0/1), sorted by time.

import { BinaryReader, sha256, toHex } from './binary.js?v=c1bee73d1d';

const SSPM_SIG = 'SS+m';

/** @typedef {{ ms: number, x: number, y: number }} Note */
/** @typedef {{ format: string, id: string, artist: string, title: string, mappers: string[],
 *   difficulty: number, difficultyName: string, lengthMs: number, notes: Note[] }} ParsedMap */

export const DIFFICULTY_NAMES = ['N/A', 'Easy', 'Medium', 'Hard', 'Insane', 'Illogical'];

// What a map can be. The biggest real charts have a few thousand notes and last minutes, and everything made from a map (its rating
// at ten speeds, the notes stored as text, the website's pages) grows with these, so a file that claims millions of notes, or a note
// hours away, is refused when it is read: before anything is made for it, whoever sent it (a player's /submit, /nominate, the sheet).
export const MAX_MAP_NOTES = 200_000;
export const MAX_MAP_SPAN_MS = 3 * 3600 * 1000;
/** Positions are in cells of the grid (-1, 0, 1), and quantum notes may lie a little beyond it (a Hard Rock layout reaches 1.35). */
const MAX_NOTE_POSITION = 10;
/** Notes that share one millisecond: a grid has nine places, and the replay check works through each moment's notes together. */
const MAX_NOTES_AT_ONCE = 64;
const commas = n => Number(n).toLocaleString('en-US');
/** The number of notes a header claims, checked before the notes are read. */
const checkNoteCount = n => {
  if (n > MAX_MAP_NOTES) throw new Error(`this map file claims ${commas(n)} notes, and a map can have up to ${commas(MAX_MAP_NOTES)}`);
  return n;
};

function splitName(full) {
  const i = full.indexOf(' - ');
  if (i < 0) return { artist: '', title: full.trim() };
  return { artist: full.slice(0, i).trim(), title: full.slice(i + 3).trim() };
}

// Stable sort by time only: .phxmo files are already in the client's order (it never re-sorts them),
// so ties keep file order. Replay note indices refer to that order; the verifier also tolerates
// reordering within same-millisecond groups, since the client's Array.Sort on .sspm import is unstable.
function sortNotes(notes) {
  return notes.sort((a, b) => a.ms - b.ms);
}

function canonicalOrder(notes) {
  return [...notes].sort((a, b) => a.ms - b.ms || a.x - b.x || a.y - b.y);
}

function finish(map) {
  checkNoteCount(map.notes.length);
  map.notes = sortNotes(map.notes);
  for (const n of map.notes) {
    if (!(Math.abs(n.x) <= MAX_NOTE_POSITION && Math.abs(n.y) <= MAX_NOTE_POSITION)) throw new Error('this map has a note with no position, or far outside the grid');
  }
  for (let i = 0, run = 0; i < map.notes.length; i++) {
    run = i && map.notes[i].ms === map.notes[i - 1].ms ? run + 1 : 1;
    if (run > MAX_NOTES_AT_ONCE) throw new Error(`this map has more than ${MAX_NOTES_AT_ONCE} notes at the same moment (${commas(map.notes[i].ms)} ms)`);
  }
  const last = map.notes.length ? map.notes[map.notes.length - 1].ms : 0;
  if (last > MAX_MAP_SPAN_MS) throw new Error(`this map has a note ${commas(last)} ms in (over ${MAX_MAP_SPAN_MS / 3600_000} hours): too long to be a map`);
  // The length written in the file is kept when it is a length (a map's length can be more than its last note's time), else it is the last note's time.
  if (!(map.lengthMs > 0 && map.lengthMs <= MAX_MAP_SPAN_MS)) map.lengthMs = last;
  map.difficulty = Math.min(Math.max(map.difficulty | 0, 0), DIFFICULTY_NAMES.length - 1);
  if (!map.difficultyName) map.difficultyName = DIFFICULTY_NAMES[map.difficulty];
  return map;
}

export function parseSSPM(bytes) {
  const r = new BinaryReader(bytes);
  if (r.str(4) !== SSPM_SIG) throw new Error('not an SSPM file (bad signature)');
  const version = r.u16();
  if (version === 1) return parseSSPMv1(r);
  if (version === 2) return parseSSPMv2(r);
  throw new Error(`unsupported SSPM version ${version}`);
}

function parseSSPMv1(r) {
  r.skip(2); // reserved
  const id = r.line();
  const { artist, title } = splitName(r.line());
  const mappers = r.line().split(/[&,]/).map(s => s.trim()).filter(Boolean);
  const lengthMs = r.u32();
  const noteCount = r.u32();
  const difficulty = r.u8();

  const coverType = r.u8(); // 0 none, 1 raw Godot image, 2 PNG
  if (coverType === 1) { r.skip(6); r.skip(r.u64()); }
  else if (coverType === 2) { r.skip(r.u64()); }

  if (r.u8() === 1) r.skip(r.u64()); // audio

  checkNoteCount(noteCount);
  const notes = new Array(noteCount);
  for (let i = 0; i < noteCount; i++) {
    const ms = r.u32();
    const quantum = r.bool();
    const x = quantum ? r.f32() : r.u8();
    const y = quantum ? r.f32() : r.u8();
    notes[i] = { ms, x: Math.fround(x - 1), y: Math.fround(-y + 1) };
  }
  return finish({ format: 'sspm1', id, artist, title, mappers, difficulty, difficultyName: '', lengthMs, notes });
}

function parseSSPMv2(r) {
  r.skip(4);  // reserved
  r.skip(20); // sha1 of markers
  const lengthMs = r.u32();
  const noteCount = r.u32();
  r.skip(4);  // marker count
  const difficulty = r.u8();
  r.skip(2);  // rating
  r.bool();   // has audio
  r.bool();   // has cover
  r.skip(1);  // requires mod
  const customDataOffset = r.u64();
  r.u64();    // custom data length
  r.skip(32); // audio offset/length, cover offset/length
  r.skip(16); // marker definitions offset/length
  const markerOffset = r.u64();
  r.skip(8);  // marker byte length
  const id = r.str(r.u16());
  const { artist, title } = splitName(r.str(r.u16()));
  r.skip(r.u16()); // song name (duplicate of map name)
  const mapperCount = r.u16();
  const mappers = [];
  for (let i = 0; i < mapperCount; i++) mappers.push(r.str(r.u16()));

  let difficultyName = '';
  try {
    r.seek(customDataOffset);
    r.skip(2);
    if (r.str(r.u16()) === 'difficulty_name') {
      const t = r.u8();
      const len = t === 9 ? r.u16() : t === 11 ? r.u32() : 0;
      difficultyName = r.str(len);
    }
  } catch { /* custom data is optional */ }

  r.seek(markerOffset);
  const notes = readSSPMv2Notes(r, noteCount);
  return finish({ format: 'sspm2', id, artist, title, mappers, difficulty, difficultyName, lengthMs, notes });
}

function readSSPMv2Notes(r, noteCount) {
  checkNoteCount(noteCount);
  const notes = new Array(noteCount);
  for (let i = 0; i < noteCount; i++) {
    const ms = r.u32();
    const type = r.u8();
    if (type !== 0) throw new Error(`unsupported SSPM v2 marker type ${type} at note ${i}`);
    const quantum = r.bool();
    const x = quantum ? r.f32() : r.u8();
    const y = quantum ? r.f32() : r.u8();
    notes[i] = { ms, x: Math.fround(x - 1), y: Math.fround(-y + 1) };
  }
  return notes;
}

/** Notes from an SSPM v2 marker block on its own (for reading a map's notes without downloading its audio). */
export const sspmV2Notes = (markerBytes, noteCount) => readSSPMv2Notes(new BinaryReader(markerBytes), noteCount);

export function parsePHXMO(bytes) {
  const r = new BinaryReader(bytes);
  r.u32(); // header size / version (12)
  const noteCount = checkNoteCount(r.u32());
  const notes = new Array(noteCount);
  for (let i = 0; i < noteCount; i++) {
    const ms = r.u32();
    const quantum = r.bool();
    const x = quantum ? r.f32() : r.u8() - 1;
    const y = quantum ? r.f32() : r.u8() - 1;
    notes[i] = { ms, x: Math.fround(x), y: Math.fround(y) };
  }
  return sortNotes(notes);
}

export function mapFromPHXM(metadata, objectsBytes) {
  const m = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
  return finish({
    format: 'phxm',
    id: String(m.ID ?? ''),
    artist: String(m.Artist ?? ''),
    title: String(m.Title ?? ''),
    mappers: Array.isArray(m.Mappers) ? m.Mappers.map(String) : [],
    difficulty: Number(m.Difficulty ?? 0),
    difficultyName: String(m.DifficultyName ?? ''),
    lengthMs: Number(m.Length ?? 0),
    notes: parsePHXMO(objectsBytes),
  });
}

// Minimal zip reader (central directory + stored/deflate entries). `inflateRaw` is injected so
// the same code runs in Node (zlib.inflateRawSync) and browsers (DecompressionStream). Node's is told how many bytes it may produce
// (its second argument), so a zip that packs gigabytes of zeros stops at the limit instead of after it.
/** The most one zip may unpack to in all (a map is a few MB; a pack of a few hundred maps stays under this). */
export const MAX_ZIP_TOTAL = 320 * 1024 * 1024;
/**
 * Files in a zip by name (without folders): `wanted` is a list of names, or a test like name => name.endsWith('.sspm').
 * Limits: `total` bytes for the whole zip, and `limit[name]` for one file (a real metadata.json is a few KB). A name is taken once
 * (the first), and a file the directory lists again is not unpacked again: how a few KB of zip named one big file thousands of times.
 */
export async function readZipEntries(bytes, wanted, inflateRaw, { total = MAX_ZIP_TOTAL, limit = {}, paths = false } = {}) {
  const want = typeof wanted === 'function' ? wanted : n => wanted.includes(n);
  const r = new BinaryReader(bytes);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip archive');
  r.seek(eocd + 10);
  const count = r.u16();
  r.u32();
  let p = r.u32();
  const out = {}, listed = new Set();
  let used = 0;
  for (let n = 0; n < count; n++) {
    r.seek(p);
    if (r.u32() !== 0x02014b50) throw new Error('corrupt zip central directory');
    r.skip(6);
    const method = r.u16();
    r.skip(8);
    const compSize = r.u32();
    r.u32();
    const nameLen = r.u16(), extraLen = r.u16(), commentLen = r.u16();
    r.skip(8);
    const localOffset = r.u32();
    const name = r.str(nameLen).replace(/\\/g, '/');
    p = r.pos + extraLen + commentLen;
    const base = name.split('/').pop();
    // A file is found by its own name; with `paths` it is returned under its whole path, so two folders may each hold a song.phxm.
    const key = paths ? name.replace(/^\/+/, '') : base;
    if (!base || Object.hasOwn(out, key) || listed.has(localOffset) || !want(base)) continue;
    listed.add(localOffset);
    const room = Math.min(limit[base] ?? Infinity, total - used);
    const tooBig = () => new Error(`a file inside this map unpacks to over ${Math.max(1, Math.round(Math.max(room, 0) / 1048576))} MB, so it wasn't read (too much for one map file)`);
    if (room < 1) throw tooBig();
    r.seek(localOffset + 26);
    const ln = r.u16(), le = r.u16();
    r.skip(ln + le);
    const data = r.bytesN(compSize);
    if (method === 0) { if (data.length > room) throw tooBig(); out[key] = data; }
    else if (method === 8) out[key] = await inflateRaw(data, room);
    else throw new Error(`unsupported zip compression method ${method} for ${name}`);
    if (out[key].length > room) throw tooBig();   // (an unpacker that was not told the limit)
    used += out[key].length;
  }
  return out;
}

/** A PHXM's metadata.json is a few KB, and its notes take 13 bytes at most each: these cover a map at the note limit with room to spare. */
const MAX_METADATA_BYTES = 1024 * 1024, MAX_OBJECTS_BYTES = 8 * 1024 * 1024;

export async function parsePHXM(bytes, inflateRaw) {
  const e = await readZipEntries(bytes, ['metadata.json', 'objects.phxmo'], inflateRaw, { limit: { 'metadata.json': MAX_METADATA_BYTES, 'objects.phxmo': MAX_OBJECTS_BYTES } });
  if (!e['metadata.json'] || !e['objects.phxmo']) throw new Error('PHXM archive is missing metadata.json or objects.phxmo');
  return mapFromPHXM(new TextDecoder().decode(e['metadata.json']), e['objects.phxmo']);
}

/**
 * Cover art embedded in a map file, as { bytes, type: 'png'|'jpg' }, or null. SSPM v1 stores PNG covers
 * as type 2 (type 1 is a raw Godot image, which we skip); SSPM v2 stores an offset/length; PHXM zips
 * contain cover.png.
 */
/** A cover over this is not read (a real one is a few hundred KB). */
const MAX_COVER_BYTES = 4 * 1024 * 1024;
export async function extractCover(bytes, inflateRaw) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let data = null;
  try {
    if (b[0] === 0x50 && b[1] === 0x4b) {
      data = (await readZipEntries(b, ['cover.png'], inflateRaw))['cover.png'] ?? null;
    } else if (b[0] === 0x53 && b[1] === 0x53 && b[2] === 0x2b && b[3] === 0x6d) {
      const r = new BinaryReader(b);
      r.skip(4);
      const version = r.u16();
      if (version === 1) {
        r.skip(2); r.line(); r.line(); r.line(); r.skip(9);
        if (r.u8() === 2) data = r.bytesN(r.u64());
      } else if (version === 2) {
        r.skip(4 + 20 + 12 + 1 + 2 + 1);
        const hasCover = r.bool();
        r.skip(1 + 16 + 16);
        const offset = r.u64(), length = r.u64();
        if (hasCover && length > 0) data = r.seek(offset).bytesN(length);
      }
    }
  } catch { return null; }
  if (!data || data.length < 8 || data.length > MAX_COVER_BYTES) return null;
  if (data[0] === 0x89 && data[1] === 0x50) return { bytes: data, type: 'png' };
  if (data[0] === 0xff && data[1] === 0xd8) return { bytes: data, type: 'jpg' };
  return null;
}

/**
 * The song embedded in a map file, as { bytes, type: 'mp3'|'ogg'|'wav'|'flac', mime }, or null. SSPM v2 stores an
 * offset/length in its header, SSPM v1 stores it after the cover, PHXM zips contain audio.<ext>.
 */
export async function extractAudio(bytes, inflateRaw) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let data = null;
  try {
    if (b[0] === 0x50 && b[1] === 0x4b) {
      const e = await readZipEntries(b, ['audio.mp3', 'audio.ogg', 'audio.wav', 'audio.flac'], inflateRaw);
      data = Object.values(e)[0] ?? null;
    } else if (b[0] === 0x53 && b[1] === 0x53 && b[2] === 0x2b && b[3] === 0x6d) {
      const r = new BinaryReader(b);
      r.skip(4);
      const version = r.u16();
      if (version === 1) {
        r.skip(2); r.line(); r.line(); r.line(); r.skip(9);
        const coverType = r.u8();
        if (coverType === 1) { r.skip(6); r.skip(r.u64()); } else if (coverType === 2) r.skip(r.u64());
        if (r.u8() === 1) data = r.bytesN(r.u64());
      } else if (version === 2) {
        r.skip(4 + 20 + 12 + 1 + 2);
        const hasAudio = r.bool();
        r.skip(2 + 16);
        const offset = r.u64(), length = r.u64();
        if (hasAudio && length > 0) data = r.seek(offset).bytesN(length);
      }
    }
  } catch { return null; }
  if (!data || data.length < 16) return null;
  const m = (...sig) => sig.every((v, i) => data[i] === v);
  const type = m(0x49, 0x44, 0x33) || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0) ? 'mp3' : m(0x4f, 0x67, 0x67, 0x53) ? 'ogg' : m(0x52, 0x49, 0x46, 0x46) ? 'wav' : m(0x66, 0x4c, 0x61, 0x43) ? 'flac' : null;
  return type ? { bytes: data, type, mime: { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac' }[type] } : null;
}

/** Detects the format from magic bytes. */
export async function parseMap(bytes, inflateRaw) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0x53 && b[1] === 0x53 && b[2] === 0x2b && b[3] === 0x6d) return parseSSPM(b);
  if (b[0] === 0x50 && b[1] === 0x4b) return parsePHXM(b, inflateRaw);
  throw new Error('unrecognised map format (expected .sspm or .phxm)');
}

/**
 * Format-independent map identity. The same chart imported from .sspm or .phxm hashes the same,
 * while any change to a note's time or position changes the hash (so edited maps can't inherit
 * a ranked map's leaderboard). Layout: "rhythia-notes-v1\0", then per note int32 ms, f32 x, f32 y (LE).
 */
export async function noteHash(notes) {
  const prefix = new TextEncoder().encode('rhythia-notes-v1\0');
  const buf = new Uint8Array(prefix.length + notes.length * 12);
  buf.set(prefix, 0);
  const v = new DataView(buf.buffer);
  let o = prefix.length;
  for (const n of canonicalOrder(notes)) {
    v.setInt32(o, n.ms, true);
    v.setFloat32(o + 4, n.x, true);
    v.setFloat32(o + 8, n.y, true);
    o += 12;
  }
  return toHex(await sha256(buf));
}
