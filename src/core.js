/* Cookie Clicker Grandmaster v5 - core: config, scheduler, activity log, purchase log, backups, diagnostics.
 * Checked against the game source v2.058. Modules are isolated: one failing never stops the others.
 * Rule for every module: only do what a player could do (clicks, purchases, minigame buttons, timing).
 * Nothing calls Game.Win or edits counters. */
(() => {
  'use strict';
  if (window.CCA) return;
  const CCA = window.CCA = { version: '6.1.7', stats: {}, status: {}, logs: [], errors: {}, perf: {}, tasks: {} };

  const DEFAULTS = {
    master: true,
    // economy
    clicker: true, clickRate: 30,          // the game ignores clicks closer than 20 ms (50/s)
    golden: true, wrath: true,             // after the grandmapocalypse almost every golden cookie is a wrath cookie
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
    godzamokMargin: 2,                     // ...when the estimated gain is at least this x the sell loss
    dragon: true,
    dragonMidTrain: true,                  // train the last two levels mid-run when the second aura outweighs the sacrifice
    comboAuras: true,                      // swap a dragon aura for the length of a combo when it pays for the sacrifice
    wrinklers: true,
    garden: true, gardenPlanner: true,
    market: true,
    marketBuyBelow: 0,                     // buy when price <= this x resting value; 0 = auto from the broker fee (0.6 to 0.75)
    marketSellAt: 2.5,                     // sell at this x resting value; the usual exit is the first fast fall above cost
    marketSpendPct: 0.8,                   // share of cookies above the Lucky bank the market may use per tick
    marketGateSec: 3600,                   // ...only while the best building/upgrade pays back slower than this
    seasons: true,                         // switch seasons (Christmas is the home season: Santa, reindeer, Selebrak)
    seasonHunt: true,                      // ...and hunt the seasonal drops for their achievements
    dropPopMin: 10,                        // pop wrinklers for drops once attached this many minutes (0 = at once)
    lumpReserve: true,                     // with Sugar baking: keep 100 lumps (+1% CpS each) after the minigame levels
    levelTen: true,                        // with Sugar crystal cookies: count the +1% CpS of every building at level 10
    // achievements
    stockAch: true,                        // stock market achievements, bought with the bank right before ascending
    luckyAscend: true,                     // time the ascension so the prestige level has the 7s the Lucky upgrades need
    guard: true,                           // switch a 6.1 feature off if CpS drops after it acts, twice
    hunt: true,                            // one-off achievement hunters (hunts.js)
    challenges: true,                      // run Neverclick / Hardcore automatically on a fresh run when it is cheap
    // meta
    backups: true,
    // display
    keepAlive: true,                       // keep the bot and the game at full speed in a hidden or covered tab
    blackout: false,                       // black screen over the game (F9); the bot keeps playing underneath
    ascend: true, ascendMinMinutes: 15, ascendMinGain: 1.05,
    cfgVer: 610,
    preset: 'balanced',
    ui: { collapsed: false, tab: 'overview', filter: 'all' },
  };
  // Presets set every playing switch at once (display switches are left alone). Balanced is the recommended one and
  // what a fresh install starts with; they differ in how hard the seasonal drops are hunted, the one real trade-off
  // between growth and achievements (popping wrinklers early for drops gives up their x1.1 payout).
  const PRESET_KEYS = ['clicker', 'clickRate', 'golden', 'wrath', 'buyBuildings', 'buyUpgrades', 'bankMult', 'fill', 'fillSec',
    'lumps', 'lumpTiming', 'lumpTricks', 'spendLumps', 'lumpReserve', 'levelTen', 'grimoire', 'combo', 'pantheon', 'godzamok',
    'godzamokMargin', 'comboAuras', 'dragonMidTrain', 'dragon', 'wrinklers', 'garden', 'market', 'marketBuyBelow', 'marketSellAt', 'seasons',
    'seasonHunt', 'dropPopMin', 'hunt', 'stockAch', 'luckyAscend', 'ascend', 'ascendMinMinutes', 'backups', 'guard'];   // display switches (keepAlive, blackout, notify) are the player's
  const base = {}; for (const k of PRESET_KEYS) base[k] = DEFAULTS[k];
  CCA.PRESETS = {
    fastest: { name: 'Fastest growth', hint: 'No seasonal drop hunting: wrinklers stay on and pay out. Christmas stays on.', v: Object.assign({}, base, { seasonHunt: false }) },
    balanced: { name: 'Balanced', hint: 'Recommended. Everything on; wrinklers are popped for drops once they have fed for 10 min.', v: Object.assign({}, base) },
    achievements: { name: 'Achievements', hint: 'Drops as fast as possible (wrinklers popped at once), count achievements bought sooner.', v: Object.assign({}, base, { dropPopMin: 0, fillSec: 1800 }) },
  };
  CCA.applyPreset = (id) => { const p = CCA.PRESETS[id]; if (!p) return; Object.assign(cfg, p.v); cfg.preset = id; CCA.save(); CCA.log('preset: ' + p.name); };
  CCA.presetDiff = () => { const p = CCA.PRESETS[cfg.preset]; return p ? PRESET_KEYS.filter(k => cfg[k] !== p.v[k]) : []; };
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
    if (saved && !(saved.cfgVer >= 600)) { cfg.wrath = true; cfg.cfgVer = DEFAULTS.cfgVer; }
    // 6.1: every install starts once from the recommended preset (asked for); later changes are kept
    if (saved && !(saved.cfgVer >= 610)) { Object.assign(cfg, CCA.PRESETS.balanced.v); cfg.preset = 'balanced'; cfg.cfgVer = DEFAULTS.cfgVer; CCA.migrated610 = true; }
  } catch (e) {}
  CCA.defaults = DEFAULTS;
  CCA.save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };

  // ---- helpers -------------------------------------------------------------
  const G = CCA.G = () => window.Game;

  // ---- timers ----------------------------------------------------------------
  // Browsers slow the timers of a hidden or fully covered tab to once a second or less. Timers inside a worker are not
  // slowed, so every bot timer runs from one (the game's CSP allows worker-src blob:). If the worker cannot start, the
  // window's own timers are used, as before.
  (() => {
    const cbs = new Map();
    let seq = 0, w = null;
    try {
      const src = 'const t={};onmessage=(e)=>{const[o,id,ms]=e.data;' +
        'if(o===1)t[id]=setInterval(()=>postMessage(id),ms);' +
        'else if(o===2)t[id]=setTimeout(()=>{delete t[id];postMessage(id)},ms);' +
        'else{clearInterval(t[id]);clearTimeout(t[id]);delete t[id]}}';
      w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = (e) => { const c = cbs.get(e.data); if (!c) return; if (!c.rep) cbs.delete(e.data); c.fn(); };
    } catch (e) { w = null; }
    CCA.workerTimers = !!w;
    CCA.setInterval = (fn, ms) => { if (!w) return window.setInterval(fn, ms); const id = ++seq; cbs.set(id, { fn, rep: true }); w.postMessage([1, id, ms]); return id; };
    CCA.setTimeout = (fn, ms = 0) => { if (!w) return window.setTimeout(fn, ms); const id = ++seq; cbs.set(id, { fn, rep: false }); w.postMessage([2, id, ms]); return id; };
    CCA.clearInterval = CCA.clearTimeout = (id) => { if (!w) { window.clearInterval(id); window.clearTimeout(id); return; } cbs.delete(id); w.postMessage([0, id]); };
  })();
  // CalculateGains on a virtual state (a building or upgrade tried on, an aura or god swapped in) would also award the
  // CpS achievements that state reaches (main.js: Game.Win inside CalculateGains), which the player never earned. Every
  // virtual evaluation goes through this: Win is muted for the call, and the game is asked to recalculate on its own
  // next frame, from the real state, so real thresholds are still awarded the normal way.
  CCA.quietGains = (g) => { const w = g.Win; g.Win = function () {}; try { g.CalculateGains(); } finally { g.Win = w; g.recalculateGains = 1; } };
  // Pantheon moves go through the game's own drag-and-drop (dragGod + dropGod over a slot, or over the roster with
  // slot -1), muted. That is exactly a player's drag: it spends the swap and moves the god pictures on screen too
  // (calling M.slotGod alone left the temple showing the old layout). Falls back to the data call if the DOM is missing.
  CCA.placeGod = (M, god, slot) => {
    const g = G();
    if (!god) return false;
    if (typeof M.dragGod === 'function' && typeof M.dropGod === 'function' && document.getElementById('templeGod' + god.id)) {
      const vol = g.volume, hov = M.slotHovered; g.volume = 0;
      try { M.dragGod(god); M.slotHovered = slot; M.dropGod(); } finally { M.slotHovered = hov === undefined ? -1 : hov; M.dragging = false; g.volume = vol; }
    } else {
      if (slot !== -1) M.useSwap(1);
      M.slotGod(god, slot);
    }
    return god.slot === slot;
  };
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

  // ---- guard ---------------------------------------------------------------------
  // The 6.1 features that sacrifice or swap things (mid-run dragon training, combo auras) call guardWatch when they
  // act. Three minutes later unbuffed CpS is compared; a drop of more than 10% (same run) is a strike, and two strikes
  // in a row switch that feature off, with a log line and a notification. Buildings the bot buys meanwhile only raise
  // CpS, so a real drop means the feature misjudged.
  const strikes = {};
  CCA.guardWatch = (key) => {
    const g = G(); if (!cfg.guard || !g) return;
    const c0 = g.unbuffedCps, run = g.startDate;
    CCA.setTimeout(() => {
      const g = G(); if (!g || !g.ready || g.startDate !== run || !(c0 > 0)) return;
      const r = g.unbuffedCps / c0;
      if (r >= 0.9) { strikes[key] = 0; return; }
      strikes[key] = (strikes[key] || 0) + 1;
      CCA.log(`guard: CpS x${r.toFixed(2)} three minutes after ${key} acted (strike ${strikes[key]}/2)`);
      if (strikes[key] >= 2 && cfg[key]) {
        cfg[key] = false; CCA.save();
        if (CCA.notify) CCA.notify('Guard switched off ' + key, 'CpS dropped twice after it acted; switch it back on in Settings');
        else CCA.log('guard: switched off ' + key);
      }
    }, 180000);
  };

  // ---- activity log ----------------------------------------------------------
  const stamp = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0'); };
  CCA.log = (msg) => {
    CCA.logs.push({ t: stamp(), msg }); if (CCA.logs.length > 300) CCA.logs.shift();
    CCA.logRev = (CCA.logRev || 0) + 1;
    console.log('[CCA] ' + msg);
  };
  if (CCA.migrated610) { CCA.save(); CCA.log('settings: 6.1 set every playing switch to the recommended preset (Balanced) once; your changes from now on are kept'); }

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
  CCA.setInterval(() => {
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
    CCA.setInterval(() => {
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
  CCA.setTimeout(() => { if (cfg.backups && CCA.ok() && !CCA.backups().length) CCA.backup('first run'); }, 20000);
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

  // ---- keep-alive ------------------------------------------------------------
  // The game's own loop runs on a window timer, so in a background tab it falls behind and only makes up 5 s per tick.
  // This runs the missed logic frames the same way the game's latency compensator in Game.Loop does, so production,
  // buffs and golden cookies keep real time. It also turns off the game's sleep mode, which a slowed loop can trigger.
  let lastT = 0, lastAt = 0;
  CCA.setInterval(() => {
    const g = G();
    if (!cfg.keepAlive || !g || !g.ready || g.timedout) { CCA.status.background = ''; return; }
    if (g.prefs.timeout) { g.prefs.timeout = 0; CCA.log('keep-alive: turned off the game\'s sleep mode'); }
    const step = 1000 / g.fps, now = Date.now(), behind = now - g.time;
    if (behind >= 250) {
      const cap = g.fps * 5, n = Math.min(Math.floor(behind / step), cap);
      g.catchupLogic = 1;
      for (let i = 0; i < n; i++) g.Logic();
      g.catchupLogic = 0;
      g.time = n >= cap ? now : g.time + n * step;
      if (g.accumulatedDelay < 0) g.accumulatedDelay = 0;
    }
    if (now - lastAt >= 5000) {                      // logic frames per second, shown in the panel while hidden
      const fps = lastAt ? (g.T - lastT) * 1000 / (now - lastAt) : g.fps;
      lastT = g.T; lastAt = now;
      CCA.status.background = document.hidden ? `tab hidden · game at ${Math.round(fps)}/${g.fps} fps${CCA.workerTimers ? '' : ' (no worker: slowed)'}` : '';
    }
  }, 250);

  window.addEventListener('keydown', (e) => { if (e.key === 'F8') { cfg.master = !cfg.master; CCA.save(); e.preventDefault(); CCA.log(cfg.master ? 'resumed' : 'paused'); } });
  console.log('[CCA] core v' + CCA.version + ' loaded');
})();
