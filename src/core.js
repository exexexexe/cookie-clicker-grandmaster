/* Cookie Clicker Grandmaster v5 - core: config, scheduler, activity log, purchase log, backups, diagnostics.
 * Checked against the game source v2.058. Modules are isolated: one failing never stops the others.
 * Rule for every module: only do what a player could do (clicks, purchases, minigame buttons, timing).
 * Nothing calls Game.Win or edits counters. */
(() => {
  'use strict';
  if (window.CCA) return;
  const CCA = window.CCA = { version: '5.0.2', stats: {}, status: {}, logs: [], errors: {}, perf: {}, tasks: {} };

  const DEFAULTS = {
    master: true,
    // economy
    clicker: true, clickRate: 30,          // the game ignores clicks closer than 20 ms (50/s)
    golden: true, wrath: false,
    buyBuildings: true, buyUpgrades: true,
    bankMult: 6000,                        // keep this x CpS banked for Lucky (6000 = max payout); 0 = spend everything
    bankBreakSec: 7200,                    // ...but spend the bank on anything that pays back faster than this
    fill: true, fillSec: 600,              // buy "Have N <building>" thresholds that cost <= fillSec x CpS
    // sugar lumps
    lumps: true, spendLumps: true,
    lumpTiming: true,                      // time each harvest to the millisecond that makes the NEXT lump golden
    lumpTricks: true,                      // at harvest: Rigidel swap-in, Dragon's Curve aura, building count ending in 0
    // minigames
    grimoire: true, combo: true,
    // diamond, ruby, jade. Golden cookies (Click frenzy = x777 clicks) are the biggest income for an auto-clicker, so no
    // god that makes them rarer. Godzamok powers the sell-and-rebuy combo (+1% clicks per building sold, see economy.js),
    // Muridal +10% clicks, Selebrak makes golden cookies a little more frequent in any season.
    pantheon: true, pantheonSlots: ['ruin', 'labor', 'seasons'],
    godzamok: true,                        // sell cheap buildings and buy them straight back for Godzamok's click buff
    dragon: true,
    wrinklers: true,
    garden: true, gardenPlanner: true,
    market: true,
    marketBuyBelow: 0,                     // buy when price <= this x resting value; 0 = auto from the broker fee (0.6 to 0.75)
    marketSellAt: 2.5,                     // sell at this x resting value; the usual exit is the first fast fall above cost
    marketSpendPct: 0.8,                   // share of cookies above the Lucky bank the market may use per tick
    marketGateSec: 3600,                   // ...only while the best building/upgrade pays back slower than this
    seasons: true,
    // achievements
    hunt: true,                            // one-off achievement hunters (hunts.js)
    challenges: true,                      // run Neverclick / Hardcore automatically on a fresh run when it is cheap
    // meta
    backups: true,
    ascend: true, ascendMinMinutes: 15, ascendMinGain: 1.05,
    cfgVer: 502,
    ui: { collapsed: false, tab: 'overview', filter: 'all' },
  };
  const KEY = 'cca5.cfg';
  const cfg = CCA.cfg = JSON.parse(JSON.stringify(DEFAULTS));
  try {
    const cur = localStorage.getItem(KEY);
    const saved = cur ? JSON.parse(cur) : null;
    if (saved) Object.assign(cfg, saved);
    else {                                 // migrate plain switches from v4; its tuning defaults are not carried over
      const old = JSON.parse(localStorage.getItem('cca4.cfg') || '{}');
      for (const k of ['master', 'clicker', 'golden', 'wrath', 'buyBuildings', 'buyUpgrades', 'lumps', 'spendLumps', 'grimoire',
        'pantheon', 'dragon', 'wrinklers', 'garden', 'gardenPlanner', 'market', 'seasons', 'hunt', 'backups', 'ascend', 'clickRate'])
        if (k in old) cfg[k] = old[k];
    }
    cfg.ui = Object.assign({}, DEFAULTS.ui, cfg.ui);
    if (saved && !(saved.cfgVer >= 502)) {
      // older defaults -> current ones; market tuning is reset because the old numbers were worse (tools/market-search.mjs)
      if (['["mother","labor","industry"]', '["labor","seasons"]'].includes(JSON.stringify(cfg.pantheonSlots))) cfg.pantheonSlots = DEFAULTS.pantheonSlots.slice();
      for (const k of ['marketBuyBelow', 'marketSellAt', 'marketSpendPct', 'marketGateSec']) cfg[k] = DEFAULTS[k];
      cfg.cfgVer = DEFAULTS.cfgVer;
    }
  } catch (e) {}
  CCA.defaults = DEFAULTS;
  CCA.save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };

  // ---- helpers -------------------------------------------------------------
  const G = CCA.G = () => window.Game;
  CCA.ok = () => { const g = G(); return !!(g && g.ready && !g.OnAscend && !(g.AscendTimer > 0) && !(g.ReincarnateTimer > 0)); };
  CCA.stat = (k, n = 1) => { CCA.stats[k] = (CCA.stats[k] || 0) + n; };
  CCA.won = (n) => !!G().HasAchiev(n);
  CCA.minigame = (building) => {
    const o = G() && G().Objects[building];
    return (o && o.minigameLoaded && o.minigame) ? o.minigame : null;
  };
  CCA.fmt = (v) => {                       // the game's own number formatting, with a fallback before it loads
    v = Number(v) || 0;
    if (typeof window.Beautify === 'function') return v < 1000 ? String(Math.round(v * 10) / 10) : window.Beautify(v);
    return v.toExponential(2);
  };
  CCA.dur = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
    if (s < 86400) return Math.floor(s / 3600) + 'h ' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + 'm';
    return Math.floor(s / 86400) + 'd ' + Math.floor(s % 86400 / 3600) + 'h';
  };

  // Building purchases are paused while another module needs the building count to stay put
  // (lump harvest wants it to end in 0). lock(name, ms) expires on its own so a crash cannot freeze buying.
  const locks = {};
  CCA.lock = (name, ms) => { if (ms > 0) locks[name] = Date.now() + ms; else delete locks[name]; };
  CCA.locked = () => { const t = Date.now(); for (const k in locks) { if (locks[k] > t) return true; delete locks[k]; } return false; };

  // Upgrade purchases are paused during a Hardcore attempt (set by hunts.js).
  CCA.canBuyUpgrades = () => !(CCA.challenge && CCA.challenge.hardcore);

  // ---- activity log ----------------------------------------------------------
  const stamp = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0'); };
  CCA.log = (msg) => {
    CCA.logs.push({ t: stamp(), msg }); if (CCA.logs.length > 300) CCA.logs.shift();
    CCA.logRev = (CCA.logRev || 0) + 1;
    console.log('[CCA] ' + msg);
  };

  // ---- purchase log ------------------------------------------------------------
  // Everything the bot spends on, kept apart from the activity log and persisted across reloads.
  // Plain building buys of the same building within 2 minutes merge into one row (the optimizer alternates between
  // a few buildings, so the last 12 rows are searched), which keeps the list readable.
  const PKEY = 'cca5.purchases', PMAX = 4000;
  let buys = [];
  try { buys = JSON.parse(localStorage.getItem(PKEY) || '[]'); } catch (e) {}
  let buysDirty = false;
  CCA.purchases = () => buys;
  CCA.record = (kind, name, qty = 1, cost = 0, note = '') => {
    const now = Date.now();
    let hit = -1;
    if (kind === 'building' && !note) {
      for (let i = buys.length - 1; i >= Math.max(0, buys.length - 12); i--) {
        const b = buys[i];
        if (now - b.t > 120000) break;
        if (b.k === kind && b.n === name && !b.x) { hit = i; break; }
      }
    }
    if (hit >= 0) {
      const b = buys.splice(hit, 1)[0];
      b.q += qty; b.c += cost; b.t = now; buys.push(b);
    } else {
      buys.push({ t: now, k: kind, n: name, q: qty, c: cost, x: note });
      if (buys.length > PMAX) buys.splice(0, buys.length - PMAX);
    }
    buysDirty = true; CCA.buyRev = (CCA.buyRev || 0) + 1;
  };
  CCA.clearPurchases = () => { buys = []; buysDirty = true; CCA.buyRev = (CCA.buyRev || 0) + 1; };
  setInterval(() => {
    if (!buysDirty) return;
    buysDirty = false;
    try { localStorage.setItem(PKEY, JSON.stringify(buys)); }
    catch (e) { buys.splice(0, Math.floor(buys.length / 2)); buysDirty = true; }   // quota: drop the oldest half
  }, 5000);
  CCA.purchasesCSV = () => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    return 'time,kind,item,qty,cookies,note\n' + buys.map(b => [new Date(b.t).toISOString(), b.k, q(b.n), b.q, b.c, q(b.x || '')].join(',')).join('\n');
  };

  // ---- scheduler -------------------------------------------------------------
  CCA.every = (name, ms, fn, opts = {}) => {
    let errs = 0;
    CCA.tasks[name] = { fn, ms, always: !!opts.always };    // also lets tests drive tasks by hand
    setInterval(() => {
      if (!cfg.master) return;
      if (!opts.always && !CCA.ok()) return;
      const t0 = performance.now();
      try { fn(); errs = 0; delete CCA.errors[name]; }
      catch (e) { CCA.errors[name] = e.message; if (++errs === 1 || errs % 100 === 0) CCA.log(name + ' error: ' + e.message); }
      const p = CCA.perf[name] || (CCA.perf[name] = { avg: 0, max: 0, n: 0 }), dt = performance.now() - t0;
      p.n++; p.avg += (dt - p.avg) / Math.min(p.n, 50); p.max = Math.max(p.max * 0.999, dt);
    }, ms);
  };

  // ---- backups -------------------------------------------------------------
  CCA.backup = (why) => {
    try {
      const s = G().WriteSave(1);
      if (typeof s !== 'string' || s.length < 100) throw new Error('empty save');
      let arr = CCA.backups();
      arr.push({ t: Date.now(), why, s });
      for (let keep = 5; ; keep--) {                      // shrink on quota errors instead of silently failing
        arr = arr.slice(-keep);
        try { localStorage.setItem('cca.backups', JSON.stringify(arr)); break; }
        catch (e) { if (keep <= 1) throw e; }
      }
      CCA.log('backup saved (' + why + ')');
      return true;
    } catch (e) { CCA.log('backup failed: ' + e.message); return false; }
  };
  CCA.backups = () => { try { return JSON.parse(localStorage.getItem('cca.backups') || '[]'); } catch (e) { return []; } };
  CCA.restore = (i = -1) => {                             // CCA.restore() loads the newest backup; CCA.restore(0) the oldest
    const arr = CCA.backups(); const b = i < 0 ? arr[arr.length - 1] : arr[i];
    if (!b) return CCA.log('no such backup');
    G().ImportSaveCode(b.s); CCA.log('restored backup from ' + new Date(b.t).toLocaleString());
  };
  setTimeout(() => { if (cfg.backups && CCA.ok() && !CCA.backups().length) CCA.backup('first run'); }, 20000);
  CCA.every('backup', 60 * 1000, () => {
    if (!cfg.backups) return;
    const last = CCA.backups().slice(-1)[0];
    if (!last || Date.now() - last.t > 10 * 60 * 1000) CCA.backup('auto');
  });

  // ---- diagnostics: CCA.diag() in the console if something stops working after a game update ----
  CCA.diag = () => {
    const g = G(), out = { version: g.version };
    for (const f of ['ClickCookie', 'CalculateGains', 'WriteSave', 'ImportSaveCode', 'UpgradeDragon', 'Ascend', 'Reincarnate', 'clickLump',
      'computeLumpType', 'computeLumpTimes', 'PurchaseHeavenlyUpgrade', 'PutUpgradeInPermanentSlot']) out['Game.' + f] = typeof g[f];
    for (const [b, fns] of [['Farm', ['harvest', 'useTool', 'isTileUnlocked', 'getMuts']], ['Temple', ['slotGod', 'useSwap']],
      ['Wizard tower', ['castSpell', 'getSpellCost', 'getFailChance']], ['Bank', ['buyGood', 'sellGood', 'getRestingVal', 'getGoodMaxStock']]]) {
      const M = CCA.minigame(b); out[b] = M ? 'loaded' : 'not loaded (level 0?)';
      if (M) for (const f of fns) out[b + '.' + f] = typeof M[f];
    }
    for (const k in CCA.perf) out['ms ' + k] = CCA.perf[k].avg.toFixed(2) + ' avg / ' + CCA.perf[k].max.toFixed(1) + ' max';
    console.table(out); return out;
  };

  window.addEventListener('keydown', (e) => { if (e.key === 'F8') { cfg.master = !cfg.master; CCA.save(); e.preventDefault(); CCA.log(cfg.master ? 'resumed' : 'paused'); } });
  console.log('[CCA] core v' + CCA.version + ' loaded');
})();
