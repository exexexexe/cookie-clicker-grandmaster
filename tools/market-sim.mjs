// Record price paths from the faithful tick port: val/d/mode per good per tick.
import { makeMarket } from './market.mjs';
export function gen(days, bank, N = 18, warm = 14400) {
  const m = makeMarket(N, bank), T = 1440 * days;
  for (let t = 0; t < warm; t++) m.tick();
  const val = new Float32Array(T * N), d = new Float32Array(T * N), mode = new Int8Array(T * N), dur = new Int16Array(T * N);
  for (let t = 0; t < T; t++) { m.tick(); for (let i = 0; i < N; i++) { const g = m.goods[i], k = t * N + i; val[k] = g.val; d[k] = g.d; mode[k] = g.mode; dur[k] = g.dur; } }
  return { val, d, mode, dur, T, N, rest: i => m.rest(i), days };
}
// Evaluate a strategy: one share slot per good. Returns $/day profit, avg $ tied, trades/day, median hold (h).
export function evalS(P, over, buy, sell) {
  const { val, d, mode, dur, T, N } = P;
  let profit = 0, tied = 0, trades = 0; const holds = [];
  const basis = new Float64Array(N).fill(-1), since = new Int32Array(N), perGood = new Float64Array(N);
  for (let t = 0; t < T; t++) for (let i = 0; i < N; i++) {
    const k = t * N + i, v = val[k], r = P.rest(i), b = basis[i];
    const s = { v, d: d[k], mode: mode[k], dur: dur[k], r, id: i };
    if (b >= 0) {
      if (sell(s, b)) { profit += v - b; perGood[i] += v - b; trades++; holds.push(t - since[i]); basis[i] = -1; } else tied += b;
    } else if (buy(s)) { basis[i] = v * over; since[i] = t; }
  }
  holds.sort((a, b) => a - b);
  return { day: profit / P.days, tied: tied / T, trades: trades / P.days, hold: (holds[holds.length >> 1] || 0) / 60, perGood: Array.from(perGood, x => x / P.days) };
}
