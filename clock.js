// The replay viewer's clocks and cursor path, kept apart from the page so they are the same code in the browser and in the tests. No page code in here.

/**
 * Frame time (the replay's own clock) and song time, from the replay data's `songClock`: parts of [frame time the part starts at, song time then, rate]
 * (rate 0: paused). Song time at frame time t is ms + (t - rt) * rate of the last part that started at or before t.
 */
export function songClock(parts) {
  const segs = parts?.length ? parts : [[0, 0, 1]];
  const segAt = t => { let k = 0; while (k + 1 < segs.length && segs[k + 1][0] <= t) k++; return segs[k]; };
  return {
    segAt,
    songMs: t => { const [rt, ms, r] = segAt(t); return ms + (t - rt) * r; },
    /** The frame time that has song time `song`, searching from the part `near` is in (while paused there is no such time: `near`). */
    frameFromSong: (song, near) => { const [rt, ms, r] = segAt(near); return r ? rt + (song - ms) / r : near; },
  };
}

/**
 * Audio offset: how long the sound takes to reach the ears after the song element says it is there (a phone's speaker, Bluetooth earbuds), in real
 * milliseconds; the same for any song and any playing speed, so a person sets it once. Positive: the sound is late, so the music is played that much earlier.
 *
 * Where the song element should read while the picture shows song time `song` (`playbackRate`: song time per real time, the play's speed times the viewer's).
 */
export const audioTarget = (song, offsetMs, playbackRate) => song + offsetMs * playbackRate;

/** How far ahead of the picture (in the replay's own clock) a hit sound is started, so it is heard with the picture and the music: `rate` is frame time per real time at speed 1. */
export const soundLead = (offsetMs, rate, speed) => offsetMs * rate * speed;

/** "+120 ms", "−40 ms", "0 ms". */
export const offsetText = ms => (ms === 0 ? '0 ms' : `${ms > 0 ? '+' : '\u2212'}${Math.abs(ms)} ms`);

/**
 * The cursor at a frame time, from the recorded frames ({ t, x, y }: arrays, in time order): the recorded position at a frame, and the straight line between
 * two frames in between. Nothing else is done to a position: it is not snapped, rounded or kept inside the grid. Before the first frame and after the last
 * it stays where that frame is.
 */
export function cursorPath(frames) {
  const n = frames.t.length;
  const frameIndex = t => { let lo = 0, hi = n - 1; if (t <= frames.t[0]) return 0; if (t >= frames.t[hi]) return hi; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (frames.t[m] <= t) lo = m; else hi = m; } return lo; };
  return t => {
    const i = frameIndex(t), j = Math.min(n - 1, i + 1), dt = frames.t[j] - frames.t[i], u = dt > 0 ? Math.min(1, Math.max(0, (t - frames.t[i]) / dt)) : 0;
    return [frames.x[i] + (frames.x[j] - frames.x[i]) * u, frames.y[i] + (frames.y[j] - frames.y[i]) * u];
  };
}
