// How two systems compare when both ran in the same measurement rounds. Pure, so scripts/mongo-report.mjs and the
// tests share it.
//
// VERIFIED: each round measures both systems back to back, in alternating order (scripts/bench-mongo.mjs measure()), so load
// from other processes on the host hits both samples of a round alike. The per-round log ratios cancel that drift; a
// ratio of medians would not. Their mean is the geometric mean of the per-round time ratios, and Student's t gives
// its 95% confidence interval, which accounts for the few rounds (7, or 5 bulk loads) a run can afford. The interval
// covers the variation within one run, not between runs on a differently loaded host.

// Two-sided 95% quantiles of Student's t for 1 to 30 degrees of freedom.
const T975 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
  2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];

/**
 * The time of `a` relative to `b` over paired rounds: `ratio` below 1 means `a` took less time. `low` and `high`
 * bound its 95% confidence interval.
 */
export function pairedRatio(a, b) {
  if (a.length !== b.length || a.length < 2 || a.length > T975.length + 1)
    throw new RangeError('pairedRatio needs 2 to 31 rounds measured on both systems.');
  if (![...a, ...b].every((ms) => Number.isFinite(ms) && ms > 0))
    throw new RangeError('pairedRatio needs positive finite times.');
  const logs = a.map((ms, i) => Math.log(ms / b[i]));
  const n = logs.length;
  const mean = logs.reduce((sum, x) => sum + x, 0) / n;
  const sd = Math.sqrt(logs.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1));
  const half = (T975[n - 2] * sd) / Math.sqrt(n);
  return { ratio: Math.exp(mean), low: Math.exp(mean - half), high: Math.exp(mean + half), rounds: n };
}

/** Faster or slower only when the whole interval lies on one side of 1; otherwise the runs cannot tell them apart. */
export const verdict = ({ low, high }) => (high < 1 ? 'faster' : low > 1 ? 'slower' : 'same');
