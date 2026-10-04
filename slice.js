// The replay viewer's song player. It is an audio element, except for one kind of song: an MP3 whose frames differ in size (variable bitrate) that is not made
// into a WAV (a phone has too little memory for that, and a song may be too big or too long). A browser seeks in such a file by estimating where the time is
// and lands up to half a second off, once when the viewer starts the song and again after every skip, pause and drag of the timeline, and then plays out of step
// with the notes. So instead of asking the element to seek, this cuts the file at the frame just before the time wanted (three frames before: the first frames
// after a cut can lack data from before it) and plays the cut from its start, seeking only the last 80 to 100 ms into it, where an estimate cannot be far wrong.
// Measured in a browser with the worst case (variable bitrate, no table of contents): within 2 to 13 ms of where playing the whole file puts the sound, against
// 170 to 520 ms for an ordinary seek. Nothing is decoded, so there is no memory cost and any size of song works.
// Where a cut cannot be played (the browser says so, or does not answer in time), the song goes on as the whole file with ordinary seeks.
import { mp3Frames } from './mp3.js?v=340159337d';

const BACK_FRAMES = 3, CUT_TIMEOUT_MS = 4000;

export class SongAudio {
  constructor(make = () => new Audio()) {
    this.el = make();
    this.frames = null; this.bytes = null; this.whole = null;   // set by load() for a song that is cut: its frames, its bytes, the address of the whole file
    this.base = 0;        // the song time (seconds) the playing cut starts at
    this.target = null;   // while a cut is being made ready: the song time asked for
    this.want = false;    // play() was called and pause() was not
    this.cut = null;      // the address of the cut that is playing (given back when the next one replaces it)
    this.seq = 0;         // which cut is the latest: a cut that was replaced before it was ready is dropped
    this.ready = Promise.resolve();
  }

  /** Loads a song from an address. `cut`: the file itself (a Blob), a variable-bitrate MP3 to be played by cutting (see above). */
  async load(url, { cut = null } = {}) {
    this.dropCut();
    this.frames = this.bytes = this.whole = null; this.target = null; this.want = false; this.base = 0; this.seq++;
    if (cut) {
      try {
        const bytes = new Uint8Array(await cut.arrayBuffer()), frames = mp3Frames(bytes);
        if (frames.count > 10) { this.bytes = bytes; this.frames = frames; this.whole = url; }
      } catch { /* the song is played as it is */ }
    }
    this.el.src = url;
  }

  get cutting() { return !!this.frames; }
  get src() { return this.el.src; }
  get paused() { return this.cutting ? !this.want : this.el.paused; }
  get duration() { return this.cutting ? this.frames.seconds : this.el.duration; }
  get currentTime() { return this.cutting ? (this.target === null ? this.base + this.el.currentTime : this.target) : this.el.currentTime; }
  /** A cut is being made ready (30 to 100 ms): the song is where it was asked for, and the viewer holds the picture there until the sound can follow. */
  get pending() { return this.cutting && this.target !== null; }
  set currentTime(t) { if (this.cutting) this.seekTo(t); else this.el.currentTime = t; }
  get playbackRate() { return this.el.playbackRate; }
  set playbackRate(v) { this.el.playbackRate = v; }
  get volume() { return this.el.volume; }
  set volume(v) { this.el.volume = v; }
  get muted() { return this.el.muted; }
  set muted(v) { this.el.muted = v; }
  set preservesPitch(v) { this.el.preservesPitch = v; }
  set mozPreservesPitch(v) { this.el.mozPreservesPitch = v; }
  set webkitPreservesPitch(v) { this.el.webkitPreservesPitch = v; }
  addEventListener(...args) { return this.el.addEventListener(...args); }

  play() {
    if (!this.cutting) return this.el.play();
    this.want = true;
    return this.target === null ? this.el.play() : this.ready.then(() => (this.want ? this.el.play() : undefined));   // (a cut still being made plays when it is ready)
  }

  pause() { this.want = false; this.el.pause(); }

  removeAttribute(name) { if (name === 'src') { this.dropCut(); this.frames = this.bytes = this.whole = null; this.seq++; } this.el.removeAttribute(name); }

  dropCut() { if (this.cut) { URL.revokeObjectURL(this.cut); this.cut = null; } }

  /** Starts the song from `t` seconds by cutting the file there. */
  seekTo(t) {
    const { time, at, count } = this.frames, wanted = Math.max(0, Math.min(t, this.frames.seconds));
    let lo = 0, hi = count - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (time[m] <= wanted) lo = m; else hi = m - 1; }
    const k = Math.max(0, lo - BACK_FRAMES), seq = ++this.seq;
    this.base = time[k]; this.target = wanted;
    const old = this.cut, el = this.el;
    this.cut = URL.createObjectURL(new Blob([this.bytes.subarray(at[k])], { type: 'audio/mpeg' }));
    const give = () => { if (old) URL.revokeObjectURL(old); };
    const restart = () => { this.base = 0; this.target = null; this.frames = null; el.src = this.whole; el.currentTime = wanted; if (this.want) el.play().catch(() => {}); };   // the whole file, ordinary seek
    this.ready = new Promise(resolve => {
      const done = () => { clearTimeout(timer); el.removeEventListener('loadedmetadata', loaded); el.removeEventListener('error', failed); };
      const finish = () => { if (seq === this.seq) this.target = null; resolve(); };
      const loaded = () => {
        done(); give();
        if (seq !== this.seq) return resolve();
        const inside = wanted - this.base;   // (a few frames: a seek that short cannot be far off)
        if (inside > 0.001) {
          const settle = () => { clearTimeout(guard); el.removeEventListener('seeked', settle); finish(); };
          const guard = setTimeout(settle, 1500);   // (a browser that never says it has seeked does not hold the song for ever)
          el.addEventListener('seeked', settle);
          el.currentTime = inside;
        } else finish();
      };
      const failed = () => { done(); give(); if (seq === this.seq) restart(); resolve(); };
      const timer = setTimeout(failed, CUT_TIMEOUT_MS);
      el.addEventListener('loadedmetadata', loaded, { once: true });
      el.addEventListener('error', failed, { once: true });
    });
    // `target` stays until the cut is ready and has seeked: the song is said to be where it was asked for, not where the cut starts, and the viewer waits (`pending`).
    // A cut that was replaced before it was ready is dropped. When it is ready and the viewer is playing, it plays.
    this.ready.then(() => { if (seq === this.seq && this.want && this.frames) return el.play().catch(() => {}); });
    el.src = this.cut;
  }
}
