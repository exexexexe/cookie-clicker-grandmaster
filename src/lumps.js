/* v5 sugar lumps: the bottleneck for 100% (20 x "Reach level 10" = 1100 lumps).
 *
 * 1. Lump TYPE. When a lump is harvested the game sets lumpT = Date.now() and rolls the NEXT lump's type with
 *    Math.seedrandom(Game.seed + '/' + lumpT). So the harvest millisecond decides the next type. Golden lumps
 *    give 2-7 lumps (avg 4.5) instead of 1; about 1 in ~600 milliseconds rolls golden, so there is almost always
 *    one within a second. We scan upcoming milliseconds with the game's own computeLumpType, then click exactly then.
 *    Missing type achievements (bifurcated, caramelized, meaty) are targeted once first.
 * 2. Lump TIMING. Ripe age is recomputed on every CalculateGains, so boosts only need to be active at the moment of
 *    harvest: Rigidel (diamond, -1 h, only while the building count ends in 0) is swapped in for the harvest and back
 *    out (swaps refill hourly), the Dragon's Curve aura (/1.05) is selected for the harvest, and the building count is
 *    rounded to a multiple of 10.
 * 3. SPENDING. Minigames first (garden takes longest), farm to level 9 (full 6x6 plot), then levels toward 10. */
(() => {
  'use strict';
  const CCA = window.CCA, cfg = CCA.cfg, G = CCA.G;
  const TYPES = ['normal', 'bifurcated', 'golden', 'meaty', 'caramelized'];
  const YIELD = [1, 1.5, 4.5, 1, 2];                       // expected lumps per harvest by type
  const CURVE = 17, CURVE_LEVEL = 21;                       // Dragon's Curve aura id; aura k needs dragon level k+4
  CCA.lumpTypes = TYPES;

  // ---- type prediction (uses the game's own function, then restores state) ----
  CCA.predictLumpType = (t) => {
    const g = G(), lt = g.lumpT, cur = g.lumpCurrentType;
    g.lumpT = t;
    try { g.computeLumpType(); return g.lumpCurrentType; }
    finally { g.lumpT = lt; g.lumpCurrentType = cur; }
  };
  function wantedType(g) {
    if (!cfg.hunt) return 2;
    if (!CCA.won('Sugar sugar')) return 1;
    if (!CCA.won('Maillard reaction')) return 4;
    if (!CCA.won('Sweetmeats') && g.elderWrath > 0) return 3;
    if (!CCA.won('Hand-picked')) return 0;                   // next lump is the cheap one to try harvesting early
    return 2;
  }

  // Date.now() resolution: 1 ms normally, coarser with Firefox's resistFingerprinting. Learned from samples.
  const samples = [];
  const granularity = () => {
    if (samples.length < 20) return 1;
    if (samples.every(v => v % 100 === 0)) return 100;
    if (samples.every(v => v % 10 === 0)) return 10;
    return 1;
  };

  // ---- lump boosts applied only around the harvest ----
  const pantheon = () => CCA.minigame('Temple');
  function rigidelUsable(M) {
    if (!M || !M.gods.order) return false;
    return M.slot[0] === M.gods.order.id || M.swaps >= 2;    // one swap in, one swap back out
  }
  const curveUsable = (g) => g.dragonLevel >= CURVE_LEVEL && g.dragonAura !== CURVE && g.dragonAura2 !== CURVE;

  // Best ripe age reachable right now, computed by the game itself on a virtual state.
  function bestRipeAge(g) {
    if (!cfg.lumpTricks) return g.lumpRipeAge;
    const M = pantheon(), save = { bo: g.BuildingsOwned, aura: g.dragonAura };
    let godSave = null;
    try {
      if (rigidelUsable(M) && M.slot[0] !== M.gods.order.id) {
        godSave = { s0: M.slot[0], os: M.gods.order.slot };
        if (godSave.os !== -1) M.slot[godSave.os] = -1;
        M.slot[0] = M.gods.order.id; M.gods.order.slot = 0;
      }
      g.BuildingsOwned = Math.max(10, Math.round(g.BuildingsOwned / 10) * 10);
      if (curveUsable(g)) g.dragonAura = CURVE;
      g.computeLumpTimes();
      return g.lumpRipeAge;
    } finally {
      g.BuildingsOwned = save.bo; g.dragonAura = save.aura;
      if (godSave) { M.slot[0] = godSave.s0; if (godSave.os !== -1) M.slot[godSave.os] = M.gods.order.id; M.gods.order.slot = godSave.os; }
      g.computeLumpTimes();
    }
  }

  function setAura(g, aura) {                                // same effect as the aura menu's Confirm: costs 1 of your highest building
    if (g.dragonAura === aura) return;
    let highest = null;
    for (const o of g.ObjectsById) if (o.amount > 0) highest = o;
    g.dragonAura = aura;
    if (highest) highest.sacrifice(1);
    g.recalculateGains = 1;
  }
  function slotGod(M, god, slot) {                           // same as dragging a god onto a slot: always costs one swap
    if (!god || M.swaps < 1 || M.slot[slot] === god.id) return false;
    return CCA.placeGod(M, god, slot);
  }
  function roundBuildings(g) {                               // make the total end in 0: buy a few cheap ones, or sell cursors
    const r = g.BuildingsOwned % 10;
    if (r === 0) return true;
    const need = 10 - r, prev = g.buyMode; g.buyMode = 1;
    try {
      const cheapest = g.ObjectsById.filter(o => !o.locked).map(o => ({ o, c: o.getSumPrice(need) })).sort((a, b) => a.c - b.c)[0];
      if (cheapest && cheapest.c <= g.cookies * 0.02) {
        const c0 = g.cookies; cheapest.o.buy(need);
        CCA.record('building', cheapest.o.name, need, c0 - g.cookies, 'round count for Rigidel');
      } else if (g.Objects.Cursor.amount >= r) {
        g.Objects.Cursor.sell(r);
      }
    } finally { g.buyMode = prev; }
    return g.BuildingsOwned % 10 === 0;
  }

  let prep = null, pending = null, lead = 40, misses = 0;
  function applyBoosts(g) {
    prep = { aura: null, god: null };
    if (!cfg.lumpTricks) return;
    if (curveUsable(g)) { prep.aura = g.dragonAura; setAura(g, CURVE); }
    const M = pantheon();
    if (rigidelUsable(M) && M.slot[0] !== M.gods.order.id) {
      prep.god = M.slot[0];
      slotGod(M, M.gods.order, 0);
    }
    if (M && M.gods.order && M.gods.order.slot !== -1) roundBuildings(g);
    g.CalculateGains();
  }
  function restoreBoosts(g) {
    if (!prep) return;
    if (prep.aura !== null) setAura(g, prep.aura);
    const M = pantheon();
    if (M && prep.god !== null && prep.god !== -1) slotGod(M, M.godsById[prep.god], 0);
    prep = null;
    g.recalculateGains = 1;
  }

  // ---- the timed click ----
  function schedule(g) {
    const want = wantedType(g), gran = granularity(), now = Date.now();
    const start = Math.ceil((now + lead) / gran) * gran;
    let pick = null, fallback = null;
    for (let t = start, n = 0; n < 6000; t += gran, n++) {
      const ty = CCA.predictLumpType(t);
      if (ty === want) { pick = { t, ty }; break; }
      if (!fallback || YIELD[ty] > YIELD[fallback.ty]) fallback = { t, ty };
    }
    pick = pick || fallback;
    pending = pick;
    CCA.status.lumpNext = TYPES[pick.ty];
    CCA.setTimeout(() => fire(pick), Math.max(0, pick.t - Date.now() - lead));
  }
  function fire(pick) {
    const g = G();
    const limit = performance.now() + lead + 30;
    while (Date.now() < pick.t && performance.now() < limit) { /* spin to the exact millisecond */ }
    if (Date.now() !== pick.t || !CCA.ok()) {               // missed it (throttled tab, busy frame): retry with more lead
      // put the dragon aura and the diamond god back now; the next attempt applies them again (6.1.4: they used to stay,
      // and a lump that went overripe meanwhile left Dragon's Curve and Rigidel in place for good)
      lead = Math.min(lead * 2, 400); misses++; pending = null; restoreBoosts(g); CCA.lock('lump', 0); return;
    }
    g.computeLumpTimes();
    if (Date.now() - g.lumpT < g.lumpRipeAge) {              // something moved the building count: a click now would be a 50% early harvest
      restoreBoosts(g); CCA.lock('lump', 0); pending = null; return;
    }
    const before = g.lumps, type = g.lumpCurrentType;
    g.clickLump();
    const got = g.lumps - before;
    const hit = g.lumpT === pick.t;
    if (hit) { lead = Math.max(40, Math.floor(lead / 2)); misses = 0; }
    CCA.stat('lumpsHarvested');
    CCA.log(`harvested a ${TYPES[type]} lump (+${got}); next lump: ${TYPES[g.lumpCurrentType]}${hit ? '' : ' (timing missed)'}`);
    restoreBoosts(g);
    CCA.lock('lump', 0);
    pending = null;
  }

  CCA.every('lumps', 1000, () => {
    const g = G();
    samples.push(Date.now()); if (samples.length > 40) samples.shift();
    if (typeof g.canLumps !== 'function' || !g.canLumps()) { CCA.status.lumps = 'locked until 1B cookies'; return; }
    if (cfg.lumps && !pending) harvestStep(g);
    if (cfg.spendLumps) spendStep(g);
  });

  function harvestStep(g) {
    const now = Date.now(), age = now - g.lumpT;
    // Hand-picked: harvest one normal lump between mature and ripe (50% chance of 1 lump, 50% of nothing)
    if (cfg.hunt && !CCA.won('Hand-picked') && g.lumpCurrentType === 0 && age >= g.lumpMatureAge && age < g.lumpRipeAge) {
      const before = g.lumps; g.clickLump();
      CCA.log(`Hand-picked attempt: ${g.lumps > before ? 'success' : 'botched'}; next lump ${TYPES[g.lumpCurrentType]}`);
      return;
    }
    const ripe = bestRipeAge(g);
    CCA.status.lumps = `${g.lumps} lump${g.lumps === 1 ? '' : 's'} · ${TYPES[g.lumpCurrentType]} ripe in ${CCA.dur(Math.max(0, ripe - age))}`;
    if (age < ripe || age >= g.lumpOverripeAge) return;     // overripe lumps drop on their own
    // Boosts also pull the overripe time forward (ripe + 1 h). Far past the boosted ripe time (browser was closed),
    // boosting would make the lump drop by itself at a random millisecond, so wait for normal ripeness instead.
    if (age < g.lumpRipeAge && age > ripe + 3600e3 - 120e3) { CCA.status.lumps += ' (waiting: boosts would overshoot)'; return; }
    CCA.lock('lump', 20000);                                // keep the building count steady until the click
    if (age < g.lumpRipeAge) applyBoosts(g);
    if (age < g.lumpRipeAge) { restoreBoosts(g); CCA.lock('lump', 0); return; }   // boosts did not get it ripe; try next tick
    if (!cfg.lumpTiming || misses >= 4) {                   // timing keeps missing (coarse clock, throttled tab): plain click
      const before = g.lumps; g.clickLump();
      CCA.log(`harvested a lump (+${g.lumps - before})${misses >= 4 ? ' without exact timing (it kept missing)' : ''}`); misses = 0; restoreBoosts(g); CCA.lock('lump', 0);
      return;
    }
    schedule(g);
  }

  // ---- spending ----
  const MINIGAMES = ['Farm', 'Temple', 'Wizard tower', 'Bank'];
  // Sugar frenzy: x3 CpS for an hour, once per ascension, for 1 lump. Used an hour or more into a run (so the run is
  // long enough to profit), and only with a lump to spare beyond the next planned level.
  function sugarFrenzy(g, nextCost) {
    const u = g.Upgrades['Sugar frenzy'];
    if (!cfg.spendLumps || !u || !u.unlocked || u.bought || g.hasBuff('Sugar frenzy')) return;
    if (Date.now() - g.startDate < 3600e3 || g.lumps < nextCost + 1 || Object.values(g.buffs).some(b => b.multCpS > 1)) return;
    const ask = g.prefs.askLumps; g.prefs.askLumps = 0;
    try { u.buy(); } finally { g.prefs.askLumps = ask; }
    if (g.hasBuff('Sugar frenzy')) { CCA.record('upgrade', 'Sugar frenzy', 1, 0, '1 lump'); CCA.log('Sugar frenzy: x3 CpS for an hour'); }
  }
  function spendStep(g) {
    if (g.lumps < 1) return;
    let pick = null;
    for (const n of MINIGAMES) { const o = g.Objects[n]; if (o && o.amount > 0 && o.level === 0) { pick = o; break; } }
    const farm = g.Objects.Farm;
    if (!pick && farm.amount > 0 && farm.level < 9) pick = farm;                 // full garden plot
    // Sugar baking: every unspent lump (up to 100) is +1% to ALL CpS, while a building level is +1% of one building.
    // So after the minigame levels above, lumps are kept until there are 100 and only the extra ones are spent.
    const reserve = !pick && cfg.lumpReserve && g.Has('Sugar baking') ? 100 : 0;
    // Sugar crystal cookies: +1% to ALL CpS for every building type at level 10+, counted toward the levels that lead there
    const crystal = cfg.levelTen && g.Has('Sugar crystal cookies'), total = g.unbuffedCps || g.cookiesPs || 0;
    if (!pick) {
      let best = 0;
      const allTen = g.ObjectsById.every(o => o.level >= 10);
      for (const o of g.ObjectsById) {
        if (o.amount === 0 || (!allTen && o.level >= 10)) continue;
        let score = (o.storedTotalCps * 0.01 + 1e-9) / (o.level + 1);             // +1% of the building's output per level
        if (crystal && o.level < 10) {                                            // the whole road to 10, per lump
          let c = 0; for (let l = o.level + 1; l <= 10; l++) c += l;
          score = Math.max(score, (0.01 * total + 0.01 * o.storedTotalCps * (10 - o.level)) / c);
        }
        if (o.name === 'Wizard tower' && cfg.grimoire) score *= 3;                // levels also raise the magic bar (combos)
        if (score > best) { best = score; pick = o; }
      }
    }
    sugarFrenzy(g, reserve ? 0 : pick ? pick.level + 1 : 0);   // x3 for an hour beats 1% for the day a lump takes to regrow
    if (!pick || g.lumps - (pick.level + 1) < reserve) {
      if (pick) CCA.status.lumpPlan = reserve && g.lumps < reserve
        ? `saving for Sugar baking: ${Math.floor(g.lumps)}/100 lumps (+${Math.min(100, Math.floor(g.lumps))}% CpS) · then ${pick.name} → ${pick.level + 1}`
        : `${pick.name} → ${pick.level + 1} (${pick.level + 1} lumps${reserve ? ' above the 100 kept' : ''})`;
      return;
    }
    const ask = g.prefs.askLumps; g.prefs.askLumps = 0;      // otherwise the game opens a confirm prompt
    try {
      const cost = pick.level + 1;
      pick.levelUp();
      CCA.record('level', `${pick.name} level ${pick.level}`, 1, 0, cost + ' lumps');
      CCA.log(`levelled ${pick.name} to ${pick.level}`);
    } finally { g.prefs.askLumps = ask; }
  }

  console.log('[CCA] lumps loaded');
})();
