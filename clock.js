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

/** The lead-in of Clean view: play time before the first note (the ordinary start of the viewer gives the same). */
export const CLEAN_LEAD_MS = 1500;

/**
 * Where Clean view (for recording) starts playing: `leadMs` of play time before the first note (`rate`: the replay's clock per play time), instead of the replay's own
 * start, which is up to 2.5 s before it. Never before the replay's own `start` and never after the first note. Only where playback starts: the clock, the notes, the
 * cursor and the song keep their real times, so nothing about the play is changed.
 */
export const cleanStart = (start, firstNote, rate, leadMs = CLEAN_LEAD_MS) => (Number.isFinite(firstNote) ? Math.max(start, firstNote - leadMs * rate) : start);

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

/** How far the recorded cursor gets from the grid's middle on the horizontal axis, in grid units (the game keeps it within about 1.37): the camera's drift, and so the zoom a tall view can take, comes from it. */
export function cursorReach(frames) {
  let reach = 0;
  for (const x of frames.x) if (Number.isFinite(x) && Math.abs(x) > reach) reach = Math.abs(x);
  return reach;
}

/**
 * Where the replay HUD's right column (the combo ring and the numbers under it) goes, so it stays whole inside the viewer: it is centred on `nominal`, a column
 * `2 * half` wide, with `left` (the grid's edge, which it prefers not to run into) and `right` (the viewer's edge, less the margin the left column keeps) as the room it has.
 * With room it is where it was; with less room to the right it moves left the least that fits; with less room than its width it is centred in the room and shrunk to it
 * (`k`, of its size); and where the room is too small to read it in (a big grid on a phone: less than `kMin` of the column), it is kept at `kMin` of its size against the
 * right edge, over the grid's outer edge: never cut off. Returns { cx, k }.
 */
export function fitColumn(nominal, half, left, right, kMin = 0.6) {
  const room = right - left;
  if (2 * half <= room) return { cx: Math.min(Math.max(nominal, left + half), right - half), k: 1 };
  if (room >= 2 * half * kMin) return { cx: (left + right) / 2, k: room / (2 * half) };
  return { cx: right - half * kMin, k: kMin };
}

/**
 * The room the viewer gives the HUD's right column (see fitColumn): `gridRight` is the grid's right edge and `reach` how far the camera carries the grid beyond it, `u`
 * the HUD's unit, `W` the viewer's width and `half` half the column's widest width. It sits 22 units right of the grid and its reach; its room starts 3 units right of them
 * and ends 3% of the width short of the viewer's edge (the margin the left column keeps).
 */
export const hudColumnFit = (gridRight, reach, u, W, half) => fitColumn(gridRight + reach + u * 22, half, gridRight + reach + u * 3, W - W * 0.03);

/** How far the camera sits behind the grid, in grid units (the game's own number; the viewer and portraitZoom frame the play with it). */
export const CAM_Z = 3.75;

/**
 * How much closer the camera frames the play in a TALL view (Clean view, a phone filling its window). The camera frames the grid by the view's width (at the game's field of view it is 57 to 63% of it),
 * which in a tall frame leaves room at both sides, so the play is drawn small. The factor is the largest one whose grid border stays clear of the frame's edge wherever the camera's drift can carry it: the grid's
 * half width is 1.5 units (`gridScale` of them for HardRock's bigger grid) and the camera follows the cursor by `driftUnits` at the furthest (the replay's own cursor path times the follow strength);
 * so the border at its furthest is (1.5 x gridScale + driftUnits) x `unit` pixels from the middle, and the factor is the room over that (half the width, less PORTRAIT_EDGE of the width and the stroke's
 * own half width, so the whole border is in the frame and never cut by its edge), never more than PORTRAIT_MAX.
 *
 * Only tall views get it: exactly 1 up to a height of PORTRAIT_FROM times the width (the phone's ordinary page is 1.25 and landscape views are under 1, so they stay as they are), growing along a
 * smoothstep to the whole factor at PORTRAIT_FULL (a window resized or a phone turned across that range moves the grid smoothly, never in a jump). A HardRock grid (`gridScale` over 1) is already
 * wider and gets 1, and so does anything that is not a usable number (the field of view is checked BEFORE the tangent is taken).
 *
 * `sameAt(z)`: whether the HUD takes the same places at zoom z as at 1 (see numbersLinePlace and leftPlace). The factor steps down by PORTRAIT_STEP until it does, so no view loses the row above the
 * grid or the line below it to the zoom; 1 where none does.
 */
export const PORTRAIT_FROM = 1.4, PORTRAIT_FULL = 1.6, PORTRAIT_MAX = 1.4, PORTRAIT_STEP = 0.02, PORTRAIT_EDGE = 0.01;
/** The grid border's stroke, as a share of the grid's scale (at least 1 px): the viewer draws it with `Math.max(1, gs * GRID_LINE)`. */
export const GRID_LINE = 0.012;
export function portraitZoom({ W, H, fovDeg, gridScale = 1, driftUnits = 0, sameAt = () => true }) {
  if (!(W > 0 && H > 0 && fovDeg > 0 && fovDeg < 179 && gridScale > 0 && driftUnits >= 0)) return 1;   // (a number that is not one fails every comparison)
  if (gridScale > 1) return 1;
  const ratio = H / W;
  if (!(ratio > PORTRAIT_FROM)) return 1;
  const t = Math.min(1, (ratio - PORTRAIT_FROM) / (PORTRAIT_FULL - PORTRAIT_FROM)), ramp = t * t * (3 - 2 * t);
  const unit = W / 2 / Math.tan((fovDeg * Math.PI) / 360) / CAM_Z;   // one grid unit in pixels, at rest
  // The whole border, stroke included, stays PORTRAIT_EDGE of the width clear of the frame's edge (a border on the edge itself is half cut off, and the game's grid never is): the stroke's half is
  // GRID_LINE / 2 of the scale, and at least half a pixel, so the room has to hold both of those forms.
  const edge = PORTRAIT_EDGE * W, reach = 1.5 * gridScale + driftUnits;
  const whole = Math.min(PORTRAIT_MAX, (W / 2 - edge - 0.5) / (unit * reach), (W / 2 - edge) / (unit * (reach + GRID_LINE / 2)));
  if (!(whole > 1)) return 1;
  for (let z = 1 + (whole - 1) * ramp; z > 1 + 1e-9; z -= PORTRAIT_STEP) if (sameAt(z)) return z;
  return 1;
}

/**
 * The PP the HUD and the board show for a play: the rounded number with "pp", and an en dash while the play has not earned a whole point yet. The heading font draws a zero like a
 * capital O, so "0pp" read as the word "Opp" at the start of every replay (and "140pp" as "14Opp"); from 1pp on the text is what it always was. `grouped`: thousands with a comma
 * (the board does; the HUD's own figure has never), so each place keeps what it printed.
 */
export const ppLabel = (pp, grouped = true) => {
  const whole = Math.round(pp);
  return !(whole >= 1) ? '\u2013' : `${grouped ? whole.toLocaleString('en-US') : whole}pp`;   // (also for a PP that is not a number)
};

/**
 * Where the HUD's combo, misses and PP go: in ONE line, under the grid ('below') or, when the stack under it leaves no room for both the line and the board, above it ('above'),
 * or, where a very small viewer has room for the line only, under the grid with the board left to hide itself, or in the column beside the grid as they always were (null). They go in a line where the column is shrunk (`ck` under 1: a phone has no room beside the grid, and shrunk the
 * three numbers come out 3 to 5 CSS px tall) and on a portrait view (a phone, and the vertical recording of Clean view), where the HUD is small whatever the column's room; a
 * landscape view with room is as it always was. `stackEnd` is where the progress bar, the health bar and the tags end, `lineSize` the line's text size and `boardRoom` what the
 * board needs under the line (0 where there is none); the line is about one and three quarters of its size tall. Above the grid it needs the space between the title (ending at
 * `titleEnd`) and the grid's top (`gridTop`). `W`, `H`: the viewer's size.
 */
export function numbersLinePlace(ck, W, H, { stackEnd, lineSize, boardRoom = 0, gridTop, titleEnd }) {
  if (!(ck < 1 || H > W)) return null;
  if (stackEnd + lineSize * 1.75 + boardRoom <= H * 0.985) return 'below';
  if (gridTop - lineSize * 1.45 >= titleEnd) return 'above';
  return stackEnd + lineSize * 1.75 <= H * 0.985 ? 'below' : null;   // (a very small viewer: the numbers first, and the board under them hides itself when it has no room for a row)
}

/** The three pieces of that line, in order ("6 combo", "1 miss", "2pp"); the PP is left out where the replay has no PP curve (`ppText` null), and an unranked play's says "if ranked". */
export const numbersLineParts = (combo, misses, ppText, unranked) => [`${combo} combo`, `${misses} miss${misses === 1 ? '' : 'es'}`, ...(ppText === null ? [] : [unranked ? `${ppText} if ranked` : ppText])];

/**
 * Where the HUD's left column (the grade, the accuracy and the hits) goes where the numbers on the right go in a line (see numbersLinePlace: a portrait view, or a shrunk column): in ONE
 * row above the grid ('above'), or null where they stay beside it (a landscape view with room, and a viewer too small to have a row's height between the title and the grid).
 * `rowBottom` is where the row's text sits (above the grid, clear of what the camera's drift can reach and of the numbers line when that is above the grid too), `rowHeight` how tall the
 * row is (its grade letter), `titleEnd` where the player's name above ends.
 */
export function leftRowPlace(ck, W, H, { rowBottom, rowHeight, titleEnd }) {
  if (!(ck < 1 || H > W)) return null;
  return rowBottom - rowHeight >= titleEnd ? 'above' : null;
}

/**
 * Where the HUD's left column is drawn, given where the numbers line (`linePlace`, see numbersLinePlace) and the row above the grid (`rowPlace`, see leftRowPlace) went: 'row' above the grid where it
 * fits; else 'line' where the numbers go in a line (a phone's normal page: the grid leaves no room for the row, and the column beside it would be 4 to 9 px): the grade and the accuracy lead the line
 * (the hits are left out, the accuracy carries them); else 'column' beside the grid, as it always was (a desktop).
 */
export const leftPlace = (linePlace, rowPlace) => (rowPlace !== null ? 'row' : linePlace !== null ? 'line' : 'column');

/**
 * How much bigger than its usual size (the HUD unit's 5.2) the play's chips under the health bar ("87% speed", the mods) are drawn: where the numbers are in a line (a portrait or shrunk view) their
 * text takes the 12 CSS px floor (`dpr`: device pixels per CSS px), or 11 or 10 where the stack under the grid would no longer be laid out as it is (`fits(k)`: the numbers line and the board
 * keep the place they have with the usual chips), and stays as it was (1) where it is already that big or no size fits.
 */
export function chipScale(u, dpr, fits) {
  for (const px of [12, 11, 10]) {
    const k = px * dpr / (u * 5.2);
    if (k <= 1) return 1;
    if (fits(k)) return k;
  }
  return 1;
}

/** The viewer's speed chip under the progress bar: "87% speed" for a Nightly button too ("< 87%" reads as "under 87%" to anyone who does not know the game's arrows), "75% speed" for a custom speed; nothing at normal speed. `info`: speedInfo's answer. */
export const speedChip = info => (info.normal ? '' : `${info.preset ? info.short : info.percent} speed`);

/**
 * The end card (the viewer's closing frame, for a recording to finish on): it comes about a second of play after the last judged note (`lastJudgedT`, in the replay's own clock; `rate`: its
 * clock units per real millisecond), never after the replay's end, and not at all where no note was judged. After it came it fades in over END_CARD_FADE_MS, holds END_CARD_HOLD_MS, and in
 * Clean view that is where the view ends by itself (endCardPhase says so). Outside Clean view the card stays until the player seeks back or plays again.
 */
export const END_CARD_AFTER_MS = 1000, END_CARD_FADE_MS = 450, END_CARD_HOLD_MS = 4000;
export const endCardAt = (lastJudgedT, end, rate) => (end > lastJudgedT ? Math.min(end, lastJudgedT + END_CARD_AFTER_MS * rate) : null);   // (a comparison with no judged note, undefined or not a number, is false)
/** What the card is `ms` (real) after it came: how visible (0 to 1, eased) and whether Clean view is over (`clean`: it is on, and the card has held). */
export function endCardPhase(ms, clean) {
  const q = Math.min(1, Math.max(0, ms / END_CARD_FADE_MS));
  return { alpha: 1 - (1 - q) ** 3, leave: clean && ms >= END_CARD_FADE_MS + END_CARD_HOLD_MS };
}
/** The card's line under the PP: "99.39% · 5 misses · 5.58★" (the stars are left out where the play has none). */
export const endCardLine = (acc, misses, stars) => [acc === 1 ? '100%' : `${(acc * 100).toFixed(2)}%`, `${misses} miss${misses === 1 ? '' : 'es'}`, ...(stars > 0 ? [`${stars.toFixed(2)}★`] : [])].join(' · ');
