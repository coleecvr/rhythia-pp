// The Maps page's star bands and the challenge pool page's filters, kept apart from the page so they can be tested.

/** Star ranges: min inclusive, max exclusive. */
export const BANDS = { any: [0, Infinity], low: [0, 3], mid: [3, 5], high: [5, 7], top: [7, Infinity] };

/** Whether a map is in a band by the stars the card prints (two decimals): 2.996 prints as 3.00, so it is not "under 3 stars". */
export function inBand(stars, band) {
  const [lo, hi] = BANDS[band] ?? BANDS.any, shown = Math.round(stars * 100) / 100;
  return shown >= lo && shown < hi;
}

/** The pool page's buttons, one for each state its tiles count (a button is only offered when its state has maps). */
export const POOL_FILTERS = [
  { v: 'all', label: 'All' }, { v: 'ranked', label: 'Ranked' }, { v: 'pending', label: 'Waiting' },
  { v: 'mismatch', label: 'Different version' }, { v: 'missing', label: 'Not downloaded' }, { v: 'kept', label: 'Unranked on purpose' },
];

/** Whether a pool entry is listed under a button: exactly the entries of that state, so a button lists what its tile counts. */
export const poolShows = (entry, show) => show === 'all' || entry.state === show;
