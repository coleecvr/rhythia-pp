// How fast a play was, said the way the game it was played in says it. Used by the website, the replay viewer and the
// Discord bot, so every page shows a play's speed the same way.
//
// Both games store a play's speed as a playback rate: song time per real second (1 = normal, 0.8 = 80%). The song,
// the notes and the hit window all follow it, so a play at 80% is the map stretched to 1.25 times its length.
//   Nightly (Sound Space Plus): the speed buttons are arrows. Their rates are Globals.speed_multi: < << <<< divide by
//     1.15, 1.25 and 1.35 (so < is 86.96%, not 85%); > >> >>> >>>> multiply by 1.15, 1.25, 1.35 and 1.45. A custom
//     speed is a percentage ("C (75%)"). Replays save the button (s:-) or the custom value (s:c0.75).
//   Rewrite: any percentage from 25% to 1000%, with buttons at 80, 90, 110 and 120% (map_info_container.tscn). Replays
//     save the rate as a number; the in-game HUD shows it as "0.90x".
// Checked against real replays: a Nightly < replay only lines up with its map at exactly 1/1.15.

export const NIGHTLY_PRESETS = Object.freeze([
  ['<<<', 1 / 1.35], ['<<', 1 / 1.25], ['<', 1 / 1.15], ['=', 1], ['>', 1.15], ['>>', 1.25], ['>>>', 1.35], ['>>>>', 1.45],
]);
export const REWRITE_PRESETS = Object.freeze([0.8, 0.9, 1, 1.1, 1.2]);

/** Which game a replay format comes from. */
export const clientOf = format => (format === 'sspre' ? 'Nightly' : format === 'phxr' ? 'Rewrite' : null);

// Buttons are exact values (both games compute 1 / 1.15 the same way), so a custom 87% is not mistaken for <.
const near = (a, b) => Math.abs(a - b) < 1e-6;
const isNormal = rate => !(rate > 0) || near(rate, 1);

/** The rate as a percentage: whole when it is one (90%), else to 2 decimals (86.96%). */
export function speedPercent(rate) {
  const p = rate * 100;
  return Math.abs(p - Math.round(p)) < 0.005 ? `${Math.round(p)}%` : `${p.toFixed(2).replace(/0$/, '')}%`;
}

/**
 * Everything worth saying about a play's speed: { rate, normal, percent, short, preset, client, text, title }.
 *   short  - for tight spots: "87%"
 *   text   - for pills and HUDs: "< 87%" for a Nightly button, "90%" otherwise
 *   title  - the full story for a tooltip: "86.96% speed: Nightly's < button (1 ÷ 1.15)"
 */
export function speedInfo(rate, format = null) {
  const client = clientOf(format);
  const normal = isNormal(rate);
  const percent = normal ? '100%' : speedPercent(rate);
  const short = normal ? '100%' : `${Math.round(rate * 100)}%`;
  const preset = client === 'Nightly' ? NIGHTLY_PRESETS.find(([, r]) => near(r, rate))?.[0] ?? null : null;
  const how = preset
    ? `Nightly's ${preset} button (${rate < 1 ? `1 ÷ ${(1 / rate).toFixed(2)}` : `× ${rate.toFixed(2)}`})`
    : client === 'Nightly' ? 'a Nightly custom speed'
    : client === 'Rewrite' ? (REWRITE_PRESETS.some(r => near(r, rate)) ? 'a Rewrite speed button' : 'a Rewrite custom speed') : '';
  return {
    rate, normal, percent, short, preset, client,
    text: normal ? '' : preset && preset !== '=' ? `${preset} ${short}` : percent,
    title: normal ? 'Normal speed' : `${percent} speed${how ? `: ${how}` : ''}. Stars and PP are rated at this speed.`,
  };
}

/** The speeds a map page offers: each game's own buttons, in order, with the rates they stand for. */
export const MAP_SPEEDS = Object.freeze([...new Set([...NIGHTLY_PRESETS.map(([, r]) => r), ...REWRITE_PRESETS])].sort((a, b) => a - b));

/** speedInfo for one of the games' buttons, said the way that game says it (Nightly's arrows, else Rewrite's %). */
export const presetInfo = rate => speedInfo(rate, NIGHTLY_PRESETS.some(([, r]) => near(r, rate)) ? 'sspre' : 'phxr');
