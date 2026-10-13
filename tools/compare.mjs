import { makeMarket } from './market.mjs';
const DAYS = 90, N = 18;
function run(bank, brokers, rule, buyRule) {
  const m = makeMarket(N, bank), over = 1 + 0.2 * Math.pow(0.95, brokers);
  const pos = m.goods.map(() => null); let profit = 0, tied = 0, trades = 0, maxHold = 0; const holdT = m.goods.map(() => 0);
  for (let t = 0; t < 14400; t++) m.tick();
  for (let t = 0; t < 1440 * DAYS; t++) {
    m.tick();
    for (const g of m.goods) {
      const r = m.rest(g.id), P = pos[g.id];
      if (P) { holdT[g.id]++;
        if (rule(g, r, P)) { profit += g.val - P; pos[g.id] = null; trades++; maxHold = Math.max(maxHold, holdT[g.id]); holdT[g.id] = 0; } else tied += P;
      } else if (buyRule(g, r)) pos[g.id] = g.val * over;
    }
  }
  return `$${(profit / DAYS).toFixed(0)}/day, ${(trades / DAYS).toFixed(0)} trades/day, avg tied $${(tied / 1440 / DAYS).toFixed(0)}, longest hold ${(maxHold / 60).toFixed(0)}h`;
}
const buyV4 = (g, r) => g.val <= r * 0.7 && g.d > -0.15 && g.mode !== 4 && g.mode !== 2;
const rules = {
  'v4 exact (target x4, d<-0.3|mode4 @+3%, or 1.8x rest)': (g, r, P) => (g.val >= P * 4 || ((g.d < -0.3 || g.mode === 4) && g.val >= P * 1.03) || g.val >= r * 1.8) && g.val > P,
  'mode4-only exit @+3%, or 1.8x rest': (g, r, P) => ((g.mode === 4 && g.val >= P * 1.03) || g.val >= r * 1.8) && g.val > P,
  'mode4 exit @+3% only (no cap)': (g, r, P) => g.mode === 4 && g.val >= P * 1.03,
  'mode4|mode2 exit @+3%, or 1.8x rest': (g, r, P) => (((g.mode === 4 || g.mode === 2) && g.val >= P * 1.03) || g.val >= r * 1.8) && g.val > P,
  'sell at rest only': (g, r, P) => g.val >= r && g.val > P,
};
for (const [bank, brokers] of [[1, 0], [1, 60], [10, 60]]) {
  console.log(`\nbank lvl ${bank}, ${brokers} brokers`);
  for (const [k, f] of Object.entries(rules)) console.log('  ' + k.padEnd(58) + run(bank, brokers, f, buyV4));
}
