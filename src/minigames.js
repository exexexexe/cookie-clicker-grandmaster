/* v5 minigames: Grimoire, Pantheon, Dragon, Wrinklers, Garden, Stock market. */
(() => {
  'use strict';
  const CCA = window.CCA, cfg = CCA.cfg, G = CCA.G;

  // ---------------------------------------------------------------- Grimoire
  // The game seeds every spell with Game.seed + '/' + spellsCastTotal, so the next Force the Hand of Fate outcome is
  // known before casting. We replay the spell's RNG calls with a no-count shimmer, cast only good outcomes, and burn
  // bad ones with a cheap spell (which advances the counter). Verified 60/60 against real casts in v4.
  const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
  CCA.predictFtHoF = (M) => {
    const g = G(), hof = M.spells['hand of fate'];
    const failChance = M.getFailChance(hof);
    let out;
    Math.seedrandom(g.seed + '/' + M.spellsCastTotal);
    try {
      if (Math.random() < 1 - failChance) {
        const sh = new g.shimmer('golden', { noWrath: true }, 1);
        const c = ['frenzy', 'multiply cookies'];
        if (!g.hasBuff('Dragonflight')) c.push('click frenzy');
        if (Math.random() < 0.1) c.push('cookie storm', 'cookie storm', 'blab');
        if (g.BuildingsOwned >= 10 && Math.random() < 0.25) c.push('building special');
        let ch = c;
        if (Math.random() < 0.15) ch = ['cookie storm drop'];
        if (Math.random() < 0.0001) ch.push('free sugar lump');
        out = { win: true, force: choose(ch) };
        sh.die();
      } else {
        const sh = new g.shimmer('golden', { wrath: true }, 1);
        const c = ['clot', 'ruin cookies'];
        if (Math.random() < 0.1) c.push('cursed finger', 'blood frenzy');
        if (Math.random() < 0.003) c.push('free sugar lump');
        let ch = c;
        if (Math.random() < 0.1) ch = ['blab'];
        out = { win: false, force: choose(ch) };
        sh.die();
      }
    } finally { Math.seedrandom(); }
    return out;
  };
  const SELF = new Set(['frenzy', 'free sugar lump', 'cookie storm']);          // worth casting on their own
  const STACK = new Set(['multiply cookies', 'click frenzy', 'building special']); // best on top of a running buff
  let fullSince = 0;
  CCA.every('grimoire', 1000, () => {
    if (!cfg.grimoire) return;
    const M = CCA.minigame('Wizard tower'); if (!M) return;
    const g = G();
    const hof = M.spells['hand of fate'], conj = M.spells['conjure baked goods'], hag = M.spells["haggler's charm"];
    const costH = M.getSpellCost(hof);
    CCA.status.magic = `${Math.floor(M.magic)}/${Math.floor(M.magicM)}`;
    const goldenWaiting = g.shimmers.some(s => s.type === 'golden' && !s.dying && (cfg.wrath || !s.wrath));
    const buffed = Object.values(g.buffs).some(b => b.multCpS >= 2);
    if (M.magic >= M.magicM - 0.5) { if (!fullSince) fullSince = Date.now(); } else fullSince = 0;
    const cast = (sp, why) => { M.castSpell(sp); CCA.stat('spells'); if (why) CCA.log(why); };

    if (!cfg.combo) {
      const anyBuff = Object.values(g.buffs).some(b => b.multCpS > 1 || b.multClick > 1);
      if (anyBuff && !goldenWaiting && M.magic >= costH && M.getFailChance(hof) < 0.3) return cast(hof);
      if (!anyBuff && M.magic >= M.magicM - 0.5 && M.magic - M.getSpellCost(conj) >= costH && M.getFailChance(conj) < 0.3) cast(conj);
      return;
    }
    if (goldenWaiting || M.magic < costH) return;
    const pred = CCA.predictFtHoF(M);
    CCA.status.fthof = (pred.win ? '' : 'backfire: ') + pred.force;
    const good = pred.win && (SELF.has(pred.force) || STACK.has(pred.force));
    const useless = good && pred.force === 'frenzy' && buffed;          // would only refresh a running frenzy
    if (good && !useless) {
      const patient = fullSince && Date.now() - fullSince > 10 * 60 * 1000;
      if (SELF.has(pred.force) || buffed || patient) { CCA.stat('combos'); cast(hof, `FtHoF -> ${pred.force}${buffed ? ' (on a buff)' : ''}`); }
      return;                                                           // stacker: wait for a buff
    }
    // Bad or redundant outcome: burn it with a cheap spell. A burner predicted to backfire is skipped when it is
    // Haggler's charm (its backfire makes upgrades pricier for an hour); a backfiring Conjure only costs cookies.
    const wins = (sp) => { Math.seedrandom(g.seed + '/' + M.spellsCastTotal); const r = Math.random(); Math.seedrandom(); return r < 1 - M.getFailChance(sp); };
    const burners = [conj, hag].filter(Boolean).filter(sp => sp !== hag || wins(sp)).sort((a, b) => wins(b) - wins(a));
    for (const sp of burners) {
      if (M.magic >= M.getSpellCost(sp) + costH) { CCA.stat('burns'); return cast(sp, `skipped ${pred.win ? '' : 'a backfiring '}${pred.force} with ${sp.name}`); }
    }
    // Small mana pool: burner + FtHoF never fit under the cap, so burn alone once the bar is full.
    if (M.magic >= M.magicM - 0.5) {
      const cheap = burners.filter(sp => M.magic >= M.getSpellCost(sp)).sort((a, b) => M.getSpellCost(a) - M.getSpellCost(b))[0];
      if (cheap) { CCA.stat('burns'); cast(cheap, `full bar, skipped ${pred.force} with ${cheap.name}`); }
    }
  });

  // ---------------------------------------------------------------- Pantheon
  // Placing a god costs one worship swap, exactly like dragging it in the game (v4 placed into empty slots for free,
  // which the UI never allows). Swaps refill one per hour at 2, per 4 h at 1, per 16 h at 0, so the last one is kept.
  // Holobore is never a sensible pick here: clicking any golden cookie unslots it and burns all swaps.
  CCA.every('pantheon', 10000, () => {
    if (!cfg.pantheon || CCA.locked()) return;
    const M = CCA.minigame('Temple'); if (!M) return;
    let ok = 0;
    cfg.pantheonSlots.forEach((key, slot) => {
      const god = M.gods[key];
      if (!god || slot >= M.slot.length) return;
      if (M.slot[slot] === god.id) { ok++; return; }
      if (key === 'asceticism' && cfg.golden) return;
      if (M.swaps < 2) return;
      M.useSwap(1); M.slotGod(god, slot);
      CCA.log(`slotted ${god.name.split(',')[0]} in the ${['diamond', 'ruby', 'jade'][slot]} slot`); ok++;
    });
    CCA.status.pantheon = `${ok}/${Math.min(cfg.pantheonSlots.length, M.slot.length)} gods, ${M.swaps} swaps`;
  });

  // ------------------------------------------------------------------ Dragon
  // The dragon resets on every ascension. Each level after the 4 cookie levels sacrifices 100 of one building, so a
  // level is bought when rebuying those buildings costs <= 15 min of CpS. Full training ("Here be dragon": 50 then 200
  // of every building) happens in the pre-ascend spend-down, when buildings are worthless anyway.
  const AURA_PRIORITY = [15, 3, 1, 2];                 // Radiant Appetite, Elder Battalion, Breath of Milk, Dragon Cursor
  const auraLevel = (a) => a + 4;
  function setAura(slot, aura) {                      // same effect as the aura menu's Confirm: costs 1 of your highest building
    const g = G();
    if ((slot === 0 ? g.dragonAura : g.dragonAura2) === aura) return;
    let highest = null;
    for (const o of g.ObjectsById) if (o.amount > 0) highest = o;
    if (slot === 0) g.dragonAura = aura; else g.dragonAura2 = aura;
    if (highest) highest.sacrifice(1);
    g.recalculateGains = 1;
    CCA.record('dragon', 'aura: ' + g.dragonAuras[aura].name, 1, 0, highest ? '1 ' + highest.single + ' sacrificed' : '');
    CCA.log(`dragon aura -> ${g.dragonAuras[aura].name}`);
  }
  const levelCostsBuildings = (g, lvl) => (lvl >= 5 ? g.ObjectsById[lvl - 5] || null : null);   // level i sacrifices 100 of building i-5
  CCA.dragonStep = (full) => {
    const g = G();
    if (!g.Has('A crumbly egg')) return false;
    const cps = g.unbuffedCps || g.cookiesPs || 1;
    let did = false;
    for (let guard = 0; guard < 30 && g.dragonLevel < g.dragonLevels.length - 1; guard++) {
      const lvl = g.dragonLevel, lv = g.dragonLevels[lvl];
      if (!lv.cost() && full) {                          // pre-ascend: buy back what this level sacrifices (the bank is worthless now)
        const o = levelCostsBuildings(g, lvl), every = /(\d+)/.exec(String(lv.costStr ? lv.costStr() : ''));
        const needs = o ? [[o, 100]] : lvl >= 5 && every ? g.ObjectsById.map(b => [b, Number(every[1])]) : [];
        const prev = g.buyMode; g.buyMode = 1;
        try { for (const [b, n] of needs) if (b.amount < n && b.getSumPrice(n - b.amount) <= g.cookies) { const c0 = g.cookies, k = n - b.amount; b.buy(k); CCA.record('building', b.name, k, c0 - g.cookies, 'for dragon training'); } }
        finally { g.buyMode = prev; }
      }
      if (!lv.cost()) break;
      if (!full) {
        const o = levelCostsBuildings(g, lvl);
        if (lvl >= 5 && !o) break;                    // "every building" levels: only in full mode
        if (o && o.getSumPrice(100) / Math.pow(1.15, 100) > cps * 900) break;
      }
      const before = g.dragonLevel;
      g.UpgradeDragon();
      if (g.dragonLevel === before) break;
      CCA.record('dragon', 'dragon level ' + g.dragonLevel, 1, 0, lv.name || '');
      did = true;
    }
    return did;
  };
  CCA.every('dragon', 5000, () => {
    if (!cfg.dragon || CCA.locked()) return;
    const g = G();
    if (!g.Has('A crumbly egg')) return;
    if (CCA.dragonStep(false)) CCA.log('dragon -> level ' + g.dragonLevel);
    CCA.status.dragon = `level ${g.dragonLevel}/${g.dragonLevels.length - 1}` + (g.dragonAura ? ', ' + g.dragonAuras[g.dragonAura].name : '');
    const best = AURA_PRIORITY.find(a => g.dragonLevel >= auraLevel(a) && g.dragonAura2 !== a);
    if (best && g.dragonAura !== best) setAura(0, best);
  });

  // --------------------------------------------------------------- Wrinklers
  // Wrinklers pay back what they eat x1.1, and ten attached together multiply output, so normally they are kept.
  // They are popped (a) all of them when it is Halloween/Easter with drops missing (every pop is a drop roll),
  // (b) while the burst-count achievements are open, (c) right before ascending (cookies count toward chips).
  CCA.popWrinklers = (filter) => {
    const g = G(); let n = 0;
    for (const w of g.wrinklers) if (w.phase === 2 && w.hp > 0 && (!filter || filter(w))) { w.hp = -10; n++; }
    if (n) CCA.stat('wrinklersPopped', n);
    return n;
  };
  CCA.every('wrinklers', 3000, () => {
    if (!cfg.wrinklers) return;
    const g = G();
    const att = g.wrinklers.filter(w => w.phase === 2 && w.hp > 0);
    const max = g.getWrinklersMax ? g.getWrinklersMax() : 10;
    const dropHunt = cfg.seasons && (g.season === 'halloween' || g.season === 'easter') && CCA.seasonMissing && CCA.seasonMissing(g.season) > 0;
    const countHunt = cfg.hunt && !CCA.won('Moistburster');
    CCA.status.wrinklers = g.elderWrath > 0 || att.length ? `${att.length}/${max} attached` + (dropHunt ? ', popping for drops' : countHunt ? ', popping for burst count' : ', kept') : '';
    if (!att.length) return;
    if (dropHunt || countHunt) { CCA.popWrinklers(w => !CCA.pokeTarget || w !== CCA.pokeTarget); return; }
  });

  // ------------------------------------------------------------------ Garden
  // Mutation planner (from v4). Seeds unlock when a MATURE plant of that kind is harvested; new kinds appear on an
  // EMPTY tile whose 8 neighbours hold the right mature parents. The planner asks the game's own M.getMuts() which
  // parent combinations produce a still-locked plant, searches a layout over your unlocked tiles that maximises the
  // chance, keeps it planted, and harvests the child the moment it matures.
  // v5 additions: "In the garden of Eden" fill, "Seedless to nay" sacrifice once every seed is known (10 lumps), and
  // CCA.gardenHold() so auto-ascend does not wipe a new plant that is still growing.
  const GP = { target: null, layout: null, sig: '', since: 0, skip: {}, plan: null, tiles: [] };
  const zeros = (M) => { const d = {}; for (const k in M.plants) d[k] = 0; return d; };
  const nbrs = (x, y) => { const o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if ((dx || dy) && x + dx >= 0 && x + dx < 6 && y + dy >= 0 && y + dy < 6) o.push([x + dx, y + dy]); } return o; };
  const tilesOf = (M) => { const t = []; for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (M.isTileUnlocked(x, y)) t.push([x, y]); return t; };
  const pOf = (M, counts, target) => { let p = 0; for (const m of M.getMuts(counts, counts)) if (m[0] === target && m[1] > p) p = m[1]; return p; };

  function findRecipes(M, target, pool) {             // every recipe uses at most two parent kinds
    const z = zeros(M), out = [];
    const test = (parts) => {
      const d = Object.assign({}, z); let n = 0;
      for (const [k, c] of parts) { d[k] = c; n += c; }
      const p = pOf(M, d, target);
      if (p > 0) out.push({ parts, p, n });
    };
    for (let i = 0; i < pool.length; i++) for (let a = 1; a <= 8; a++) {
      test([[pool[i], a]]);
      for (let j = i + 1; j < pool.length; j++) for (let b = 1; a + b <= 8; b++) test([[pool[i], a], [pool[j], b]]);
    }
    return out;
  }
  function bestLayout(M, target, recipe, tiles) {
    const keys = recipe.parts.map(p => p[0]), z = zeros(M), cache = new Map();
    const idx = new Map(); tiles.forEach(([x, y], i) => idx.set(x + ',' + y, i));
    const nb = tiles.map(([x, y]) => nbrs(x, y).map(([a, b]) => idx.get(a + ',' + b)).filter(v => v !== undefined));
    const score = (asg) => {
      let s = 0, planted = 0;
      for (let i = 0; i < tiles.length; i++) {
        if (asg[i]) { planted++; continue; }
        const c = new Array(keys.length).fill(0);
        for (const j of nb[i]) if (asg[j]) c[asg[j] - 1]++;
        const key = c.join(',');
        let p = cache.get(key);
        if (p === undefined) { const d = Object.assign({}, z); keys.forEach((k, q) => d[k] = c[q]); p = pOf(M, d, target); cache.set(key, p); }
        s += p;
      }
      return s - 0.0002 * planted;
    };
    let best = null, bestS = -1;
    const rnd = (n) => Math.floor(Math.random() * n);
    for (let restart = 0; restart < 3; restart++) {
      let asg = tiles.map(() => (Math.random() < 0.5 ? 1 + rnd(keys.length) : 0)), cur = score(asg);
      for (let it = 0; it < 1000; it++) {
        const T = 0.01 * (1 - it / 1000) + 1e-5, i = rnd(tiles.length), old = asg[i];
        asg[i] = rnd(keys.length + 1);
        const sc = score(asg);
        if (sc >= cur || Math.random() < Math.exp((sc - cur) / T)) cur = sc; else asg[i] = old;
        if (cur > bestS) { bestS = cur; best = asg.slice(); }
      }
    }
    return { score: bestS, layout: best && best.map(v => (v ? keys[v - 1] : null)) };
  }
  function choosePlan(M) {
    const tiles = tilesOf(M);
    const pool = M.plantsById.filter(p => p.unlocked && !p.weed).map(p => p.key);
    const cands = [];
    for (const t of M.plantsById.filter(p => !p.unlocked && !GP.skip[p.key])) {
      const recs = findRecipes(M, t.key, pool).filter(r => r.n <= tiles.length).sort((a, b) => (b.p / Math.sqrt(b.n)) - (a.p / Math.sqrt(a.n))).slice(0, 3);
      if (recs.length) cands.push({ t, recs, q: recs[0].p / Math.sqrt(recs[0].n) });
    }
    cands.sort((a, b) => b.q - a.q);
    let best = null;
    for (const c of cands.slice(0, 4)) for (const r of c.recs) {
      const L = bestLayout(M, c.t.key, r, tiles);
      if (L.layout && L.score > 0 && (!best || L.score > best.score)) best = { target: c.t.key, recipe: r, layout: L.layout, score: L.score, tiles };
    }
    return best;
  }
  const bestSoil = (M) => {
    const f = M.parent.amount; let pick = 'dirt';
    for (const k of ['fertilizer', 'woodchips']) if (M.soils[k] && f >= M.soils[k].req) pick = k;
    return pick;
  };
  CCA.gardenDebug = { GP, findRecipes, choosePlan, bestLayout, tilesOf };

  // a not-yet-unlocked plant is growing: ascending now would destroy it
  CCA.gardenHold = () => {
    const M = CCA.minigame('Farm'); if (!M || !cfg.garden) return false;
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { const t = M.plot[y][x]; if (t[0] > 0 && !M.plantsById[t[0] - 1].unlocked) return true; }
    return false;
  };

  function edenFill(M, g) {                           // all 36 tiles planted at once; the planner clears the extras next tick
    if (!cfg.hunt || CCA.won('In the garden of Eden (baby)') || tilesOf(M).length < 36) return false;
    const seed = M.plantsById.filter(p => p.unlocked && !p.weed).sort((a, b) => M.getCost(a) - M.getCost(b))[0];
    if (!seed || g.cookies < M.getCost(seed) * 40) return false;
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (M.plot[y][x][0] === 0) { M.seedSelected = seed.id; M.useTool(seed.id, x, y); }
    M.seedSelected = -1;
    CCA.log('garden: filled all 36 tiles (In the garden of Eden)');
    return true;
  }

  CCA.gardenStep = () => {
    const M = CCA.minigame('Farm'); if (!M) return 'no garden';
    const g = G();
    CCA.status.garden = `${M.plantsUnlockedN}/${M.plantsN} seeds`;
    if (M.plantsUnlockedN >= M.plantsN) {
      if (cfg.hunt && typeof M.convert === 'function') {   // Seedless to nay: sacrifice the full seed log for 10 lumps, then relearn
        M.convert(); CCA.record('other', 'garden sacrificed', 1, 0, '+10 lumps'); CCA.log('garden: sacrificed the seed log (+10 lumps, Seedless to nay)');
        GP.layout = null; return 'converted';
      }
      CCA.status.garden += ' (all)'; M.harvestAll(0, 1, 1); return 'complete';
    }
    if (edenFill(M, g)) return 'eden';
    const sig = tilesOf(M).length + '|' + M.plantsUnlockedN;
    if (!GP.layout || GP.sig !== sig || Date.now() - GP.since > 12 * 3600e3) {
      if (GP.layout && GP.sig === sig) GP.skip[GP.target] = Date.now();            // stuck on this target: try another
      if (Object.keys(GP.skip).length >= M.plantsById.filter(p => !p.unlocked).length) GP.skip = {};
      const plan = choosePlan(M);
      GP.sig = sig; GP.since = Date.now();
      if (!plan) { GP.layout = null; GP.tiles = tilesOf(M); }
      else {
        GP.target = plan.target; GP.layout = plan.layout; GP.tiles = plan.tiles; GP.plan = plan;
        CCA.log(`garden: aiming for ${plan.target} with ${plan.recipe.parts.map(p => p[1] + 'x ' + p[0]).join(' + ')} (${(plan.score * 100).toFixed(2)}%/tick)`);
      }
    }
    // Wild mode: Brown mold and Crumbspore only come from uprooting an old Meddleweed (up to 20% at age 100).
    if (!GP.layout) {
      const wild = !M.plants.brownMold.unlocked || !M.plants.crumbspore.unlocked;
      CCA.status.garden += wild ? ' · farming weeds for molds' : ' · no recipe reachable';
      if (!wild) { M.harvestAll(0, 1, 1); return 'noplan'; }
      for (const [x, y] of GP.tiles) {
        const tile = M.plot[y][x]; if (tile[0] <= 0) continue;
        const cp = M.plantsById[tile[0] - 1];
        if (cp.key === 'meddleweed') { if (tile[1] >= 85) M.harvest(x, y); }
        else if (!cp.unlocked) { if (tile[1] >= cp.mature) M.harvest(x, y); }
        else M.harvest(x, y);
      }
      return 'wild';
    }
    const want = bestSoil(M), cur = M.soilsById[M.soil].key;
    if (want !== cur && M.nextSoil <= Date.now() && M.parent.amount >= M.soils[want].req) { const el = document.getElementById('gardenSoil-' + M.soils[want].id); if (el) el.click(); }
    CCA.status.garden += ` · aiming for ${GP.target}`;
    for (let i = 0; i < GP.tiles.length; i++) {
      const [x, y] = GP.tiles[i], wantK = GP.layout[i], tile = M.plot[y][x];
      const cp = tile[0] > 0 ? M.plantsById[tile[0] - 1] : null;
      if (cp && !cp.unlocked) { if (tile[1] >= cp.mature) M.harvest(x, y); continue; }     // a new kind: harvest once mature (unlocks it)
      if (cp && wantK && cp.key === wantK) continue;
      if (cp) { M.harvest(x, y); continue; }                                              // wrong or stray plant
      if (wantK) {
        const pl = M.plants[wantK];
        if (pl && pl.unlocked && g.cookies >= M.getCost(pl) * 3) { M.seedSelected = pl.id; M.useTool(pl.id, x, y); }
      }
    }
    M.seedSelected = -1;
    return 'ok';
  };
  CCA.every('garden', 6000, () => { if (cfg.garden && cfg.gardenPlanner) CCA.gardenStep(); });

  // ------------------------------------------------------------ Stock market
  // Prices mean-revert to a resting value (10 + 10*id + bank level - 1) and do not react to trades, so strategies can be
  // tested offline on a port of the game's tick. 90 simulated days, 18 goods:
  //   buy <= 0.7x rest (not falling), sell on a fast fall (mode 4) once 3% above basis, or at 1.8x rest.
  //   v4's extra "d < -0.3" exit sold on noise: -13% profit without brokers. "Sell at rest" would be -35%.
  // Basis is per share in $ (1$ = 1 s of highest raw CpS) incl. the broker fee, persisted; unknown holdings (bought by
  // hand, or before a restore) get the current price as basis instead of being stuck forever as in v4.
  // Cash: only cookies above the Lucky bank, and only while buildings pay back slower than marketGateSec. At those
  // paybacks the market returns more than buildings (about 14x the $ tied up, per day, in the sims).
  const MKEY = 'cca5.market';
  let basis = {};
  try { basis = JSON.parse(localStorage.getItem(MKEY) || '{}'); } catch (e) {}
  let basisDirty = false;
  setInterval(() => { if (basisDirty) { basisDirty = false; try { localStorage.setItem(MKEY, JSON.stringify(basis)); } catch (e) {} } }, 10000);

  CCA.marketStep = () => {
    const M = CCA.minigame('Bank'); if (!M) return;
    const g = G();
    const over = 1 + 0.2 * Math.pow(0.95, M.brokers);
    const cpsHi = g.cookiesPsRawHighest || 1;
    const cps = g.unbuffedCps || g.cookiesPs || 1;
    let held = 0, worth = 0;
    const buys = [];
    for (const good of M.goodsById) {
      if (!good.active) continue;
      const rest = M.getRestingVal(good.id), p = good.val;
      if (good.stock <= 0) { if (basis[good.id]) { delete basis[good.id]; basisDirty = true; } }
      else if (!basis[good.id]) { basis[good.id] = p * over; basisDirty = true; }
      if (good.stock > 0) {
        const b = basis[good.id];
        const sell = p > b && ((good.mode === 4 && p >= b * 1.03) || p >= rest * cfg.marketSellAt);
        if (sell && good.last !== 1) {
          const n = good.stock;
          if (M.sellGood(good.id, n)) {
            CCA.stat('trades');
            CCA.record('market', 'sold ' + good.symbol, n, p * n * cpsHi, `$${p.toFixed(2)} (basis $${b.toFixed(2)}, +$${((p - b) * n).toFixed(0)})`);
            CCA.log(`market: sold ${n} ${good.symbol} at $${p.toFixed(2)} (basis $${b.toFixed(2)})`);
            delete basis[good.id]; basisDirty = true;
            continue;
          }
        }
        held++; worth += good.stock * p;
      }
      const room = M.getGoodMaxStock(good) - good.stock;
      const cheap = p <= rest * cfg.marketBuyBelow && good.d > -0.15 && good.mode !== 4 && good.mode !== 2;
      if (room > 0 && cheap && good.last !== 2 && (!basis[good.id] || p * over < basis[good.id])) buys.push({ good, p, rest, room });
    }
    // buy the deepest discounts first with the cash the economy can spare
    const gateOpen = CCA.econ.bestPayback > cfg.marketGateSec || CCA.econ.bestPayback === Infinity;
    let budget = gateOpen && !CCA.locked() ? Math.max(0, g.cookies - (Number(cfg.bankMult) || 0) * cps) * cfg.marketSpendPct : 0;
    buys.sort((a, b) => a.p / a.rest - b.p / b.rest);
    for (const { good, p, room } of buys) {
      const unit = p * over * cpsHi, n = Math.min(room, Math.floor(budget / unit));
      if (n <= 0) continue;
      const had = good.stock, c0 = g.cookies;
      if (!M.buyGood(good.id, n)) continue;
      const spent = c0 - g.cookies; budget -= spent;
      basis[good.id] = had > 0 ? (basis[good.id] * had + p * over * n) / (had + n) : p * over; basisDirty = true;
      CCA.stat('trades');
      CCA.record('market', 'bought ' + good.symbol, n, spent, `$${p.toFixed(2)} (rest $${M.getRestingVal(good.id)})`);
      held += had ? 0 : 1; worth += n * p;
    }
    CCA.status.market = `${held} held ($${CCA.fmt(worth)}), run profit $${CCA.fmt(M.profit)}` + (gateOpen ? '' : ' · buildings first');
  };

  // Upkeep: brokers cut the 20% fee (x0.95 each); offices raise stock caps and lead to "Pyramid scheme". A broker costs
  // 20 min of CpS and is hired when that is <= 3% of the bank. An office upgrade sacrifices cursors (rebought by the
  // optimizer) when cursors cover cost + 20%. Both reset on ascension.
  CCA.marketUpkeep = () => {
    const M = CCA.minigame('Bank'); if (!M) return;
    const g = G();
    if (M.brokers < M.getMaxBrokers() && M.getBrokerPrice() <= g.cookies * 0.03) {
      const b = document.getElementById('bankBrokersBuy'), price = M.getBrokerPrice();
      if (b) { b.click(); if (M.brokers) CCA.record('market', 'broker #' + M.brokers, 1, price); }
    }
    const of = M.offices[M.officeLevel], cur = g.Objects['Cursor'];
    if (!CCA.locked() && of && of.cost && cur.amount >= of.cost[0] * 1.2 && cur.level >= of.cost[1]) {
      const b = document.getElementById('bankOfficeUpgrade'), lvl = M.officeLevel;
      if (b) { b.click(); if (M.officeLevel > lvl) { CCA.record('market', 'office: ' + M.offices[M.officeLevel].name, 1, 0, of.cost[0] + ' cursors'); CCA.log('market: office -> ' + M.offices[M.officeLevel].name); } }
    }
  };
  CCA.every('market', 5000, () => { if (cfg.market) { CCA.marketStep(); CCA.marketUpkeep(); } });

  console.log('[CCA] minigames loaded');
})();
