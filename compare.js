// Compares two players' best plays on ranked maps. Used by the website's compare page and the bot's /compare, so both
// say the same thing. A play is { mapId, title, stars, pp, accuracy } (a player's best on each map).

export const TIED = 0.005;   // PP closer than this is a tie

/** { shared: [{ mapId, title, stars, a, b, diff }] biggest gap first, aOnly, bOnly, aAhead, bAhead, tied } */
export function compareBest(aPlays, bPlays) {
  const theirs = new Map(bPlays.map(p => [p.mapId, p]));
  const shared = [];
  for (const a of aPlays) {
    const b = theirs.get(a.mapId);
    if (b) shared.push({ mapId: a.mapId, title: a.title, stars: a.stars, a: { pp: a.pp, accuracy: a.accuracy }, b: { pp: b.pp, accuracy: b.accuracy }, diff: a.pp - b.pp });
  }
  shared.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff) || x.mapId - y.mapId);
  const aAhead = shared.filter(s => s.diff > TIED).length, bAhead = shared.filter(s => s.diff < -TIED).length;
  return { shared, aOnly: aPlays.length - shared.length, bOnly: bPlays.length - shared.length, aAhead, bAhead, tied: shared.length - aAhead - bAhead };
}
