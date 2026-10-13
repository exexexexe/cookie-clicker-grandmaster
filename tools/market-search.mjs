// Rule search for the stock market: node tools/market-search.mjs (about a minute). Prints the best rules per broker count.
import { gen, evalS } from './market-sim.mjs';
const paths = [gen(40, 1), gen(40, 1), gen(40, 10)];
const filt = { v4: s => s.d > -0.15 && s.mode !== 4 && s.mode !== 2, noFall: s => s.mode !== 4 && s.mode !== 2 };
const S = [];
for (const [fk, f] of Object.entries(filt)) for (const a of [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]) for (const m4 of [0, 0.03]) for (const cap of [2, 2.5, 99])
  S.push({ name: `${fk} buy<=${a} m4@${m4} cap ${cap}`, buy: s => s.v <= a * s.r && f(s), sell: (s, b) => s.v > b && (s.v >= cap * s.r || (s.mode === 4 && s.v >= b * (1 + m4))) });
for (const br of [0, 10, 30, 60]) {
  const over = 1 + 0.2 * Math.pow(0.95, br);
  const res = S.map(st => { let day = 0, tied = 0; for (const P of paths) { const r = evalS(P, over, st.buy, st.sell); day += r.day / paths.length; tied += r.tied / paths.length; } return { name: st.name, day, tied }; }).sort((a, b) => b.day - a.day);
  console.log(`\n${br} brokers (fee ${((over - 1) * 100).toFixed(1)}%)`);
  for (const r of res.slice(0, 6)) console.log(`  ${r.name.padEnd(34)} $${r.day.toFixed(0)}/day tied $${r.tied.toFixed(0)} ROI ${(r.day / r.tied).toFixed(1)}`);
}
