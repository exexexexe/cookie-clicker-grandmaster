/* v5 economy: clicker (veil-aware), golden cookies, purchase optimizer, building-count filler, pre-ascend spend-down. */
(() => {
  'use strict';
  const CCA = window.CCA, cfg = CCA.cfg, G = CCA.G;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rate = () => (cfg.clicker ? clamp(Number(cfg.clickRate) || 30, 1, 50) : 0);   // same fallback as the click timer

  // ---------------------------------------------------------------- clicker
  // The Shimmering veil (+50% CpS) breaks on the first click of a run. That is deliberate: in game code the veil is up
  // while you own "Shimmering veil [off]" (v4 read it backwards and stopped clicking for the rest of the run once it
  // broke), and with mouse upgrades 30 clicks/s are worth several times the veil. Thick-skinned still comes by itself:
  // each run's first click has the Reinforced membrane's 10% chance to be protected.
  let clickTimer = null;
  function click() {
    if (!cfg.master || !cfg.clicker || !CCA.ok() || CCA.popping) return;
    const g = G();
    if (CCA.clickAllowed && !CCA.clickAllowed(g)) return;
    const before = g.cookieClicks;
    g.ClickCookie();
    CCA.stat('clicks', g.cookieClicks - before);
  }
  CCA.setClickRate = () => {
    CCA.clearInterval(clickTimer);
    clickTimer = CCA.setInterval(click, Math.max(20, 1000 / clamp(Number(cfg.clickRate) || 30, 1, 50)));
  };
  CCA.setClickRate();

  // ---------------------------------------------------------- golden cookies
  CCA.every('golden', 100, () => {
    if (!cfg.golden) return;
    const g = G();
    const hunting = cfg.hunt;
    const needWrath = hunting && !CCA.won('Wrath cookie');
    // Eldeer = pop a reindeer during an Elder frenzy, and Elder frenzy only comes from wrath cookies
    const eldeer = hunting && g.season === 'christmas' && g.elderWrath > 0 && !CCA.won('Eldeer');
    const needFading = hunting && CCA.won('Early bird') && !CCA.won('Fading luck');   // click one golden cookie in its last second
    for (const s of g.shimmers.slice()) {
      if (s.dying) continue;
      if (s.type === 'reindeer') { s.pop(); CCA.stat('golden'); continue; }
      if (s.type !== 'golden') continue;
      if (s.wrath && !cfg.wrath && !needWrath && !eldeer) continue;
      if (needFading && !s.wrath && s.life > g.fps * 0.75) continue;                    // life counts down in frames
      s.pop(); CCA.stat('golden');
    }
  });

  // --------------------------------------------------------------- optimizer
  // For each candidate: apply it virtually, let the game recompute its own gains (Game.CalculateGains), read the
  // new income, revert exactly. Income is measured WITHOUT buffs: during a x777 Click frenzy raw numbers would make
  // every mouse upgrade look like the best buy. CalculateGains also ratchets Game.cookiesPsRawHighest (it prices the
  // stock market and is saved), so that value is restored after the virtual purchases.
  const SKIP = /^(One mind|Communal brainsweep|Elder Pact|Elder Pledge|Elder Covenant|Revoke Elder Covenant|Chocolate egg)$/;
  function buffMult(g) {
    let c = 1, k = 1;
    for (const n in g.buffs) { const b = g.buffs[n]; if (b.multCpS) c *= b.multCpS; if (b.multClick) k *= b.multClick; }
    return { c: c > 0 ? c : 1, k: k > 0 ? k : 1 };
  }
  CCA.buffMult = buffMult;
  // click power is mostly a share of CpS (mouse upgrades), and that CpS includes Frenzy & co., so CpS buffs are divided
  // out of the clicks too; otherwise a Frenzy made mouse upgrades look 7x better than they are
  const income = (g, m) => (g.unbuffedCps || 0) + g.computedMouseCps / (m.k * m.c) * rate();
  // Golden-cookie upgrades add nothing to unbuffed income, so they used to wait until they cost <= 1% of the bank.
  // They are valued instead as a share of income: golden cookies (Frenzy, Click frenzy, Lucky, combos) are taken to be
  // about half of an auto-clicker's earnings, and each upgrade's number is how much it grows that half.
  const GOLDEN = { 'Lucky day': 0.8, 'Serendipity': 0.8, 'Get lucky': 0.8, 'Golden goose egg': 0.05, 'Dragon fang': 0.03 };

  function candidates(g) {
    const out = [];
    g.CalculateGains();
    const hi = g.cookiesPsRawHighest, m = buffMult(g), base = income(g, m);
    try {
      if (cfg.buyBuildings) {
        for (const o of g.ObjectsById) {
          if (o.locked) continue;
          const price = o.getPrice();
          o.amount++; g.BuildingsOwned++;
          try { CCA.quietGains(g); } finally { o.amount--; g.BuildingsOwned--; }
          out.push({ kind: 'b', ref: o, name: o.name, price, d: income(g, m) - base });
        }
      }
      if (cfg.buyUpgrades && CCA.canBuyUpgrades()) {
        for (const u of g.UpgradesInStore) {
          if (u.bought || u.pool === 'toggle' || u.pool === 'debug' || SKIP.test(u.name)) continue;
          if (u.priceLumps > 0 || u.clickFunction || (u.isVaulted && u.isVaulted())) continue;
          const price = u.getPrice();
          u.bought = 1;
          try { CCA.quietGains(g); } finally { u.bought = 0; }
          let d = income(g, m) - base;
          if (d <= 0 && GOLDEN[u.name]) d = base * 0.5 * GOLDEN[u.name];
          out.push({ kind: 'u', ref: u, name: u.name, price, d });
        }
      }
    } finally { CCA.quietGains(g); g.cookiesPsRawHighest = hi; }
    return out;
  }

  function doBuy(c, why) {                               // Object.buy() returns nothing, so verify by state
    const g = G(), before = g.cookies;
    let ok;
    if (c.kind === 'b') { const n = c.ref.amount; c.ref.buy(1); ok = c.ref.amount > n; }
    else { c.ref.buy(); ok = !!c.ref.bought; }
    if (ok) { CCA.stat('bought'); CCA.record(c.kind === 'b' ? 'building' : 'upgrade', c.name, 1, before - g.cookies, why || ''); }
    return ok;
  }

  // ---- achievement filler ------------------------------------------------------------------------
  // 331 of the 622 achievements are "Have N <building>" / "N of everything". The payback optimizer rarely tops up
  // weak buildings, so the next unearned threshold is bought whenever it costs <= fillSec x CpS and <= 25% of the bank.
  const strip = (x) => String(x || '').replace(/<[^>]+>/g, '');
  let fillCache = { t: 0, per: {}, every: [] };
  function fillData(g) {
    if (Date.now() - fillCache.t < 30000) return fillCache;
    const per = {}, every = [];
    for (const a of Object.values(g.AchievementsById)) {
      if (!a || a.won || a.pool === 'shadow' || a.pool === 'dungeon') continue;
      const m = /^Have (?:at least )?([\d,]+) ([^.]+)\./.exec(strip(a.desc));
      if (!m) continue;
      const n = Number(m[1].replace(/,/g, '')), what = m[2].toLowerCase().trim();
      if (what === 'of everything') every.push(n); else (per[what] = per[what] || []).push(n);
    }
    return (fillCache = { t: Date.now(), per, every });
  }
  CCA.fillPlan = (g) => {
    g = g || G();
    const { per, every } = fillData(g), out = [];
    for (const o of g.ObjectsById) {
      if (o.locked) continue;
      const ts = (per[String(o.single).toLowerCase()] || []).concat(per[String(o.plural).toLowerCase()] || [], every).filter(t => t > o.amount);
      if (!ts.length) continue;
      const t = Math.min(...ts), n = t - o.amount;
      out.push({ o, t, n, cost: o.getSumPrice(n) });
    }
    return out;
  };
  function buyBulk(o, n, why) {
    const g = G(), before = o.amount, c0 = g.cookies;
    o.buy(n);
    const got = o.amount - before;
    if (got > 0) { CCA.stat('bought', got); CCA.record('building', o.name, got, c0 - g.cookies, why); }
    return got;
  }
  function fillStep(g, cookies, cps) {
    if (!cfg.fill || !cfg.buyBuildings) return false;
    const plan = CCA.fillPlan(g).filter(p => p.cost <= cfg.fillSec * cps && p.cost <= cookies * 0.25).sort((a, b) => a.cost - b.cost);
    if (!plan.length) return false;
    const p = plan[0];
    if (buyBulk(p.o, p.n, 'fill to ' + p.t)) { fillCache.t = 0; return true; }
    return false;
  }

  CCA.econ = { bestPayback: Infinity, target: null };
  function step(g, cands) {
    const cps = g.unbuffedCps || g.cookiesPs || 1;
    const reserve = (Number(cfg.bankMult) || 0) * cps;   // Lucky pays 15% of bank, capped at 15 min of CpS => 6000 x CpS
    const cookies = g.cookies;

    // cheap zero-income upgrades (golden-cookie boosts, unlocks, achievement counts) first so they are never starved
    const cheap = cands.filter(c => c.kind === 'u' && c.d <= 0 && c.price <= cookies * 0.01).sort((a, b) => a.price - b.price)[0];
    if (cheap) return doBuy(cheap) ? 'bought' : 'stop';
    if (fillStep(g, cookies, cps)) return 'bought';

    // best = lowest payback period. Time-to-afford counts the bank only for purchases that would not pay
    // themselves back within bankBreakSec (holding cash for Lucky only beats investing when payback is long).
    let best = null;
    for (const c of cands) {
      if (c.d <= 0) continue;
      c.payback = c.price / c.d;
      const spare = c.payback < cfg.bankBreakSec ? cookies : cookies - reserve;
      c.pp = Math.max(c.price - Math.max(spare, 0), 0) / cps + c.payback;
      if (!best || c.pp < best.pp) best = c;
    }
    CCA.econ.bestPayback = best ? best.payback : Infinity;
    CCA.econ.target = best;
    if (!best) { CCA.status.target = 'nothing to buy'; return 'stop'; }
    const canAfford = cookies >= best.price && (best.payback < cfg.bankBreakSec || cookies - best.price >= reserve);
    CCA.status.target = best.name + (canAfford ? '' : ' in ' + CCA.dur(Math.max(best.price - cookies, 0) / cps * 1000));
    return canAfford && doBuy(best) ? 'bought' : 'stop';
  }

  // Each pass re-evaluates after every purchase (synergies change the ranking), within a time budget so the
  // game never stutters. Early game that is several buys per pass; late game one or two.
  CCA.optimize = (budgetMs = 12) => {
    if (!cfg.buyBuildings && !cfg.buyUpgrades) return;
    if (CCA.locked()) { CCA.status.target = 'paused (lump harvest)'; return; }
    const g = G(), prevMode = g.buyMode, t0 = performance.now();
    g.buyMode = 1;                                       // buy() would SELL in sell mode; restore the player's mode after
    try {
      while (performance.now() - t0 < budgetMs) if (step(g, candidates(g)) !== 'bought') break;
    } finally { g.buyMode = prevMode; }
  };
  CCA.every('optimizer', 250, () => CCA.optimize());

  // ---- pre-ascend spend-down ------------------------------------------------------------------------
  // Right before ascending the bank is worthless (cookies do not carry over), so turn it into things that do count:
  // building-count achievements, upgrade-count achievements, then whatever the optimizer likes, ignoring the reserve.
  CCA.spendAll = () => {
    const g = G(), prevMode = g.buyMode; g.buyMode = 1;
    let n = 0;
    try {
      for (let guard = 0; guard < 400; guard++) {          // cheapest next "Have N" threshold first
        const p = CCA.fillPlan(g).filter(p => p.cost <= g.cookies).sort((a, b) => a.cost - b.cost)[0];
        if (!p) break;
        if (!buyBulk(p.o, p.n, 'pre-ascend fill')) break;
        fillCache.t = 0; n++;
      }
      for (let guard = 0; guard < 5000; guard++) {         // then anything affordable, cheapest first (count achievements)
        let c = null;                                      // plain price scan: no virtual purchases, this can be thousands of buys
        for (const o of g.ObjectsById) if (!o.locked) { const p = o.getPrice(); if (p <= g.cookies && (!c || p < c.price)) c = { kind: 'b', ref: o, name: o.name, price: p }; }
        if (CCA.canBuyUpgrades()) for (const u of g.UpgradesInStore) {
          if (u.bought || u.pool === 'toggle' || u.pool === 'debug' || SKIP.test(u.name) || u.priceLumps > 0 || u.clickFunction || (u.isVaulted && u.isVaulted())) continue;
          const p = u.getPrice(); if (p <= g.cookies && (!c || p < c.price)) c = { kind: 'u', ref: u, name: u.name, price: p };
        }
        if (!c || !doBuy(c, 'pre-ascend')) break;
        n++;
      }
    } finally { g.buyMode = prevMode; }
    return n;
  };

  // ---- Godzamok combo ----------------------------------------------------------------------------
  // With Godzamok slotted, selling buildings starts Devastation: clicks +1% per building sold for 10 s (ruby 0.5%, jade
  // 0.25%). Buying them straight back in the same frame keeps the buff and CpS never drops, so the only cost is the
  // sell loss (75% of their price, less with Earth Shatterer). Late in a run the cheap buildings cost almost nothing next
  // to 10 s of clicks, and during a Click frenzy a combo multiplies x777 clicks again.
  // Value per building sold = measured clicks/s x click value integrated over the next 10 s (buffs that end sooner are
  // accounted for) x 1%. A building type is sold only when that beats its sell loss godzamokMargin times (6.1: 2x, was
  // 3x; the estimate has been reliable, see the "est. Nx return" on the Godzamok row), and all losses together stay
  // under half the bank. Never sold: Grandmas (selling the last one cancels the Elder Pledge and pops every wrinkler)
  // and the minigame buildings.
  const NO_SELL = new Set(['Grandma', 'Farm', 'Bank', 'Temple', 'Wizard tower']);
  const samples = [];
  function clicksPerSec() {
    const t = performance.now(), c = CCA.stats.clicks || 0;
    samples.push({ t, c });
    while (samples.length > 2 && t - samples[0].t > 2500) samples.shift();
    const a = samples[0];
    return t - a.t > 900 ? (c - a.c) * 1000 / (t - a.t) : 0;   // measured: background tabs throttle the click timer
  }
  function clickValue(g, T) {                            // cookies per click, summed over the next T seconds
    const bs = []; let all = 1;
    for (const n in g.buffs) { const b = g.buffs[n]; if (b.multClick && b.multClick !== 1) { bs.push({ m: b.multClick, t: b.time / g.fps }); all *= b.multClick; } }
    bs.sort((a, b) => a.t - b.t);
    let sum = 0, at = 0, m = all;
    for (const b of bs) { const end = Math.min(b.t, T); if (end > at) { sum += m * (end - at); at = end; } m /= b.m; }
    if (T > at) sum += m * (T - at);
    return g.computedMouseCps / all * sum;
  }
  let lastComboLog = 0;
  CCA.godzamok = () => {
    const g = G(), cps = clicksPerSec();
    if (!cfg.godzamok || !cfg.master || !cfg.clicker || !CCA.ok() || CCA.locked() || !g.hasGod) return;
    const lvl = g.hasGod('ruin');
    if (!lvl || g.hasBuff('Devastation') || g.hasBuff('Cursed finger') || (CCA.clickAllowed && !CCA.clickAllowed(g)) || cps < 5) return;
    const k = [0, 0.01, 0.005, 0.0025][lvl], per = cps * clickValue(g, 10) * k;
    const opts = [];
    for (const o of g.ObjectsById) {
      if (o.locked || o.amount < 1 || NO_SELL.has(o.name)) continue;
      const A = o.amount, back = o.getReverseSumPrice(A);   // slightly under the real refund (the game sells at the higher price)
      o.amount = 0; let rebuy; try { rebuy = o.getSumPrice(A); } finally { o.amount = A; }
      const loss = rebuy - back;
      if (A * per >= (Number(cfg.godzamokMargin) || 3) * loss) opts.push({ o, A, loss });
    }
    if (!opts.length) return;
    opts.sort((a, b) => a.loss / a.A - b.loss / b.A);
    const picks = []; let loss = 0, n = 0;
    for (const x of opts) if (loss + x.loss <= g.cookies * 0.5) { picks.push(x); loss += x.loss; n += x.A; }
    if (n < 10) return;
    const prevMode = g.buyMode, c0 = g.cookies, frenzy = Object.values(g.buffs).some(b => b.multClick > 1);
    g.buyMode = 1;                                       // buy() would sell in sell mode
    try {
      for (const x of picks) x.o.sell(x.A);
      for (const x of picks) x.o.buy(x.A);
    } finally { g.buyMode = prevMode; }
    const short = picks.filter(x => x.o.amount < x.A);
    if (short.length) CCA.log('Godzamok: could not rebuy ' + short.map(x => x.o.name).join(', '));
    const spent = c0 - g.cookies, gain = per * n, pct = Math.round(n * k * 100);
    CCA.stat('combos'); CCA.stat('comboGain', gain); CCA.stat('comboCost', spent);
    CCA.status.godzamok = `${CCA.stats.combos} combos this session, last +${pct}% clicks, est. ${CCA.fmt(CCA.stats.comboGain / Math.max(1, CCA.stats.comboCost))}x return`;
    if (frenzy || Date.now() - lastComboLog > 60000) {
      lastComboLog = Date.now();
      CCA.log(`Godzamok: sold and rebought ${n} buildings (${picks.map(x => x.o.name).join(', ')}) for +${pct}% clicks, cost ${CCA.fmt(spent)}, worth ≈${CCA.fmt(gain)}`);
    }
  };
  CCA.every('godzamok', 250, () => CCA.godzamok());

  console.log('[CCA] economy loaded');
})();
