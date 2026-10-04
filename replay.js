// Replay viewer that looks, moves and sounds like Sound Space Plus. Loaded on demand by app.js for #/replay/<id>.
//
// Everything is taken from the game (github.com/David20122/sound-space-plus, MIT): notes are square frames 0.9 units
// wide with a 15% fill, spawned at the player's spawn distance and flying in at their approach rate, fading in over
// the first part of the trip; the camera sits 3.75 units behind the grid (70° field of view) and drifts with the
// cursor by the player's parallax; the grid is a thin border with dashed dividers; hits ripple at the cursor in the
// note's colour and misses leave an X; the HUD shows the game's letter grade and colours, accuracy to 3 decimals and
// the 1x-8x combo multiplier. The player's own settings come with the replay, so you see what they saw.
import { parseMap, noteHash, extractAudio } from './core/maps.js?v=8e44042818';   // only the map reader: the public site ships no rating code
import { speedInfo } from './speed.js?v=53b4278b15';
import { sheetLinkOf, readCapped, SHEET_MAX, prepareSong } from './songs.js?v=7ce5e0ef05';
import { SongAudio } from './slice.js?v=78c7921f0b';
import { currentUser } from './me.js?v=a79932f474';
import { discordKey } from './keys.js?v=9c69f5e339';
import { songClock, cursorPath, audioTarget, soundLead, offsetText } from './clock.js?v=def94f7b17';

const COLOR_SETS = {
  'Cotton Candy': ['#00ffed', '#ff8ff9'], 'Red & Blue': ['#fc4441', '#4151fc'], 'Pastel': ['#5BCEFA', '#F5A9B8', '#FFFFFF'],
  'Veggie Straws': ['#ffcc4d', '#ff7892', '#e5dd80'], 'Everybody Votes': ['#fc94f2', '#96fc94'],
  'Hue Wheel': ['#e95f5f', '#e88d5f', '#e8ba5f', '#e8e85f', '#bae85f', '#8de85f', '#5fe85f', '#5fe88d', '#5fe8ba', '#5fe8e8', '#5fbae8', '#5f8de8', '#5f5fe8', '#8d5fe8', '#ba5fe8', '#e85fe8', '#e85fa4', '#e85f8d'],
};
const GRADES = [[1, 'SS'], [0.98, 'S', '#91fffa'], [0.95, 'A', '#91ff92'], [0.9, 'B', '#e7ffc0'], [0.85, 'C', '#fcf7b3'], [0.8, 'D', '#fcd0b3'], [0, 'F', '#ff8282']];
const CAM_Z = 3.75, NOTE_HALF = 0.45, NOTE_INNER = 0.36, CURSOR_R = 0.13125, PUSHBACK = 0.1;
const RIPPLE_MS = 200, MISS_MS = 420, TRAIL_MS = 150, TRAIL_STEPS = 150;
/** A .sspm file's note count from its header, reading only its first kilobyte (v1: three text lines, then length and count). */
async function sspmNoteCount(file) {
  const b = new Uint8Array(await file.slice(0, 1024).arrayBuffer()), dv = new DataView(b.buffer);
  if (b[0] !== 0x53 || b[1] !== 0x53 || b[2] !== 0x2b || b[3] !== 0x6d) return -1;
  const version = dv.getUint16(4, true);
  if (version === 2) return dv.getUint32(34, true);   // signature, version, 4 reserved, 20-byte hash, length, then the count
  if (version !== 1) return -1;
  let at = 8;
  for (let line = 0; line < 3; line++) { at = b.indexOf(0x0a, at) + 1; if (!at) return -1; }
  return at + 8 <= b.length ? dv.getUint32(at + 4, true) : -1;
}
const inflateRaw = async bytes => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
const store = { get: (k, d) => { try { const v = localStorage.getItem(`rpp-viewer-${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(`rpp-viewer-${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } } };
export async function mount(app, id, h) {
  const v = await h.api(`/api/scores/${id}/replay`);
  const { notes, frames, rate, view } = v;
  const n = frames.t.length;
  // What this browser remembers is only used when it is a value the viewer could have saved: anything else (a hand-edited or damaged value) is the default.
  const saved = (key, fallback, valid) => { const value = store.get(key, fallback); return valid(value) ? value : fallback; };
  const isBool = value => typeof value === 'boolean';
  const opt = {
    colors: saved('colors', 'Cotton Candy', value => typeof value === 'string' && Object.hasOwn(COLOR_SETS, value)),
    trail: saved('trail', true, isBool), follow: saved('follow', true, isBool), hitsounds: saved('hitsounds', true, isBool),
    volume: saved('volume', 0.6, value => typeof value === 'number' && value >= 0 && value <= 1),
    audioOffset: saved('audioOffset', 0, value => Number.isInteger(value) && Math.abs(value) <= 300),
    fps: saved('fps', false, isBool), grid: saved('grid', true, isBool), board: saved('board', true, isBool), intro: saved('intro', true, isBool),
  };

  // ---------- judgements, in time order, with the game's combo multiplier (1x-8x: +1 level per 10 hits, -1 per miss) ----------
  const judged = notes.map((note, i) => ({ i, t: note.t + (note.r === -1 ? v.windowMs : Math.min(Math.max(note.r ?? 0, 0), v.windowMs)), hit: note.r !== null && note.r !== -1, seen: note.r !== null }))
    .filter(j => j.seen).sort((a, b) => a.t - b.t);
  // Health follows the game's rules (Runner.updateHealth): a hit heals a little, a miss costs more, and misses in a row
  // cost more each time, while hits in a row bring that back down.
  let hits = 0, combo = 0, level = 1, progress = 0, health = 100, step = 15;
  for (const j of judged) {
    if (j.hit) { hits++; combo++; if (level !== 8) { progress++; if (progress === 10) { progress = 0; level++; if (level === 8) progress = 10; } } }
    else { combo = 0; progress = 0; if (level !== 1) level--; }
    if (j.hit) { step = Math.max(step / 1.45, 15); health = Math.min(100, health + step / 1.75); }
    else { health = Math.max(0, health - step); step = Math.min(step * 1.2, 100); }
    Object.assign(j, { hits, combo, level, progress, health });
  }
  const judgeT = new Map(judged.map(j => [j.i, j.t]));

  // ---------- clocks: frame time (the replay's clock) -> song time ----------
  const { segAt, songMs, frameFromSong } = songClock(v.songClock);
  const start = Math.max(frames.t[0], (notes[0]?.t ?? frames.t[0]) - 2500 * rate);
  const end = Math.min(frames.t[n - 1], (notes.at(-1)?.t ?? frames.t[n - 1]) + 1500 * rate);
  const span = Math.max(1, end - start);
  let now = start, playing = false, speed = 1, last = 0, raf = 0, fps = 0;

  const sp = speedInfo(v.speed, v.format);   // the play's speed as its game says it
  // Staff tools (the player intro and Clean view, for recording) show only for the developer, logged in with Discord.
  // The site is static, so this hides them rather than locking them.
  let staff = false;
  // Speed and mods as the play's game names them, from the replay itself. Ones that raised its PP are tinted.
  const MOD_NAMES = { HardRock: 'Hard Rock', SuddenDeath: 'Sudden Death', NoRegen: 'No Regen', InvertMouse: 'Invert Mouse', ExtraEnergy: 'Extra Energy',
    NoFail: 'No Fail', ...(v.format === 'sspre' ? { HFlip: 'Mirror X', VFlip: 'Mirror Y' } : {}) };
  const playTags = [...(sp.normal ? [] : [{ text: sp.text, boost: v.speed > 1 }]), ...v.mods.map(m => ({ text: MOD_NAMES[m] ?? m, boost: (v.boostMods ?? []).includes(m) }))];
  const gridScale = v.layout?.scale ?? 1;
  const flagHtml = v.flags.length ? `<p class="eyebrow" style="margin-top:18px">Flagged for review</p><ul class="reasons">${v.flags.map(f => `<li>${h.esc(f)}</li>`).join('')}</ul>` : '';
  app.innerHTML = `
    <p class="eyebrow">Replay</p>
    <h1>${h.esc(v.title)}</h1>
    <p class="sub"><a href="#/player/${encodeURIComponent(v.player)}">${h.esc(v.player)}</a> · ${h.esc(v.artist)} · ${h.stars(v.stars)} ${h.grade(v.accuracy, false, v)} ${h.pct(v.accuracy)}${v.status !== 'verified' ? ` · <span class="pill ${h.esc(v.status)}">${h.esc(v.status)}</span>` : v.ranked === false ? ` · <span class="unr">UNRANKED MAP</span> <span class="muted">${h.pp(v.pp)} if ranked</span>` : ` · <b>${h.pp(v.pp)}</b>`}${sp.normal ? '' : ` · <span title="${h.esc(sp.title)}">${h.esc(sp.text)}</span>`}${v.mods.length ? ` · ${v.mods.map(h.esc).join(', ')}` : ''}</p>
    <div class="game">
      <div class="stage wide" id="stage">
        <canvas id="cv" aria-label="Replay playback"></canvas>
        <button class="bigplay" id="bigplay" aria-label="Play">▶</button>
        <button class="exit-fill" id="exit-fill" aria-label="Leave full screen" title="Leave full screen">✕</button>
      </div>
      <div class="controls">
        <button id="play" aria-label="Play">▶</button>
        <div class="time" id="clock">0:00 / 0:00</div>
        <div class="timeline" id="tl" role="slider" tabindex="0" aria-label="Position in the replay" aria-valuemin="0" aria-valuemax="100">
          <div class="track"></div><div class="fill" id="fill"></div>
          ${judged.filter(j => !j.hit).map(j => `<div class="mark" style="left:${((j.t - start) / span) * 100}%" title="miss"></div>`).join('')}
          ${(v.pauses ?? []).map(t => `<div class="mark pause" style="left:${((t - start) / span) * 100}%" title="pause"></div>`).join('')}
          <div class="knob" id="knob"></div>
        </div>
        <div class="seg" id="spd">${[0.25, 0.5, 1, 2].map(s => `<button data-v="${s}"${s === 1 ? ' class="on"' : ''}>${s}×</button>`).join('')}</div>
        <button class="ghost" id="fs" aria-label="Full screen" title="Full screen">⛶</button>
        <button class="ghost small" id="clean" hidden title="Staff: full screen from the start with the player intro, no controls or mouse pointer (Esc leaves)">Clean view</button>
      </div>
      <div class="viewer-row">
        <section class="card pad">
          <p class="eyebrow">Song</p>
          <div id="song"><span class="muted">Looking for the song…</span></div>
          <p class="eyebrow" style="margin-top:18px">View</p>
          <div class="toggles">
            <label><input type="checkbox" id="o-follow"${opt.follow ? ' checked' : ''}> Camera follows the cursor</label>
            <label><input type="checkbox" id="o-trail"${opt.trail ? ' checked' : ''}> Cursor trail</label>
            <label><input type="checkbox" id="o-grid"${opt.grid ? ' checked' : ''}> 3×3 grid</label>
            <label><input type="checkbox" id="o-hits"${opt.hitsounds ? ' checked' : ''}> Hit sounds</label>
            <label><input type="checkbox" id="o-board"${opt.board ? ' checked' : ''}> Map leaderboard (L)</label>
            <label id="o-intro-row" hidden><input type="checkbox" id="o-intro"${opt.intro ? ' checked' : ''}> Player intro (staff)</label>
            <label><input type="checkbox" id="o-fps"${opt.fps ? ' checked' : ''}> Show frame rate</label>
            <label>Volume <input type="range" id="o-vol" min="0" max="1" step="0.05" value="${opt.volume}"></label>
            <label>Audio offset <input type="range" id="o-off" min="-300" max="300" step="10" value="${opt.audioOffset}" aria-describedby="o-off-help"> <output id="o-off-v">${offsetText(opt.audioOffset)}</output></label>
            <label>Notes <select id="o-colors">${Object.keys(COLOR_SETS).map(c => `<option${c === opt.colors ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
          </div>
          <p class="muted" id="o-off-help" style="font-size:12.5px;margin:8px 0 0">Audio offset: if the music sounds late (a phone's speaker or Bluetooth earbuds can delay it), move it to the right; if it sounds early, to the left. It needs the song playing with the replay (the green ♪ Song label): with no song only the hit sounds move. It is kept in this browser. <button type="button" class="ghost small" id="o-off-0" style="padding:2px 10px;font-size:12px;border-radius:8px;margin-left:4px"${opt.audioOffset === 0 ? ' hidden' : ''}>Set to 0</button></p>
          <p class="muted" style="font-size:12.5px;margin:12px 0 0">Seen with ${h.esc(v.player)}'s settings: approach rate ${h.fmt(view.approachRate, 0)}, spawn distance ${h.fmt(view.spawnDistance, 0)}, field of view ${h.fmt(view.fov, 0)}°${view.camUnlock ? ', spin' : ''}. Space plays and pauses, ← → skip 2 seconds, L shows the leaderboard.</p>
        </section>
        <section class="card pad">
          <p class="eyebrow">Watch it in the game</p>
          ${v.format === 'sspre' ? `<ol class="steps">
            ${h.replayFileUrl(v) ? `<li><a class="btn ghost small" href="${h.replayFileUrl(v)}" download>Download the replay</a></li>` : ''}
            <li>Have the map installed: <a href="#/map/${v.mapId}">${h.esc(v.title)}</a>${v.poolLink ? ` (<a href="${h.esc(v.poolLink)}" rel="noopener">download it</a>, then drag the .sspm onto the game to install it)` : ''}</li>
            <li>Open Sound Space Plus and drag the replay onto the window while the song list is showing.</li>
          </ol>
          <p class="muted" style="font-size:12.5px;margin:10px 0 0">The game plays it with its own graphics and sound. A one-click "Open in the game" button needs a small change to the game; the details are written up for its developers.</p>`
          : `<p class="muted" style="margin:0;font-size:13.5px">This replay was recorded by the newer Rhythia client (.phxr). That client can't open replay files from elsewhere yet, so it can only be watched here for now.</p>
          ${h.replayFileUrl(v) ? `<p style="margin:12px 0 0"><a class="btn ghost small" href="${h.replayFileUrl(v)}" download>Download the replay file</a></p>` : ''}`}
          ${flagHtml}
          <p class="chips" style="margin:16px 0 0"><a class="btn ghost small" href="#/map/${v.mapId}">Map leaderboard</a>${h.share(`r/${v.id}/`)}</p>
        </section>
      </div>
    </div>`;

  const $ = s => document.getElementById(s);
  (async () => {
    const me = currentUser();
    if (!me) return;
    const name = (await h.api('/api/discord-players'))[discordKey(me.id)];
    if (!name || !(await h.api(`/api/players/${encodeURIComponent(name)}`)).staff) return;
    staff = true; $('clean').hidden = false; $('o-intro-row').hidden = false;
  })().catch(() => {});
  // Opaque: every frame paints the whole canvas, so the browser needn't blend it with the page behind.
  const cv = $('cv'), ctx = cv.getContext('2d', { alpha: false }), stage = $('stage');
  let W = 0, H = 0, dpr = 1, bgFor = '';   // bgFor: the size the cached background below was painted at
  let isFull = () => false;   // (whether the stage is full screen, by the browser or by filling the window: set below, where the buttons are)
  const resize = () => { const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.width = Math.round(r.width * dpr); H = cv.height = Math.round(r.height * dpr); bgFor = ''; };
  new ResizeObserver(resize).observe(cv);
  resize();
  document.fonts?.load('800 40px Unbounded').catch(() => {});

  // ---------- background: the map's cover, blurred, and stars streaming past ----------
  let backdrop = null;
  const cover = new Image();
  cover.onload = () => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const g = c.getContext('2d'); g.filter = 'blur(14px)';
    const s = Math.max(c.width / cover.width, c.height / cover.height);
    g.drawImage(cover, (c.width - cover.width * s) / 2 - 20, (c.height - cover.height * s) / 2 - 20, cover.width * s + 40, cover.height * s + 40);
    backdrop = c; bgFor = '';
  };
  if (h.coverUrl(v.mapId)) cover.src = h.coverUrl(v.mapId);
  // Everything in the background that doesn't move (dark fill, blurred cover, darker edges) is painted once per size
  // into its own canvas, so a frame copies one picture instead of painting the whole screen three times. That's
  // what keeps a full-screen replay at the screen's refresh rate (4 ms a frame at 240 Hz).
  const bg = document.createElement('canvas');
  const VIGNETTE_IN = 0.25, VIGNETTE_OUT = 0.9, VIGNETTE = 0.55;   // edges darken from 25% to 90% of the height out
  const paintBackground = () => {
    bg.width = W; bg.height = H;
    const g = bg.getContext('2d', { alpha: false });
    g.fillStyle = '#07060d'; g.fillRect(0, 0, W, H);
    if (backdrop) { g.globalAlpha = 0.28; const s = Math.max(W / backdrop.width, H / backdrop.height); g.drawImage(backdrop, (W - backdrop.width * s) / 2, (H - backdrop.height * s) / 2, backdrop.width * s, backdrop.height * s); g.globalAlpha = 1; }
    const vg = g.createRadialGradient(W / 2, H / 2, H * VIGNETTE_IN, W / 2, H / 2, H * VIGNETTE_OUT);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${VIGNETTE})`); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    bgFor = `${W}x${H}`;
  };
  // The stars pass over the darker edges, so they're dimmed there to match.
  const edgeDim = (x, y) => { const r = Math.hypot(x - W / 2, y - H / 2) / H; return 1 - VIGNETTE * Math.min(1, Math.max(0, (r - VIGNETTE_IN) / (VIGNETTE_OUT - VIGNETTE_IN))); };
  // The cursor's glow, blurred once per size instead of every frame.
  const glow = document.createElement('canvas');
  let glowFor = 0;
  const paintGlow = ps => {
    const r = ps * CURSOR_R, blur = ps * 0.12, half = Math.ceil(r + blur * 2 + 2);
    glow.width = glow.height = half * 2;
    const g = glow.getContext('2d');
    g.shadowColor = 'rgba(255,255,255,0.85)'; g.shadowBlur = blur;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(half, half, r, 0, Math.PI * 2); g.fill();
    glowFor = ps;
  };
  const stars = Array.from({ length: 200 }, (_, i) => { const a = (i * 2.399) % (Math.PI * 2), rr = 2.2 + ((i * 7919) % 97) / 97 * 9; return { x: Math.cos(a) * rr, y: Math.sin(a) * rr * 0.62, z: ((i * 104729) % 1000) / 1000 }; });

  // ---------- cursor ----------
  const cursorAt = cursorPath(frames);
  const judgedIndex = t => { let lo = -1, hi = judged.length; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (judged[m].t <= t) lo = m; else hi = m; } return lo; };
  const noteIndex = t => { let lo = 0, hi = notes.length; while (lo < hi) { const m = (lo + hi) >> 1; if (notes[m].t < t) lo = m + 1; else hi = m; } return lo; };
  const clockText = ms => { const s = Math.max(0, ms / rate / 1000); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

  const rrect = (x, y, w, hh, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, hh, r); };
  const hex = (c, a) => { const k = parseInt(c.slice(1), 16); return `rgba(${k >> 16 & 255},${k >> 8 & 255},${k & 255},${a})`; };

  function draw() {
    const [cx, cy] = cursorAt(now);
    const k = opt.follow && !view.camUnlock ? 0.1 * view.parallax * 0.25 : 0;          // the game's half-lock camera
    const camX = cx * k, camY = cy * k;
    const fovRad = (Math.min(170, Math.max(1, view.fov)) * Math.PI) / 360;   // (an old page of the site may still carry a field of view that no screen has)
    const f = (Math.min(W, H) / 2) / Math.tan(fovRad);   // framed by the narrower side: a tall phone canvas keeps the grid's size and gains room below
    // A tall stage (a phone): the grid is framed by the width and sits near the top with the board under it. When the stage is far taller than
    // 5:4 (the viewer filling a phone's window), the grid and the board share the extra room instead of the play hugging the top.
    const cyC = H > W ? Math.min(H / 2, W / 2 + H * 0.035 + Math.max(0, H - 1.25 * W) * 0.5) : H / 2;   // on a tall canvas the grid sits just under the title, leaving the bottom for the board
    const P = (x, y, z) => { const d = CAM_Z - z; return [W / 2 + (f * (x - camX)) / d, cyC - (f * (y - camY)) / d, f / d]; };
    const palette = COLOR_SETS[opt.colors];
    const realMs = (a, b) => (a - b) / rate;       // frame-clock difference -> real milliseconds

    // background
    if (bgFor !== `${W}x${H}`) paintBackground();
    ctx.drawImage(bg, 0, 0);
    const travel = (songMs(now) / 1000) * view.approachRate * 0.35;
    for (const s of stars) {
      const z = -((s.z * 60 + travel) % 60), [sx, sy, sc] = P(s.x, s.y, z);
      const a = Math.min(1, Math.max(0, (60 + z - 25) / 25)) * 0.5 * edgeDim(sx, sy);
      if (a < 0.01) continue;
      ctx.fillStyle = `rgba(210,200,255,${a})`; ctx.fillRect(sx, sy, Math.max(1, sc * 0.025), Math.max(1, sc * 0.025));
    }

    // grid: outer border and dashed dividers (can be turned off; the side panels still line up with where it is)
    const G = 1.5 * gridScale, Q = 0.5 * gridScale;   // Nightly's HardRock draws the grid 1.35x bigger, like its notes
    const [gx0, gy0, gs] = P(-G, G, 0), [gx1, gy1] = P(G, -G, 0);
    if (opt.grid) {
      ctx.lineWidth = Math.max(1, gs * 0.012);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.strokeRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.setLineDash([gs * 0.035, gs * 0.035]);
      ctx.beginPath();
      for (const q of [-Q, Q]) { const [ax, ay] = P(q, G, 0), [bx, by] = P(q, -G, 0), [lx, ly] = P(-G, q, 0), [rx, ry] = P(G, q, 0); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); }
      ctx.stroke(); ctx.setLineDash([]);
    }

    // notes, far to near
    const ahead = (view.spawnDistance / view.approachRate) * 1000 * rate;
    const visible = [];
    for (let i = noteIndex(now - 400 * rate); i < notes.length && notes[i].t - now <= ahead; i++) {
      const note = notes[i], jt = judgeT.get(i) ?? note.t + v.windowMs;
      if (now >= jt) continue;
      const dist = (view.approachRate * realMs(note.t, now)) / 1000;
      if (dist > view.spawnDistance || dist < -PUSHBACK) continue;
      let alpha = 1;
      if (view.fadeLength > 0) { const a = view.spawnDistance, b = view.spawnDistance * (1 - view.fadeLength); alpha = a === b ? 1 : Math.min(1, Math.max(0, (dist - a) / (b - a))); }
      if (v.mods.includes('Ghost')) { const fs = (18 / 50) * view.approachRate, fe = (6 / 50) * view.approachRate; alpha = Math.min(alpha, Math.min(1, Math.max(0, (dist - fe) / (fs - fe)))); }
      visible.push({ note, i, dist, alpha });
    }
    visible.sort((a, b) => b.dist - a.dist);
    for (const { note, i, dist, alpha } of visible) {
      const [sx, sy, sc] = P(note.x, note.y, -dist), o = NOTE_HALF * sc, inr = NOTE_INNER * sc, col = palette[i % palette.length];
      ctx.globalAlpha = alpha;
      ctx.fillStyle = hex(col, 0.15); rrect(sx - inr, sy - inr, inr * 2, inr * 2, inr * 0.22); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(sx - o, sy - o, o * 2, o * 2, o * 0.3); ctx.roundRect(sx - inr, sy - inr, inr * 2, inr * 2, inr * 0.2); ctx.fill('evenodd');
    }
    ctx.globalAlpha = 1;

    // hit ripples (at the cursor, in the note's colour) and miss crosses
    for (let j = judgedIndex(now); j >= 0 && realMs(now, judged[j].t) < MISS_MS; j--) {
      const e = judged[j], age = realMs(now, e.t), col = palette[e.i % palette.length];
      if (e.hit && age < RIPPLE_MS) {
        const [hx, hy] = cursorAt(e.t), [sx, sy, sc] = P(hx, hy, 0), u = age / RIPPLE_MS;
        ctx.strokeStyle = hex(col, 1 - u); ctx.lineWidth = sc * 0.03; ctx.beginPath(); ctx.arc(sx, sy, sc * (0.2 + 0.32 * u), 0, Math.PI * 2); ctx.stroke();
      } else if (!e.hit) {
        // small and quick, so a burst of misses doesn't cover the grid
        const note = notes[e.i], [sx, sy, sc] = P(note.x, note.y, 0), u = age / MISS_MS, d = sc * 0.09;
        ctx.strokeStyle = `rgba(255,92,108,${0.85 * (1 - u) ** 1.5})`; ctx.lineWidth = sc * 0.035; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx - d, sy - d); ctx.lineTo(sx + d, sy + d); ctx.moveTo(sx + d, sy - d); ctx.lineTo(sx - d, sy + d); ctx.stroke();
      }
    }

    // cursor trail and cursor
    const [px, py, ps] = P(cx, cy, 0);
    if (opt.trail) {
      // A dense trail along the recorded path, like the game's: a dot wherever the cursor has moved a little, so fast
      // flicks draw a continuous streak instead of a few far-apart dots.
      const gap = ps * CURSOR_R * 0.3;
      let lx = null, ly = null;
      for (let s = TRAIL_STEPS; s >= 1; s--) {
        const [tx, ty] = cursorAt(now - (TRAIL_MS * rate * s) / TRAIL_STEPS), [qx, qy] = P(tx, ty, 0);
        if (lx !== null && Math.hypot(qx - lx, qy - ly) < gap) continue;
        const a = 1 - s / (TRAIL_STEPS + 1);
        ctx.fillStyle = `rgba(255,255,255,${a * 0.22})`; ctx.beginPath(); ctx.arc(qx, qy, ps * CURSOR_R * (0.4 + 0.6 * a), 0, Math.PI * 2); ctx.fill();
        lx = qx; ly = qy;
      }
    }
    if (glowFor !== ps) paintGlow(ps);
    ctx.drawImage(glow, px - glow.width / 2, py - glow.height / 2);

    const driftX = (f * camX) / CAM_Z, driftY = -(f * camY) / CAM_Z;   // how far the grid sits from its rest position this frame
    hudX += (driftX * HUD_FOLLOW - hudX) * 0.07; hudY += (driftY * HUD_FOLLOW - hudY) * 0.07;
    hudLagX = driftX - hudX; hudLagY = driftY - hudY;
    drawHud(gx0, gy0, gx1, gy1, gs);
    if (opt.fps && fps) {
      ctx.textAlign = 'right'; ctx.font = `700 ${Math.max(11 * dpr, H * 0.022)}px Figtree, system-ui`; ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(`${Math.round(fps)} fps`, W - H * 0.03, H * 0.05);
    }
    // The controls below: only when something visible changed, and not while full screen hides them.
    if (!isFull()) {
      const fr = Math.round(((now - start) / span) * 1000) / 10, clock = `${clockText(now - start)} / ${clockText(span)}`;
      if (fr !== shown.fr) { shown.fr = fr; fill.style.width = `${fr}%`; knob.style.left = `${fr}%`; tl.setAttribute('aria-valuenow', Math.round(fr)); }
      if (clock !== shown.clock) clockEl.textContent = shown.clock = clock;
    }
  }
  const fill = $('fill'), knob = $('knob'), clockEl = $('clock'), tl = $('tl'), shown = { fr: -1, clock: '' };

  // HUD beside the grid, like the game's side panels: grade, accuracy and notes on the left; combo on the right.
  // Live PP: the published points along the replay (see LeaderboardService.livePP), eased so the number rolls.
  const ppCurve = v.ppCurve ?? [];
  const ppAt = t => { let lo = -1, hi = ppCurve.length; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ppCurve[m][0] <= t) lo = m; else hi = m; } return lo >= 0 ? ppCurve[lo][1] : 0; };
  let ppShown = 0, healthShown = 1, healthLag = 1;
  // The grid drifts with the cursor (the game's half-lock camera). The HUD follows only part of that drift, eased, so the
  // numbers stay readable while the play moves fast; a miss and a combo level change get a brief, stronger reaction.
  /** `text` in the canvas's current font, cut short with "…" to fit `room` pixels (by whole characters, so an emoji is never halved). */
  const clipText = (text, room) => {
    if (!(room > 0) || ctx.measureText(text).width <= room) return text;
    const chars = [...text];
    while (chars.length > 1 && ctx.measureText(`${chars.join('')}…`).width > room) chars.pop();
    return `${chars.join('').trimEnd()}…`;
  };
  const HUD_FOLLOW = 0.35;
  let hudX = 0, hudY = 0, hudLagX = 0, hudLagY = 0, lastMisses = 0, missAt = -1e9, lastLevel = 1, levelAt = -1e9;

  function drawHud(gx0, gy0, gx1, gy1, gs) {
    const j = judgedIndex(now), e = j >= 0 ? judged[j] : null, seen = j + 1;
    const acc = seen ? e.hits / seen : 1, g = GRADES.find(([min]) => acc >= min - 1e-9);
    const u = gs * 0.016, midY = (gy0 + gy1) / 2;
    ctx.textBaseline = 'alphabetic';
    // left panel
    const lx = gx0 - hudLagX - u * 12, room = lx - W * 0.03, hmidY = midY - hudLagY;   // panels follow the grid gently, not every cursor move; on a narrow (phone) view the left panel is tight
    const fitFont = (weight, size, family, text) => {
      ctx.font = `${weight} ${size}px ${family}`;
      const w = ctx.measureText(text).width;
      if (w > room && room > 0) ctx.font = `${weight} ${size * room / w}px ${family}`;
    };
    ctx.textAlign = 'right';
    const gradeText = seen ? g[1] : '--';
    fitFont(800, u * 30, 'Unbounded, system-ui', gradeText);
    // As on the site: an S exactly one miss short of a full combo is silver, and a top grade set with a mod that raises
    // PP is charged (it glows, with a spark beside it).
    const near = g[1] === 'S' && seen - (e?.hits ?? 0) === 1, charged = seen && v.boosted && (g[1] === 'SS' || g[1] === 'S');
    const gradeColor = !seen ? 'rgba(255,255,255,0.5)' : g[1] === 'SS' ? `hsl(${(performance.now() / 45) % 360} 80% 80%)` : near ? '#e6ecf8' : g[2];
    ctx.fillStyle = gradeColor;
    if (charged) { ctx.shadowColor = gradeColor; ctx.shadowBlur = u * 7; }
    ctx.fillText(gradeText, lx, hmidY - u * 4);
    if (charged) {
      ctx.fillText(gradeText, lx, hmidY - u * 4);   // twice: a stronger glow
      ctx.shadowBlur = u * 3; ctx.fillStyle = '#fff'; ctx.font = `700 ${u * 9}px Figtree, system-ui`;
      ctx.fillText('✦', lx + u * 6, hmidY - u * 26);
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    }
    const accText = seen === 0 || acc === 1 ? '100%' : `${(acc * 100).toFixed(3)}%`;
    fitFont(700, u * 9, 'Figtree, system-ui', accText); ctx.fillStyle = '#fff';
    ctx.fillText(accText, lx, hmidY + u * 10);
    const countText = `${(e?.hits ?? 0).toLocaleString('en-US')} / ${seen.toLocaleString('en-US')}`;
    fitFont(600, u * 6.5, 'Figtree, system-ui', countText); ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(countText, lx, hmidY + u * 19);
    // right panel: combo multiplier ring, combo and misses
    const rx = gx1 - hudLagX + u * 22, ry = hmidY - u * 8, rr = u * 13;
    const level = e?.level ?? 1, nowMs = performance.now();
    if (level !== lastLevel) { lastLevel = level; levelAt = nowMs; }
    const pulse = Math.max(0, 1 - (nowMs - levelAt) / 420);   // 1 right at a level change, gone in under half a second
    if (pulse) { ctx.fillStyle = `rgba(255,255,255,${0.18 * pulse})`; ctx.beginPath(); ctx.arc(rx, ry, rr + u * 4 * pulse, 0, Math.PI * 2); ctx.fill(); }
    ctx.lineWidth = u * (2.2 + 1.4 * pulse); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + ((e?.progress ?? 0) / 10) * Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = `800 ${u * 9}px Unbounded, system-ui`; ctx.fillStyle = '#fff';
    ctx.fillText(`${e?.level ?? 1}x`, rx, ry + u * 3.2);
    ctx.font = `700 ${u * 8}px Figtree, system-ui`;
    ctx.fillText(`${(e?.combo ?? 0).toLocaleString('en-US')}`, rx, ry + rr + u * 11);
    ctx.font = `600 ${u * 6}px Figtree, system-ui`; ctx.fillStyle = 'rgba(255,255,255,0.65)';
    const misses = seen - (e?.hits ?? 0);
    if (misses > lastMisses) missAt = nowMs;
    lastMisses = misses;
    const flash = Math.max(0, 1 - (nowMs - missAt) / 500);   // a miss: the count turns red and a touch bigger, then settles
    if (flash) { ctx.font = `700 ${u * (6 + 1.5 * flash)}px Figtree, system-ui`; ctx.fillStyle = `rgba(${Math.round(255)},${Math.round(255 - 163 * flash)},${Math.round(255 - 147 * flash)},${0.65 + 0.35 * flash})`; }
    ctx.fillText(`${misses} miss${misses === 1 ? '' : 'es'}`, rx, ry + rr + u * 19);
    if (ppCurve.length) {
      const target = ppAt(now);
      ppShown += (target - ppShown) * 0.18;
      if (Math.abs(target - ppShown) < 0.05) ppShown = target;
      ctx.font = `800 ${u * 9}px Unbounded, system-ui`; ctx.fillStyle = v.ranked === false ? 'rgba(255,255,255,0.55)' : '#c9b6ff';
      ctx.fillText(`${Math.round(ppShown)}pp`, rx, ry + rr + u * 33);
      if (v.ranked === false) { ctx.font = `600 ${u * 5.5}px Figtree, system-ui`; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText('if ranked', rx, ry + rr + u * 40); }
    }
    // song progress under the grid
    const p = Math.min(1, Math.max(0, (songMs(now) - songMs(start)) / Math.max(1, songMs(end) - songMs(start))));
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(gx0, gy1 + u * 5, gx1 - gx0, u * 1.2);
    ctx.fillStyle = '#fff'; ctx.fillRect(gx0, gy1 + u * 5, (gx1 - gx0) * p, u * 1.2);
    // health bar below it: eases to its value; what was just lost lingers in red for a moment
    const hp = (e?.health ?? 100) / 100;
    healthShown += (hp - healthShown) * 0.2;
    healthLag = hp > healthLag ? hp : healthLag + (hp - healthLag) * 0.04;
    const hy = gy1 + u * 9, hh = u * 2.6, hw = gx1 - gx0;
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; rrect(gx0, hy, hw, hh, hh / 2); ctx.fill();
    if (healthLag > healthShown + 0.002) { ctx.fillStyle = 'rgba(255,92,108,0.75)'; rrect(gx0, hy, hw * healthLag, hh, hh / 2); ctx.fill(); }
    ctx.fillStyle = healthShown > 0.5 ? '#ffffff' : healthShown > 0.25 ? '#ffd166' : '#ff5c6c';
    if (healthShown > 0.004) { rrect(gx0, hy, hw * healthShown, hh, hh / 2); ctx.fill(); }
    // title and player, top-left like a spectator overlay
    ctx.textAlign = 'left'; ctx.font = `700 ${Math.max(11 * dpr, H * 0.024)}px Figtree, system-ui`; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    // (cut short with "…" where it would run off the picture, or under the stage's exit button when the window is filled by the page: the button is 44 px and sits 10 px from the corner)
    const titleRoom = W - H * 0.03 - (stage.classList.contains('filled') ? 64 * dpr : H * 0.03);
    ctx.fillText(clipText(`${v.artist} - ${v.title}`, titleRoom), H * 0.03, H * 0.05);
    ctx.font = `600 ${Math.max(10 * dpr, H * 0.02)}px Figtree, system-ui`; ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(clipText(v.player, titleRoom), H * 0.03, H * 0.05 + Math.max(14 * dpr, H * 0.032));
    // the play's own speed and mods, quietly under the health bar (where Rewrite shows its mod icons)
    let below = hy + hh;   // where the space under the grid begins (the phone board goes there)
    if (playTags.length) {
      ctx.font = `700 ${u * 5.2}px Figtree, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const padX = u * 3.5, gap = u * 2.5, ph = u * 8.5, widths = playTags.map(t => ctx.measureText(t.text).width + padX * 2);
      let x = (gx0 + gx1) / 2 - (widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)) / 2;
      const y = hy + hh + u * 6;
      below = y + ph;
      playTags.forEach((t, i) => {
        ctx.fillStyle = t.boost ? 'rgba(201,182,255,0.16)' : 'rgba(255,255,255,0.08)'; rrect(x, y, widths[i], ph, ph / 2); ctx.fill();
        ctx.fillStyle = t.boost ? 'rgba(220,206,255,0.9)' : 'rgba(255,255,255,0.68)'; ctx.fillText(t.text, x + widths[i] / 2, y + ph / 2 + u * 0.3);
        x += widths[i] + gap;
      });
      ctx.textBaseline = 'alphabetic';
    }
    if (opt.board) drawBoard({ pp: ppCurve.length ? ppShown : v.pp, accuracy: acc, misses: seen - (e?.hits ?? 0), seen }, below);
    if (opt.intro && staff) drawIntro(gx0, gy0, gx1, gy1, u);
  }

  // ---------- map leaderboard beside the play ----------
  // The map's leaderboard in the map page's order (PP, then accuracy, then fewer pauses). Everyone else shows their
  // final result; this attempt follows along from its start with its PP, accuracy and misses so far (the HUD's live PP),
  // moving up past the plays it overtakes. If it isn't the player's best, their best stays on the board as its own row.
  // The board stays put: its place and size come from where the grid rests, not from the camera drifting with the cursor.
  const avatars = new Map();
  const avatarImg = url => { if (!url) return null; if (!avatars.has(url)) { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.src = url; avatars.set(url, im); } const im = avatars.get(url); return im.complete && im.naturalWidth ? im : null; };
  let others = null, profile = null;
  h.api(`/api/maps/${v.mapId}`).then(d => {
    others = (d.leaderboard ?? []).filter(r => r.id !== v.id).map(r => ({ key: `s${r.id}`, player: r.player, avatar: r.avatar, pp: r.pp, accuracy: r.accuracy, misses: r.misses }));
  }).catch(() => {});
  h.api(`/api/players/${encodeURIComponent(v.player)}`).then(p => { profile = p; avatarImg(p.avatar); }).catch(() => {});
  const rowY = new Map();   // row -> the height it's drawn at, easing toward its place
  let myIdx = null, shownLast = new Set();
  function drawBoard(live, below) {
    if (!others) return;
    const f = (Math.min(W, H) / 2) / Math.tan((Math.min(170, Math.max(1, view.fov)) * Math.PI) / 360), u = (f / CAM_Z) * 0.016;
    const reach = (1.37 + (gridScale > 1 ? 0.6 : 0)) * (opt.follow && !view.camUnlock ? 0.1 * view.parallax * 0.25 : 0);
    const right = W / 2 - (f * (1.5 * gridScale + reach)) / CAM_Z - u * 64;   // clear of the grade beside the grid wherever the camera drifts
    const x0 = H * 0.035, w = Math.min(H * 0.34, right - x0);
    // This attempt's place: it changes only once it's clearly past (or behind) another play, so it doesn't flicker.
    const ahead = x => others.reduce((n, o) => n + (o.pp > x), 0);
    myIdx = myIdx === null ? ahead(live.pp) : Math.min(ahead(live.pp - 0.5), Math.max(ahead(live.pp + 0.5), myIdx));
    const rows = [...others.slice(0, myIdx), { key: 'me', me: true, player: v.player, avatar: profile?.avatar, ...live }, ...others.slice(myIdx)];
    if (w < H * 0.2) { drawMiniBoard(rows, below); return; }   // no room beside the grid (a phone): a compact board under it instead
    const show = [...new Set([0, 1, 2, 3, 4, myIdx - 1, myIdx, myIdx + 1].filter(i => i >= 0 && i < rows.length))].sort((a, b) => a - b);
    const rowH = H * 0.052, gapH = H * 0.012;
    let y = H / 2 - (8 * rowH + gapH) / 2;   // a fixed top, so the board doesn't re-centre as rows come and go
    const slots = [];
    show.forEach((ix, k) => { if (k && ix !== show[k - 1] + 1) { slots.push({ gap: y }); y += gapH; } slots.push({ ix, y }); y += rowH; });
    ctx.textBaseline = 'middle';
    const drawn = new Set();
    const isMe = q => q.ix !== undefined && rows[q.ix].key === 'me';
    for (const sl of [...slots.filter(q => !isMe(q)), ...slots.filter(isMe)]) {   // this attempt last, on top
      if (sl.gap !== undefined) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.textAlign = 'center'; ctx.font = `700 ${H * 0.014}px Figtree, system-ui`; ctx.fillText('···', x0 + w / 2, sl.gap + gapH / 2 - H * 0.004); continue; }
      const r = rows[sl.ix];
      const prev = shownLast.has(r.key) ? rowY.get(r.key) : sl.y, ry = Math.abs(sl.y - prev) < 0.5 ? sl.y : prev + (sl.y - prev) * 0.16;
      rowY.set(r.key, ry); drawn.add(r.key);
      const cy = ry + rowH / 2, ar = rowH * 0.3;
      ctx.fillStyle = r.me ? 'rgba(150,112,245,0.36)' : 'rgba(10,8,18,0.5)'; rrect(x0, ry + 2, w, rowH - 4, rowH * 0.18); ctx.fill();
      if (r.me) { ctx.fillStyle = '#c9b6ff'; rrect(x0, ry + 2, H * 0.004, rowH - 4, H * 0.002); ctx.fill(); }
      ctx.textAlign = 'left'; ctx.font = `800 ${H * 0.015}px Unbounded, system-ui`; ctx.fillStyle = r.me ? '#fff' : 'rgba(255,255,255,0.6)';
      ctx.fillText(r.me && v.status !== 'verified' ? '–' : `#${sl.ix + 1}`, x0 + H * 0.012, cy);
      const ax = x0 + H * 0.068, im = avatarImg(r.avatar);
      ctx.save(); ctx.beginPath(); ctx.arc(ax, cy, ar, 0, Math.PI * 2); ctx.clip();
      if (im) ctx.drawImage(im, ax - ar, cy - ar, ar * 2, ar * 2); else { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(ax - ar, cy - ar, ar * 2, ar * 2); }
      ctx.restore();
      const tx = ax + ar + H * 0.01, ppText = `${Math.round(r.pp).toLocaleString('en-US')}pp`;
      ctx.font = `800 ${H * 0.016}px Unbounded, system-ui`; const ppW = ctx.measureText(ppText).width;
      ctx.textAlign = 'right'; ctx.fillStyle = r.me ? '#e3d8ff' : 'rgba(255,255,255,0.8)'; ctx.fillText(ppText, x0 + w - H * 0.012, cy - rowH * 0.15);
      ctx.textAlign = 'left'; ctx.font = `700 ${H * 0.016}px Figtree, system-ui`; ctx.fillStyle = r.me ? '#fff' : 'rgba(255,255,255,0.85)';
      let name = r.player; const room = x0 + w - H * 0.024 - ppW - tx;
      while (name.length > 1 && ctx.measureText(name).width > room) name = name.slice(0, -2) + '…';
      ctx.fillText(name, tx, cy - rowH * 0.15);
      ctx.font = `600 ${H * 0.0125}px Figtree, system-ui`; ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(r.me && !r.seen ? '–' : `${(r.accuracy * 100).toFixed(2)}% · ${r.misses ? `${r.misses} miss${r.misses === 1 ? '' : 'es'}` : 'full combo'}`, tx, cy + rowH * 0.2);
    }
    shownLast = drawn;
    ctx.textBaseline = 'alphabetic';
  }

  // The phone board: up to three single-line rows under the grid (the leader, the play just above this one, this one),
  // sized by the room left, so the playfield is never covered. Nothing is drawn when even one row wouldn't be readable.
  function drawMiniBoard(rows, below) {
    const top = below + H * 0.02, avail = H - top - H * 0.025;
    const n = Math.min(3, Math.floor(avail / (H * 0.05)));
    if (n < 1) { shownLast = new Set(); return; }
    const pick = [...new Set([myIdx, myIdx - 1, 0])].filter(i => i >= 0 && i < rows.length).sort((a, b) => a - b).slice(-n);
    if (!pick.includes(myIdx)) pick[pick.length - 1] = myIdx;
    const rowH = Math.min(H * 0.062, avail / pick.length), x0 = W * 0.04, w = W - 2 * x0;
    ctx.textBaseline = 'middle';
    pick.forEach((ix, k) => {
      const r = rows[ix], ry = top + k * rowH, cy = ry + rowH / 2, ar = rowH * 0.3;
      ctx.fillStyle = r.me ? 'rgba(150,112,245,0.36)' : 'rgba(10,8,18,0.5)'; rrect(x0, ry + 2, w, rowH - 4, rowH * 0.22); ctx.fill();
      if (r.me) { ctx.fillStyle = '#c9b6ff'; rrect(x0, ry + 2, rowH * 0.09, rowH - 4, rowH * 0.045); ctx.fill(); }
      ctx.textAlign = 'left'; ctx.font = `800 ${rowH * 0.4}px Unbounded, system-ui`; ctx.fillStyle = r.me ? '#fff' : 'rgba(255,255,255,0.6)';
      ctx.fillText(r.me && v.status !== 'verified' ? '–' : `#${ix + 1}`, x0 + rowH * 0.35, cy);
      const ax = x0 + rowH * 1.55, im = avatarImg(r.avatar);
      ctx.save(); ctx.beginPath(); ctx.arc(ax, cy, ar, 0, Math.PI * 2); ctx.clip();
      if (im) ctx.drawImage(im, ax - ar, cy - ar, ar * 2, ar * 2); else { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(ax - ar, cy - ar, ar * 2, ar * 2); }
      ctx.restore();
      const ppText = `${Math.round(r.pp).toLocaleString('en-US')}pp`;
      ctx.font = `800 ${rowH * 0.42}px Unbounded, system-ui`; const ppW = ctx.measureText(ppText).width;
      ctx.textAlign = 'right'; ctx.fillStyle = r.me ? '#e3d8ff' : 'rgba(255,255,255,0.8)'; ctx.fillText(ppText, x0 + w - rowH * 0.35, cy);
      const tx = ax + ar + rowH * 0.3, room = x0 + w - rowH * 0.6 - ppW - tx;
      ctx.textAlign = 'left'; ctx.font = `700 ${rowH * 0.42}px Figtree, system-ui`; ctx.fillStyle = r.me ? '#fff' : 'rgba(255,255,255,0.85)';
      let name = r.player; while (name.length > 1 && ctx.measureText(name).width > room) name = name.slice(0, -2) + '…';
      ctx.fillText(name, tx, cy);
    });
    shownLast = new Set();
    ctx.textBaseline = 'alphabetic';
  }

  // ---------- player intro (staff only) ----------
  // As the replay starts: the player's picture, name, rank and total for about 3 seconds, gone before the first notes
  // fly in, so it never covers the play itself. Only shown to staff (the developer), for recording.
  // Clean view holds the opening frame while it plays (introHold: when it began), so replays that start right before
  // their first note get it too, and it's shown once.
  const introAt = start;
  let introHold = null, introDone = false;
  const INTRO_MS = 2900;
  function drawIntro(gx0, gy0, gx1, gy1, u) {
    if (!profile) return;
    const t = introHold !== null ? performance.now() - introHold : introDone ? Infinity : (now - introAt) / rate;   // real ms
    const out = introHold !== null ? INTRO_MS : Math.min(INTRO_MS, ((notes[0]?.t ?? introAt) - introAt) / rate - 600);   // gone 0.6 s before the first note
    if (t < 0 || t > out || out < 900) return;
    const ease = q => 1 - Math.pow(1 - Math.min(1, Math.max(0, q)), 3);
    const a = t < 450 ? ease(t / 450) : t > out - 750 ? 1 - ease((t - (out - 750)) / 750) : 1;
    if (a <= 0.01) return;
    const cx = (gx0 + gx1) / 2, cy = gy0 + (gy1 - gy0) * 0.38 - (1 - ease(t / 450)) * u * 6, ar = u * 16;
    ctx.save(); ctx.globalAlpha = a;
    const halo = ctx.createRadialGradient(cx, cy + u * 14, 0, cx, cy + u * 14, u * 70);
    halo.addColorStop(0, 'rgba(7,6,13,0.75)'); halo.addColorStop(1, 'rgba(7,6,13,0)'); ctx.fillStyle = halo; ctx.fillRect(cx - u * 80, cy - u * 60, u * 160, u * 150);
    const im = avatarImg(profile.avatar), s = 0.9 + 0.1 * ease(t / 450);
    ctx.beginPath(); ctx.arc(cx, cy, ar * s + u * 1.2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(201,182,255,0.55)'; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, ar * s, 0, Math.PI * 2); ctx.clip();
    if (im) ctx.drawImage(im, cx - ar * s, cy - ar * s, ar * s * 2, ar * s * 2); else { ctx.fillStyle = '#3b2f66'; ctx.fillRect(cx - ar, cy - ar, ar * 2, ar * 2); }
    ctx.restore();
    ctx.textAlign = 'center'; ctx.font = `800 ${u * 9}px Unbounded, system-ui`; ctx.fillStyle = '#fff';
    ctx.fillText(v.player, cx, cy + ar + u * 13);
    ctx.font = `600 ${u * 5.6}px Figtree, system-ui`; ctx.fillStyle = 'rgba(255,255,255,0.72)';
    const client = v.format === 'sspre' ? 'Nightly' : v.format === 'phxr' ? 'Rewrite' : '';
    ctx.fillText([profile.rank ? `#${profile.rank} global` : null, profile.pp ? `${Math.round(profile.pp).toLocaleString('en-US')}pp` : null, client].filter(Boolean).join('  ·  '), cx, cy + ar + u * 22);
    ctx.restore();
  }

  // ---------- song + hit sounds ----------
  const audio = new SongAudio();   // (an audio element, that cuts a variable-bitrate MP3 where a browser would seek in it off the mark: web/slice.js)
  audio.preservesPitch = false; audio.mozPreservesPitch = false; audio.webkitPreservesPitch = false;   // speed mods change pitch, as in the game
  audio.volume = opt.volume;
  let audioReady = false, actx = null, sfx = {}, driftAvg = 0, resync = false;
  // The song takes a moment to really start after play() or a seek: its element says it is playing, and its clock reads where it was asked to be, before any
  // sound comes out. The picture waits for it (as it waits for a cut: see `tick`) and is then put where the song is, in one step. Letting the picture run on
  // and pulling it back a millisecond or two a frame afterwards left the music off for the first second or more after every start.
  const SETTLE_MS = 800, OFFSET_STILL_MS = 250;
  let settle = null;      // while the song is starting: { from: where it was asked to read (ms), at: when (performance.now()) }
  let lastInput = -Infinity;   // when the offset slider last moved (the song is left alone while it is being moved)
  let songUrl = null;   // the object URL of a song read from a file, given back when another song replaces it or the page is left
  let left = false;     // the page was left: a song that is still on its way is dropped, not shown (and its object URL given back)
  const loading = new AbortController();   // the download of a song, stopped when the page is left
  let songEvents = null;   // the listeners of the song being loaded: gone once it has loaded (or failed) or another one replaces it
  const say = html => { const box = left ? null : $('song'); if (box) box.innerHTML = html; };   // the song box (not there once the page is left)
  const useSong = (src, label, cut = null) => {
    if (left) { if (src.startsWith('blob:')) URL.revokeObjectURL(src); return; }
    if (songUrl && songUrl !== src) { URL.revokeObjectURL(songUrl); songUrl = null; }
    if (src.startsWith('blob:')) songUrl = src;
    audio.load(src, { cut }); audioReady = false; unlocked = false; settle = null;
    say(`<span class="muted">Loading the song…</span>`);
    songEvents?.abort(); songEvents = new AbortController();
    const { signal } = songEvents;
    audio.addEventListener('canplay', () => { songEvents.abort(); audioReady = true; say(`<span class="pill verified">♪ Song</span> <span class="muted">${h.esc(label)}</span>`); }, { once: true, signal });
    audio.addEventListener('error', () => { songEvents.abort(); audioReady = false; songOptions("That file isn't a song this browser can play."); }, { once: true, signal });
    // A phone's browser loads nothing until play() is called inside a tap, so the song may be waiting for one: say so, with a button, rather than "Loading" for good.
    const waiting = setTimeout(() => {
      if (audioReady || left || signal.aborted) return;
      say(`<span class="muted">The song waits for a tap on this device.</span> <button class="btn small" id="song-unlock" type="button">Load the song</button>`);
      $('song-unlock')?.addEventListener('click', () => { unlockAudio(); say(`<span class="muted">Loading the song…</span>`); });
    }, 2500);
    signal.addEventListener('abort', () => clearTimeout(waiting), { once: true });
  };
  // A phone's browser (iPhone Safari above all) loads nothing for an audio element, and lets a page start it by itself later, until play() has been called
  // inside a tap once. So the first tap (Play, the big Play, the picture, or "Load the song") plays it, silently, and stops it (unless the replay wants the song at
  // that moment, when it plays on): from then on the viewer starts and seeks the song as the replay needs. Nothing is lost on a computer, where this is harmless.
  let unlocked = false, unlockToken = 0;
  const unlockAudio = () => {
    if (unlocked || !audio.src) return;
    unlocked = true;
    const token = ++unlockToken;
    audio.muted = true;
    let started; try { started = audio.play(); } catch { started = null; }
    // (stopped again, unless the viewer has started the song itself by then: a phone can answer late, and its answer must not stop the song that is playing)
    Promise.resolve(started).then(() => { if (token === unlockToken && !audioWanted()) audio.pause(); }, () => { unlocked = false; }).finally(() => { audio.muted = false; });
  };
  const songFromMapFile = async (bytes, label) => {
    const a = await extractAudio(bytes, inflateRaw);
    if (!a) throw new Error("That map file doesn't contain a song.");
    const same = (await noteHash((await parseMap(bytes, inflateRaw)).notes)) === v.mapHash;
    if (left) return;
    say('<span class="muted">Preparing the song…</span>');
    const song = await prepareSong(new Blob([a.bytes], { type: a.mime }));   // (a variable-bitrate MP3 is made so that every seek lands where it should)
    if (left) return;
    useSong(URL.createObjectURL(song.blob), same ? label : `${label} (a different version of the map, so timing may be off)`, song.slice ? song.blob : null);
  };
  // Where the song comes from, first that works: the host's map library (the site on the bot's computer), the viewer's
  // own Sound Space Plus maps folder (connected once, remembered by this browser), the challenge sheet's copy.
  // The public site never hosts songs; they're copyrighted.
  const folderApi = typeof window.showDirectoryPicker === 'function';
  const handles = (mode, fn) => new Promise((resolve, reject) => {
    const open = indexedDB.open('rpp', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('handles');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => { const tx = open.result.transaction('handles', mode), req = fn(tx.objectStore('handles')); tx.oncomplete = () => resolve(req.result); tx.onerror = () => reject(tx.error); };
  });
  const savedFolder = () => (folderApi ? handles('readonly', st => st.get('maps')).catch(() => null) : Promise.resolve(null));
  const saveFolder = dir => handles('readwrite', st => (dir ? st.put(dir, 'maps') : st.delete('maps'))).catch(() => {});
  /** Plays the song from the connected folder. False if the browser still needs a click to allow reading it. */
  const songFromFolder = async (dir, ask) => {
    let ok = (await dir.queryPermission({ mode: 'read' })) === 'granted';
    if (!ok && ask) ok = (await dir.requestPermission({ mode: 'read' })) === 'granted';
    if (!ok) return false;
    // A map's file can be named after its ID or after the file it came from, so try every name it's known by.
    const keys = [...new Set([v.mapKey, ...(v.mapFiles ?? [])].filter(Boolean))];
    for (const name of keys.flatMap(k => [`${k}.sspm`, `${k}.phxm`])) {
      let file;
      try { file = await (await dir.getFileHandle(name)).getFile(); } catch { continue; }
      await songFromMapFile(new Uint8Array(await file.arrayBuffer()), 'from your maps folder');
      return true;
    }
    // Saved under another name: find it by its notes. Each .sspm's header gives its note count (a few bytes read), and
    // only files with this map's count are read in full and checked against its note hash.
    say('<span class="muted">Looking for the map in your maps folder…</span>');
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file' || !/\.sspm$/i.test(name)) continue;
      try {
        const file = await handle.getFile();
        if ((await sspmNoteCount(file)) !== notes.length) continue;
        const bytes = new Uint8Array(await file.arrayBuffer());
        if ((await noteHash((await parseMap(bytes, inflateRaw)).notes)) !== v.mapHash) continue;
        await songFromMapFile(bytes, `from your maps folder (${name})`);
        return true;
      } catch { /* unreadable file: skip it */ }
    }
    throw new Error(`This map isn't in your maps folder (looked for ${keys[0]}.sspm${keys.length > 1 ? ` and ${keys.length - 1} other name${keys.length > 2 ? 's' : ''}` : ''}, and for any file with its notes). Download it in Sound Space Plus, or pick the map file.`);
  };
  /** The sheet's copy of the map, when it is a GitHub file (the only host this page may fetch from). */
  const sheetLink = () => sheetLinkOf(v.poolLink);
  const songFromSheet = async () => {
    const link = sheetLink();
    if (!link) throw new Error("The challenge sheet's copy is not on GitHub, so this page can't load it. Use a map file instead.");
    say('<span class="muted">Loading the song from the challenge sheet…</span>');
    const res = await fetch(link, { signal: loading.signal });
    if (!res.ok) throw new Error(`Download failed (${res.status}).`);
    const bytes = await readCapped(res, SHEET_MAX);
    if (left) return;
    await songFromMapFile(bytes, "from the challenge sheet's copy");
  };
  const songOptions = async note => {
    const dir = await savedFolder();
    if (left) return;
    say(`${note ? `<p class="muted" style="margin:0 0 10px;font-size:13px">${h.esc(note)}</p>` : ''}
      <div class="chips">${folderApi && v.mapKey ? `<button class="btn small" id="song-folder">${dir ? 'Play it from my maps folder' : 'Connect my maps folder'}</button>` : ''}
      ${sheetLink() ? '<button class="btn ghost small" id="song-sheet">Load it from the challenge sheet</button>' : ''}
      <label class="btn ghost small" style="cursor:pointer">Use a map file…<input type="file" id="song-file" accept=".sspm,.phxm" hidden></label>
      ${dir ? '<button class="btn ghost small" id="song-refolder">Change folder</button>' : ''}</div>
      <p class="muted" style="margin:10px 0 0;font-size:12.5px">${folderApi && v.mapKey
        ? `${dir ? '' : 'Connect it once and every replay plays its song. '}In the folder picker, paste <code>%APPDATA%\\SoundSpacePlus\\maps</code> into the address bar and choose <b>Select Folder</b>. `
        : 'Sound Space Plus keeps maps in <code>%APPDATA%\\SoundSpacePlus\\maps</code>. '}Your files stay on your computer: the song is read right here in the browser. A curator can also share a map's song so it plays here for everyone; ask in the Discord.</p>`);
    const pickFolder = async () => { const d = await window.showDirectoryPicker({ id: 'ssp-maps', mode: 'read' }); await saveFolder(d); return d; };
    const run = async fn => { try { await fn(); } catch (err) { if (left) return; if (err?.name === 'AbortError') songOptions(note); else songOptions(err.message); } };
    $('song-folder')?.addEventListener('click', () => run(async () => {
      const d = (await savedFolder()) ?? (await pickFolder());
      if (!(await songFromFolder(d, true))) songOptions('Reading the folder was not allowed.');
    }));
    $('song-refolder')?.addEventListener('click', () => run(async () => { const d = await pickFolder(); if (!(await songFromFolder(d, true))) songOptions('Reading the folder was not allowed.'); }));
    $('song-file').addEventListener('change', e => run(async () => {
      const file = e.target.files[0]; if (!file) return;
      await songFromMapFile(new Uint8Array(await file.arrayBuffer()), `from ${file.name}`);
    }));
    $('song-sheet')?.addEventListener('click', () => run(songFromSheet));
  };
  (async () => {
    // The song on the site itself (a curator said it may be shared: the site's data names it), or the local server's map library.
    const onSite = /^songs\/\d+\.(?:mp3|ogg|wav|flac)$/.test(v.song ?? '') ? v.song : null, lib = onSite ?? h.songUrl(v.mapId);
    if (lib) {
      try {
        const res = await fetch(lib, { signal: loading.signal });
        if (res.ok) {
          const song = await prepareSong(await res.blob());
          if (left) return;
          return useSong(URL.createObjectURL(song.blob), onSite ? 'from the site' : 'from the map library', song.slice ? song.blob : null);
        }
      } catch { /* not in the library: the other places */ }
    }
    const dir = v.mapKey ? await savedFolder() : null;
    if (left) return;
    if (dir) { try { if (await songFromFolder(dir, false)) return; } catch { /* not in the folder: try the sheet */ } }
    if (sheetLink()) { try { return await songFromSheet(); } catch { /* offer the choices */ } }
    songOptions(dir ? 'Click to play the song from your maps folder:' : 'Add the song to hear it with the replay:');
  })();
  const unlockSfx = async () => {
    if (actx) return;
    try {
      actx = new AudioContext();
      actx.resume?.().catch?.(() => {});   // (a phone may start it suspended: it is made inside the tap, so it may be resumed here)
      for (const name of ['hit', 'miss']) sfx[name] = await actx.decodeAudioData(await (await fetch(`game/${name}.wav`)).arrayBuffer());
    } catch { /* no sound effects */ }
  };
  const blip = name => {
    if (!opt.hitsounds || !actx || !sfx[name]) return;
    const src = actx.createBufferSource(), gain = actx.createGain();
    gain.gain.value = opt.volume * (name === 'hit' ? 0.5 : 0.7); src.buffer = sfx[name]; src.connect(gain).connect(actx.destination); src.start();
  };
  const audioWanted = () => { const target = audioTarget(songMs(now), opt.audioOffset, v.speed * speed); return playing && segAt(now)[2] !== 0 && target >= 0 && target / 1000 < (audio.duration || Infinity); };
  const syncAudio = () => {
    if (!audioReady) return;
    // `target`: where the song element should read: the sound reaches the ears `opt.audioOffset` ms after the element says it is there (see clock.js), so with an offset the element runs that far ahead of the picture.
    const rate = v.speed * speed, song = songMs(now), target = audioTarget(song, opt.audioOffset, rate);
    if (!audioWanted()) { if (!audio.paused) audio.pause(); settle = null; return; }
    audio.playbackRate = rate;
    if (audio.paused) { audio.currentTime = target / 1000; driftAvg = 0; resync = false; settle = { from: target, at: performance.now() }; unlockToken++; audio.play().catch(() => { settle = null; }); return; }
    if (settle) {
      const at = audio.currentTime * 1000;
      if (at >= settle.from + 40 * rate) { settle = null; driftAvg = 0; now = frameFromSong(at - opt.audioOffset * rate, now); }   // the sound is really going (its clock has run for a few tens of ms: it first reads a little ahead of the sound, then stands still for a moment): the picture joins it, where it is
      else if (performance.now() - settle.at > SETTLE_MS) settle = null;   // it does not start (or its clock moves in big steps): the picture goes on and follows the song, as it does when nothing waits
      return;
    }
    if (performance.now() - lastInput < OFFSET_STILL_MS) return;   // the offset slider is being moved: the song is put where the new offset wants it once the slider is still (no jumps on the way)
    // The song's clock only updates in steps, so follow its average and move at most a millisecond or two per frame:
    // chasing each reading made the picture stutter.
    const drift = audio.currentTime * 1000 - target;
    if (Math.abs(drift) > 120 || resync) { audio.currentTime = target / 1000; driftAvg = 0; resync = false; settle = { from: target, at: performance.now() }; return; }   // after a seek, or a hiccup, or a new offset
    driftAvg = driftAvg * 0.94 + drift * 0.06;
    now = frameFromSong(song + Math.max(-1.5, Math.min(1.5, driftAvg * 0.05)), now);
  };

  // ---------- playback ----------
  let frameError = false;
  const tick = ts => {
    if (!document.body.contains(cv)) { audio.pause(); return; }
    const before = now;
    if (playing && !audio.pending && !settle) {   // (the picture waits for a song that is being cut at the frame, a tenth of a second: see web/slice.js, and for one that is starting)
      now = Math.min(end, now + (ts - last) * rate * speed);
      if (now >= end) setPlaying(false);
    }
    if (ts > last) fps = fps ? fps * 0.95 + (1000 / (ts - last)) * 0.05 : 1000 / (ts - last);
    last = ts;
    // One frame that cannot be drawn or played (an odd setting in the replay, a canvas with no size) is skipped; the next frame is always asked for.
    try {
      syncAudio();
      if (playing && now > before && now - before < 250 * rate) {           // sounds for judgements we just passed
        const lead = soundLead(opt.audioOffset, rate, speed);   // (a hit sound is late by the same delay as the music: it is started that much ahead of the picture)
        for (let j = judgedIndex(now + lead); j >= 0 && judged[j].t > before + lead; j--) blip(judged[j].hit ? 'hit' : 'miss');
      }
      draw();
    } catch (err) { if (!frameError) { frameError = true; console.error('replay viewer: a frame could not be drawn:', err); } }
    raf = requestAnimationFrame(tick);
  };
  const setPlaying = p => {
    playing = p;
    if (p) { unlockSfx(); unlockAudio(); if (now >= end) now = start; }
    $('play').textContent = p ? '❚❚' : '▶'; $('play').setAttribute('aria-label', p ? 'Pause' : 'Play');
    $('bigplay').hidden = p || stage.classList.contains('clean');
  };
  const seek = t => { now = Math.max(start, Math.min(end, t)); };

  $('play').addEventListener('click', () => setPlaying(!playing));
  $('bigplay').addEventListener('click', () => setPlaying(true));
  cv.addEventListener('click', () => setPlaying(!playing));
  // Full screen: the browser's own where it has one (a page element can go full screen on a desktop and on an iPad), and where it has none (an
  // iPhone) or refuses, the stage fills the window itself: fixed over the page, the page not scrolling behind it. It is left by the stage's own
  // button, by Escape, or by the browser's back button (one history entry is added for it, so back leaves it and not the replay).
  const isFilled = () => stage.classList.contains('filled');
  isFull = () => document.fullscreenElement === stage || isFilled();
  const endClean = () => { stage.classList.remove('clean'); introHold = null; introDone = false; };
  const fillPage = on => {
    if (on === isFilled()) return;
    stage.classList.toggle('filled', on); document.body.classList.toggle('viewer-filled', on);
    if (on) { try { history.pushState({ rppFill: 1 }, ''); } catch { /* no history here: back leaves the page, as it would anyway */ } }
    else { endClean(); if (history.state?.rppFill) history.back(); }
  };
  const enterFull = async () => {
    if (isFull()) return;
    if (stage.requestFullscreen) { try { await stage.requestFullscreen(); return; } catch { /* refused: fill the window instead */ } }
    fillPage(true);
  };
  const leaveFull = () => { if (document.fullscreenElement) return document.exitFullscreen?.(); fillPage(false); };
  const onBack = () => { if (isFilled()) { stage.classList.remove('filled'); document.body.classList.remove('viewer-filled'); endClean(); } };   // (the entry is already gone)
  window.addEventListener('popstate', onBack);
  $('fs').addEventListener('click', () => (isFull() ? leaveFull() : enterFull()));
  $('exit-fill').addEventListener('click', leaveFull);
  // Clean view, for recording: full screen, back to the start, no mouse pointer or play button, then it plays by itself
  // after a moment (time to start the recorder). Leaving full screen ends it.
  $('clean').addEventListener('click', async () => {
    await enterFull();
    stage.classList.add('clean'); setPlaying(false); seek(introAt); $('bigplay').hidden = true;
    if (opt.intro && staff) { introHold = performance.now(); introDone = true; }
    setTimeout(() => { introHold = null; if (stage.classList.contains('clean')) setPlaying(true); }, opt.intro ? INTRO_MS + 200 : 1200);
  });
  const onFullscreen = () => { if (!isFull()) endClean(); };
  document.addEventListener('fullscreenchange', onFullscreen);
  $('spd').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of b.parentElement.children) x.classList.toggle('on', x === b);
    speed = Number(b.dataset.v);
  });
  for (const [id_, key] of [['o-follow', 'follow'], ['o-trail', 'trail'], ['o-grid', 'grid'], ['o-hits', 'hitsounds'], ['o-fps', 'fps'], ['o-board', 'board'], ['o-intro', 'intro']]) $(id_).addEventListener('change', e => { opt[key] = e.target.checked; store.set(key, opt[key]); });
  $('o-vol').addEventListener('input', e => { opt.volume = Number(e.target.value); audio.volume = opt.volume; store.set('volume', opt.volume); });
  const setOffset = ms => {
    opt.audioOffset = ms; store.set('audioOffset', ms);
    $('o-off').value = ms; $('o-off-v').textContent = offsetText(ms); $('o-off-0').hidden = ms === 0;
  };
  $('o-off').addEventListener('input', e => { setOffset(Number(e.target.value)); resync = true; lastInput = performance.now(); });   // (the song is put where the new offset wants it once the slider is still: moving it makes no jumps)
  $('o-off').addEventListener('change', () => { lastInput = -Infinity; });   // (let go: no need to wait)
  $('o-off-0').addEventListener('click', () => { setOffset(0); resync = true; lastInput = -Infinity; });
  $('o-colors').addEventListener('change', e => { opt.colors = e.target.value; store.set('colors', opt.colors); });
  const fromPointer = e => { const r = tl.getBoundingClientRect(); seek(start + ((e.clientX - r.left) / r.width) * span); };
  tl.addEventListener('pointerdown', e => { tl.setPointerCapture(e.pointerId); fromPointer(e); });
  tl.addEventListener('pointermove', e => { if (tl.hasPointerCapture(e.pointerId)) fromPointer(e); });
  const onKey = e => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.code === 'Space') { if (e.target.closest?.('button, a, summary, label')) return; setPlaying(!playing); e.preventDefault(); }   // (on a focused button, Space presses it)
    else if (e.key === 'ArrowLeft') { seek(now - 2000 * rate); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { seek(now + 2000 * rate); e.preventDefault(); }
    else if (e.key === 'Escape' && stage.classList.contains('filled')) { leaveFull(); e.preventDefault(); }
    else if (e.key === 'l' || e.key === 'L') { opt.board = !opt.board; $('o-board').checked = opt.board; store.set('board', opt.board); }
  };
  document.addEventListener('keydown', onKey);
  window.addEventListener('rpp:leave', () => { left = true; loading.abort(); songEvents?.abort(); cancelAnimationFrame(raf); audio.pause(); audio.removeAttribute('src'); actx?.close(); document.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFullscreen); window.removeEventListener('popstate', onBack); document.body.classList.remove('viewer-filled'); if (songUrl) URL.revokeObjectURL(songUrl); }, { once: true });
  seek(opt.intro ? introAt : Math.max(start, (notes[0]?.t ?? start) - 1500 * rate));
  raf = requestAnimationFrame(ts => { last = ts; tick(ts); });
  setPlaying(false);   // browsers only allow sound after a click, so playback starts from the play button
}
