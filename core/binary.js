// Little-endian binary reader shared by the map and replay parsers.
// Works on a Uint8Array in both Node and the browser (no Buffer dependency).

const utf8 = new TextDecoder('utf-8');

export class BinaryReader {
  constructor(bytes) {
    this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    this.pos = 0;
  }

  get length() { return this.bytes.byteLength; }
  get remaining() { return this.bytes.byteLength - this.pos; }

  ensure(n) {
    if (n < 0 || this.pos + n > this.bytes.byteLength) {
      throw new RangeError(`read of ${n} bytes at ${this.pos} overruns ${this.bytes.byteLength}-byte buffer`);
    }
  }

  seek(pos) { this.pos = pos; return this; }
  skip(n) { this.ensure(n); this.pos += n; return this; }

  u8() { this.ensure(1); return this.view.getUint8(this.pos++); }
  bool() { return this.u8() !== 0; }
  u16() { this.ensure(2); const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  u32() { this.ensure(4); const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  i32() { this.ensure(4); const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  f32() { this.ensure(4); const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
  f64() { this.ensure(8); const v = this.view.getFloat64(this.pos, true); this.pos += 8; return v; }

  // 64-bit counts/offsets in these formats never exceed 2^53 in practice.
  u64() {
    this.ensure(8);
    const lo = this.view.getUint32(this.pos, true);
    const hi = this.view.getUint32(this.pos + 4, true);
    this.pos += 8;
    const v = hi * 0x100000000 + lo;
    if (!Number.isSafeInteger(v)) throw new RangeError(`u64 ${v} at ${this.pos - 8} is not a safe integer`);
    return v;
  }

  bytesN(n) { this.ensure(n); const b = this.bytes.subarray(this.pos, this.pos + n); this.pos += n; return b; }
  str(n) { return utf8.decode(this.bytesN(n)); }

  // Godot's File.get_line(): bytes up to (not including) '\n'.
  line() {
    const start = this.pos;
    while (this.pos < this.bytes.byteLength && this.bytes[this.pos] !== 0x0a) this.pos++;
    const s = utf8.decode(this.bytes.subarray(start, this.pos));
    if (this.pos < this.bytes.byteLength) this.pos++; // consume '\n'
    return s.replace(/\r$/, '');
  }
}

export function toHex(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += b.toString(16).padStart(2, '0');
  return s;
}

export async function sha256(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
}
