/* v5 economy: clicker (veil-aware), golden cookies, purchase optimizer, building-count filler, pre-ascend spend-down. */
(() => {
  'use strict';
  const CCA = window.CCA, cfg = CCA.cfg, G = CCA.G;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rate = () => (cfg.clicker ? clamp(Number(cfg.clickRate) || 0, 0, 50) : 0);

  // ---------------------------------------------------------------- clicker
  // The Shimmering veil (+50% CpS) breaks on the first click of a run. That is deliberate: in game code the veil is up
  // while you own "Shimmering veil [off]" (v4 read it backwards and stopped clicking for the rest of the run once it
  // broke), and with mouse upgrades 30 clicks/s are worth several times the veil. Thick-skinned still comes by itself:
  // each run's first click has the Reinforced membrane's 10% chance to be protected.
  let clickTimer = null;
  function click() {
    if (!cfg.master || !cfg.clicker || !CCA.ok()) return;
    const g = G();
    if (CCA.clickAllowed && !CCA.clickAllowed(g)) return;
    const before = g.cookieClicks;
    g.ClickCookie();
    CCA.stat('clicks', g.cookieClicks - before);
  }
  CCA.setClickRate = () => {
    clearInterval(clickTimer);
    clickTimer = setInterval(click, Math.max(20, 1000 / clamp(Number(cfg.clickRate) || 30, 1, 50)));
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
  const income = (g, m) => (g.unbuffedCps || 0) + g.computedMouseCps / m.k * rate();

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
          try { g.CalculateGains(); } finally { o.amount--; g.BuildingsOwned--; }
          out.push({ kind: 'b', ref: o, name: o.name, price, d: income(g, m) - base });
        }
      }
      if (cfg.buyUpgrades && CCA.canBuyUpgrades()) {
        for (const u of g.UpgradesInStore) {
          if (u.bought || u.pool === 'toggle' || u.pool === 'debug' || SKIP.test(u.name)) continue;
          if (u.priceLumps > 0 || u.clickFunction || (u.isVaulted && u.isVaulted())) continue;
          const price = u.getPrice();
          u.bought = 1;
          try { g.CalculateGains(); } finally { u.bought = 0; }
          out.push({ kind: 'u', ref: u, name: u.name, price, d: income(g, m) - base });
        }
      }
    } finally { g.CalculateGains(); g.cookiesPsRawHighest = hi; }
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

  console.log('[CCA] economy loaded');
})();
