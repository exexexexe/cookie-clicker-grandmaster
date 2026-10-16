/* v5 minigames: Grimoire, Pantheon, Dragon, Wrinklers, Garden, Stock market. */
(() => {
  'use strict';
  const CCA = window.CCA, cfg = CCA.cfg, G = CCA.G;

  // ---------------------------------------------------------------- Grimoire
  // The game seeds every spell with Game.seed + '/' + spellsCastTotal, so the next Force the Hand of Fate outcome is
  // known before casting. We replay the spell's RNG calls with a no-count shimmer, cast only good outcomes, and burn
  // bad ones with a cheap spell (which advances the counter). Verified 60/60 against real casts in v4.
  const sleep = (ms) => new Promise(r => CCA.setTimeout(r, ms));
  const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // k: how many casts ahead (each cast advances the seed); fail: override the fail chance (Diminish Ineptitude).
  CCA.predictFtHoF = (M, k = 0, fail) => {
    const g = G(), hof = M.spells['hand of fate'];
    const failChance = fail === undefined ? M.getFailChance(hof) : fail;
    let out;
    const chime = g.chimeType; g.chimeType = 0;               // the test shimmer would otherwise play the golden chime
    Math.seedrandom(g.seed + '/' + (M.spellsCastTotal + k));
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
    } finally { Math.seedrandom(); g.chimeType = chime; }
    return out;
  };
  // FtHoF's fail chance: 0.15 base (x0.1 with Magic adept, Supreme Intellect...) PLUS 0.15 per golden cookie on screen.
  // A cast leaves one golden (or wrath) cookie behind, so the cast after it fails 0.15 more often; DI only scales the base.
  const fthofFail = (g, M, extraCookies = 0, adept = false) => {
    const hof = M.spells['hand of fate'], n = g.shimmerTypes.golden.n;
    const base = M.getFailChance(hof) - 0.15 * n;
    return base * (adept && !g.hasBuff('Magic adept') ? 0.1 : 1) + 0.15 * (n + extraCookies);
  };
  const SELF = new Set(['frenzy', 'free sugar lump', 'cookie storm']);          // worth casting on their own
  const STACK = new Set(['multiply cookies', 'click frenzy', 'building special']); // best on top of a running buff
  // Elder frenzy (x666 CpS for 6 s, about an hour of CpS) is the one backfire worth having.
  const isGood = (p) => (p.win && (SELF.has(p.force) || STACK.has(p.force))) || (!p.win && p.force === 'blood frenzy');
  const isSelf = (p) => (p.win && SELF.has(p.force)) || (!p.win && p.force === 'blood frenzy');
  const BUFFS = new Set(['click frenzy', 'building special', 'frenzy', 'blood frenzy']);
  let fullSince = 0, doubling = false;

  // Double cast: cast from a full bar, sell wizard towers until the leftover magic covers a second cast at the smaller
  // bar, cast again, buy the towers back. The game recomputes the bar every 5 frames, hence the short waits. Used when
  // both of the next two outcomes are buffs that stack, and the towers cost <= 10 min of CpS to rebuy.
  const magicAt = (M, towers) => Math.floor(4 + Math.pow(Math.max(towers, 1), 0.6) + Math.log((Math.max(towers, 1) + (Math.max(M.parent.level, 1) - 1) * 10) / 15 + 1) * 15);
  function doublePlan(g, M, hof, left) {                     // left: magic after the first cast
    const t = M.parent.amount, red = 1 - 0.1 * g.auraMult('Supreme Intellect');
    for (let t2 = t - 1; t2 >= 1; t2--) {
      const mm = magicAt(M, t2), cost = Math.floor((hof.costMin + hof.costPercent * mm) * red);
      if (Math.min(left, mm) >= cost + 1) {
        const o = M.parent, sold = t - t2;
        // rebuy the towers that are sold (priced where they are, not the next ones up) minus the refund, which
        // getReverseSumPrice already gives at the sell rate (6.1.4: was ~1.15^sold too high, so it never double cast)
        const back = o.getReverseSumPrice(sold);
        o.amount -= sold; let rebuy; try { rebuy = o.getSumPrice(sold); } finally { o.amount += sold; }
        const loss = rebuy - back;
        return { sold, loss };
      }
    }
    return null;
  }
  async function doubleCast(g, M, hof, p0, p1) {
    doubling = true;
    const o = M.parent, prev = g.buyMode;
    try {
      M.castSpell(hof); CCA.stat('spells'); CCA.stat('combos');
      const plan = doublePlan(g, M, hof, M.magic);
      if (!plan) { CCA.log(`FtHoF -> ${p0.force} (double cast not possible after all)`); return; }
      o.sell(plan.sold);
      await sleep(300);
      if (M.magic >= M.getSpellCost(hof)) { M.castSpell(hof); CCA.stat('spells'); CCA.log(`double cast: FtHoF -> ${p0.force} + ${p1.force} (sold ${plan.sold} wizard towers)`); }
      else CCA.log(`double cast: second cast did not fit, buying the towers back`);
      g.buyMode = 1; o.buy(plan.sold);
    } finally { g.buyMode = prev; doubling = false; }
  }

  CCA.every('grimoire', 1000, () => {
    if (!cfg.grimoire || doubling) return;
    const M = CCA.minigame('Wizard tower'); if (!M) return;
    const g = G();
    const hof = M.spells['hand of fate'], conj = M.spells['conjure baked goods'], hag = M.spells["haggler's charm"], di = M.spells['diminish ineptitude'];
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
    const good = isGood(pred);
    const useless = good && pred.force === 'frenzy' && buffed;          // would only refresh a running frenzy
    if (good && !useless) {
      // two stacking buffs in a row: cast both at once
      if (M.magic >= M.magicM - 0.5 && BUFFS.has(pred.force) && !CCA.locked()) {
        const p1 = CCA.predictFtHoF(M, 1, fthofFail(g, M, 1));        // the first cast leaves a golden cookie on screen
        if (isGood(p1) && BUFFS.has(p1.force) && p1.force !== pred.force) {
          const plan = doublePlan(g, M, hof, M.magic - costH), cps = g.unbuffedCps || g.cookiesPs || 1;
          if (plan && plan.loss <= cps * 600) { doubleCast(g, M, hof, pred, p1); return; }
        }
      }
      const patient = fullSince && Date.now() - fullSince > 10 * 60 * 1000;
      if (isSelf(pred) || buffed || patient) { CCA.stat('combos'); cast(hof, `FtHoF -> ${pred.force}${buffed ? ' (on a buff)' : ''}`); }
      return;                                                           // stacker: wait for a buff
    }
    const wins = (sp, k = 0) => { Math.seedrandom(g.seed + '/' + (M.spellsCastTotal + k)); const r = Math.random(); Math.seedrandom(); return r < 1 - M.getFailChance(sp); };
    // Diminish Ineptitude makes spells fail 10x less: a predicted backfire can turn into a success on the next cast.
    if (di && !g.hasBuff('Magic adept') && wins(di)) {
      const p1 = CCA.predictFtHoF(M, 1, fthofFail(g, M, 0, true));
      if (isGood(p1) && M.magic >= M.getSpellCost(di) + costH) return cast(di, `Diminish Ineptitude first: next FtHoF -> ${p1.force} instead of ${pred.force}`);
    }
    // Bad or redundant outcome: burn it with a throwaway spell, which advances the spell counter. Mana is what limits
    // Force the Hand of Fate casts, so the cheapest burner predicted to SUCCEED goes first: Haggler's charm (10 + 10%)
    // before Conjure baked goods (2 + 40%). Haggler's is never cast when it would backfire (upgrades pricier for an
    // hour); a backfiring Conjure only loses a few minutes of cookies.
    const burners = [hag, conj].filter(Boolean).map(sp => ({ sp, win: wins(sp), cost: M.getSpellCost(sp) }))
      .filter(b => b.sp !== hag || b.win).sort((a, b) => (b.win - a.win) || (a.cost - b.cost)).map(b => b.sp);
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
  // Every layout of the useful gods is tried virtually: the game recomputes its own gains with the gods placed, and the
  // layout is scored by income (CpS + clicks), golden-cookie frequency (the game's own timer function, so Mokalsium's and
  // Selebrak's effects are exact) and Godzamok's combo income. Golden cookies count as about half of earnings, combos
  // by their measured share. A god is moved only for a gain of 3% or more (see the 6.1.7 note below for swaps). Placing costs one worship swap, exactly like dragging; taking a god out is free.
  // Cyclius follows the clock, so he comes in while his wave is up and leaves when it turns.
  const GODS = ['ruin', 'mother', 'labor', 'seasons', 'ages', 'industry'];   // 6.1.7: + Jeremy (+10/6/3% buildings, golden cookies rarer)
  const runEarned = { id: 0, base: 0 };
  function comboShare(g) {
    if (runEarned.id !== g.startDate) { runEarned.id = g.startDate; runEarned.base = g.cookiesEarned; }
    const made = g.cookiesEarned - runEarned.base, gain = CCA.stats.comboGain || 0;
    if ((CCA.stats.combos || 0) < 10 || made <= 0) return 0.3;      // prior until there is data
    return Math.min(2, gain / made);
  }
  function scoreLayout(g, M, layout, share) {               // layout: god key or null per slot
    const keep = { slot: M.slot.slice(), gs: M.godsById.map(x => x.slot) }, hi = g.cookiesPsRawHighest;
    try {
      for (const gd of M.godsById) gd.slot = -1;
      M.slot = layout.map(k => (k ? M.gods[k].id : -1));
      layout.forEach((k, i) => { if (k) M.gods[k].slot = i; });
      CCA.quietGains(g);
      const m = CCA.buffMult(g), r = cfg.clicker ? Number(cfg.clickRate) || 0 : 0;
      const income = (g.unbuffedCps || 0) + g.computedMouseCps / (m.k * m.c) * r;
      const tm = g.shimmerTypes.golden.getTimeMod({ wrath: 0 }, 1);
      const z = layout.indexOf('ruin');
      return Math.log(Math.max(income, 1e-9)) - 0.5 * Math.log(tm) + (z >= 0 ? Math.log(1 + share * [1, 0.5, 0.25][z]) : 0);
    } finally {
      M.slot = keep.slot; M.godsById.forEach((x, i) => { x.slot = keep.gs[i]; });
      CCA.quietGains(g); g.cookiesPsRawHighest = hi;
    }
  }
  // 6.1.7: ascending empties the temple (3 swaps, all slots empty) and a swap comes back after 1 h at 2 left, 4 h at 1,
  // 16 h at 0. The old rule (place only with 2+ swaps, take out for free whenever another layout scored higher) left
  // slots empty for hours: two gods in, one swap kept for Rigidel, then Cyclius & co. taken out with nothing to put back.
  // Now only layouts reachable with the swaps in hand are compared: filling an empty slot may use the last swap, a
  // replacement keeps one for Rigidel, and a god is taken out only when the slot is better off empty (by 1%+).
  CCA.every('pantheon', 30000, () => {
    if (!cfg.pantheon || CCA.locked() || CCA.popping) return;
    const M = CCA.minigame('Temple'); if (!M) return;
    const g = G(), n = M.slot.length, share = comboShare(g);
    const pool = GODS.filter(k => M.gods[k] && (k !== 'ruin' || (cfg.godzamok && cfg.clicker)));
    const cur = M.slot.map(id => (id >= 0 ? Object.keys(M.gods).find(k => M.gods[k].id === id) : null));
    const reachable = (lay) => {                             // swaps this layout costs vs what we may spend
      let fill = 0, repl = 0;
      lay.forEach((k, i) => { if (k && k !== cur[i]) { if (cur[i]) repl++; else fill++; } });
      return fill + repl === 0 || (repl ? fill + repl <= M.swaps - 1 : fill <= M.swaps);
    };
    const curS = scoreLayout(g, M, cur, share);
    let best = cur.slice(), bestS = curS;
    const opts = [null, ...pool];
    const walk = (i, lay) => {
      if (i === n) {
        if (!reachable(lay)) return;
        const sc = scoreLayout(g, M, lay, share);
        const repl = lay.some((k, j) => k && cur[j] && k !== cur[j]), need = repl ? Math.log(1.03) : Math.log(1.01);   // filling or emptying: 1%
        if (sc - curS >= need && sc > bestS) { bestS = sc; best = lay.slice(); }
        return;
      }
      // a god that is not in the pool (placed by hand, or Rigidel) may stay where it is
      const here = cur[i] && !pool.includes(cur[i]) ? [cur[i], ...opts] : opts;
      for (const k of here) if (!k || !lay.includes(k)) { lay.push(k); walk(i + 1, lay); lay.pop(); }
    };
    walk(0, []);
    const name = (k) => M.gods[k].name.split(',')[0];
    const empty = cur.filter(k => !k).length;
    CCA.status.pantheon = cur.map(k => (k ? name(k) : '–')).join(' / ') + ` · ${M.swaps} swaps`
      + (empty && M.swaps === 0 ? ' · empty slots wait for a swap' : '');
    if (best.every((k, i) => k === cur[i])) return;
    const gainPct = ((Math.exp(bestS - curS) - 1) * 100).toFixed(0);
    for (let i = 0; i < n; i++) {                            // one change per tick; removals first (free); a replaced god goes back to the roster by itself
      const have = cur[i];
      if (have && !best[i] && !best.includes(have)) { CCA.placeGod(M, M.gods[have], -1); CCA.log(`removed ${name(have)} (+${gainPct}% est.)`); return; }
    }
    for (let i = 0; i < n; i++) {
      const want = best[i];
      if (want && want !== cur[i] && M.swaps >= 1) {
        CCA.placeGod(M, M.gods[want], i);
        CCA.log(`slotted ${name(want)} in the ${['diamond', 'ruby', 'jade'][i]} slot (+${gainPct}% est.)`);
        return;
      }
    }
  });

  // ------------------------------------------------------------------ Dragon
  // The dragon resets on every ascension. Each level after the 4 cookie levels sacrifices 100 of one building, so a
  // level is bought when rebuying those buildings costs <= 15 min of CpS. Full training ("Here be dragon": 50 then 200
  // of every building) happens mid-run when the second aura outweighs the lost buildings (secondAuraPays), otherwise in
  // the pre-ascend spend-down, when buildings are worthless anyway.
  // Auras are scored like the Pantheon: virtually selected, the game's own gains and golden-cookie timer measured.
  // Candidates: Breath of Milk, Dragon Cursor, Elder Battalion, Dragon God, Arcane Aura, Radiant Appetite, Reality Bending,
  // Dragon Guts (scored with the wrinkler income it adds, see wrinklerFactor).
  // 6.1.3: + Reality Bending (a tenth of every other aura) and Dragon Guts (+2 wrinklers, +20% eating and payout)
  const AURAS = [1, 2, 3, 8, 9, 15, 18, 21];
  // Wrinkler income as a multiple of CpS, from the game's own formulas: n attached each eat CpS x min(1, n x rate) and
  // return it x payout when popped. What they hold only becomes spendable when popped, so it is counted at half.
  // 6.1.6: scored for the run's steady state, not the moment. It used to drop to 1 during an Elder Pledge (wrath 0 for
  // 30-60 min) and while popping for drops, so the aura flipped Dragon Guts -> something else -> back every pledge cycle;
  // each flip cost a building, and dropping Guts makes the game pop the wrinklers in the 2 extra slots.
  function wrinklerFactor(g) {
    const active = g.elderWrath > 0 || g.pledgeT > 0 || (g.Has('One mind') && (!g.Has('Elder Covenant') || cfg.hunt));   // with hunt on the Covenant is revoked seconds later
    if (!cfg.wrinklers || !active) return 1;
    const n = g.getWrinklersMax();
    const guts = g.auraMult('Dragon Guts');
    const s = Math.min(1, n * 0.05 * (g.eff ? g.eff('wrinklerEat') : 1) * (1 + 0.2 * guts));
    const pay = 1.1 * (g.Has('Sacrilegious corruption') ? 1.05 : 1) * (1 + 0.2 * guts) * (g.Has('Wrinklerspawn') ? 1.05 : 1);
    return (1 - s) + 0.5 * n * s * pay;
  }
  const auraLevel = (a) => a + 4;
  const AURA2_LEVEL = 27;
  function scoreAuras(g, a1, a2) {
    const keep = [g.dragonAura, g.dragonAura2], hi = g.cookiesPsRawHighest;
    try {
      g.dragonAura = a1; g.dragonAura2 = a2;
      CCA.quietGains(g);
      const m = CCA.buffMult(g), r = cfg.clicker ? Number(cfg.clickRate) || 0 : 0;
      const income = (g.unbuffedCps || 0) * wrinklerFactor(g) + g.computedMouseCps / (m.k * m.c) * r;
      return Math.log(Math.max(income, 1e-9)) - 0.5 * Math.log(g.shimmerTypes.golden.getTimeMod({ wrath: 0 }, 1));
    } finally { g.dragonAura = keep[0]; g.dragonAura2 = keep[1]; CCA.quietGains(g); g.cookiesPsRawHighest = hi; }
  }
  function bestAuras(g) {
    const ok = AURAS.filter(a => g.dragonLevel >= auraLevel(a)), two = g.dragonLevel >= AURA2_LEVEL;
    let best = [g.dragonAura, g.dragonAura2], bestS = scoreAuras(g, g.dragonAura, g.dragonAura2), cur = bestS;
    for (const a of ok) for (const b of (two ? ok : [0])) {
      if (a === b) continue;
      const s = scoreAuras(g, a, b);
      if (s > bestS) { bestS = s; best = [a, b]; }
    }
    return { best, gain: Math.exp(bestS - cur) };
  }
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
  // Full training mid-run (second aura slot) once rebuying what the remaining levels sacrifice costs <= 30 min of CpS.
  // What it costs to buy back everything the remaining levels sacrifice: the units that are given up (the top ones),
  // priced where they are, not the next ones up (6.1.1 priced the next 50 / 200, about 1000x / 1e12x too much)
  function fullTrainCost(g) {
    let c = 0;
    const need = toTrain(g);
    g.ObjectsById.forEach((o, i) => {
      if (g.dragonLevel < 5 || !need[i]) return;
      const A = o.amount;
      o.amount = Math.max(0, A - need[i]);
      try { c += o.getSumPrice(need[i]); } finally { o.amount = A; }
    });
    return c;
  }
  // Training the rest of the way: each level from 5 to 24 sacrifices 100 of one building, the last two 50 and then 200 of
  // every building (Dragon cookie, second aura slot). Measured with the game's own numbers: take all of those buildings
  // away and give the best two auras; if income is at least what it is now, training costs nothing even before the
  // buildings are rebought. Checked every 2 minutes.
  const toTrain = (g) => {                            // still to sacrifice, per building
    const every = g.dragonLevel <= 25 ? 250 : g.dragonLevel === 26 ? 200 : 0;
    return g.ObjectsById.map((o, i) => (g.dragonLevel <= i + 5 ? 100 : 0) + every);
  };
  let worthT = 0, worthOk = false;
  CCA.dragonWorth = { last: null };
  function secondAuraPays(g) {
    if (Date.now() - worthT < 120e3) return worthOk;
    worthT = Date.now(); worthOk = false;
    const need = toTrain(g);
    if (g.dragonLevel < 5 || g.dragonLevel >= AURA2_LEVEL || g.ObjectsById.some((o, i) => o.amount < need[i])) return false;
    const now = scoreAuras(g, g.dragonAura, g.dragonAura2), amt = g.ObjectsById.map(o => o.amount), lvl = g.dragonLevel, hi = g.cookiesPsRawHighest;
    let after = -Infinity, rebought = -Infinity;
    try {
      g.dragonLevel = AURA2_LEVEL;
      for (const a of AURAS) for (const b of AURAS) if (a !== b) rebought = Math.max(rebought, scoreAuras(g, a, b));   // buildings rebought
      g.ObjectsById.forEach((o, i) => { o.amount -= need[i]; });
      for (const a of AURAS) for (const b of AURAS) if (a !== b) after = Math.max(after, scoreAuras(g, a, b));         // right after
    } finally {
      g.ObjectsById.forEach((o, i) => { o.amount = amt[i]; });
      g.dragonLevel = lvl; CCA.quietGains(g); g.cookiesPsRawHighest = hi;
    }
    // (a) no loss even before rebuying, or (b) the bank rebuys everything now and the stronger auras repay that in an hour
    const dc = g.Upgrades['Dragon cookie'], cookie = dc && !dc.bought ? 1.05 : 1;                // level 26 unlocks it: +5% CpS
    const cost = fullTrainCost(g), cps = g.unbuffedCps || g.cookiesPs || 1, extra = Math.exp(rebought - now) * cookie - 1;
    const repay = cost <= g.cookies && extra * cps * 3600 >= cost;
    worthOk = after >= now || repay;
    CCA.dragonWorth.last = { ratio: Math.exp(after - now), extra, repayH: extra > 0 ? cost / (extra * cps * 3600) : Infinity, ok: worthOk };
    return worthOk;
  }
  // Combo auras: during a click buff (Click frenzy, Dragonflight, Elder frenzy...) clicks are worth hundreds of times
  // more, so a different aura can be better for those seconds, e.g. Dragon Cursor. Every second during a click buff
  // the auras the game's own CalculateGains can measure are tried in each slot, with buffs on. A swap is made when the
  // income gained over the buff's remaining time is at least 3x the two buildings it sacrifices (in, and back out).
  // The normal aura choice is paused until the buff ends, then picks again.
  const COMBO_AURAS = [1, 2, 3, 8, 15, 16, 18];
  let combo = null;
  CCA.comboAura = () => combo;
  function buffedIncome(g, a1, a2) {
    const keep = [g.dragonAura, g.dragonAura2], hi = g.cookiesPsRawHighest;
    try {
      g.dragonAura = a1; g.dragonAura2 = a2; CCA.quietGains(g);
      return g.cookiesPs + g.computedMouseCps * (cfg.clicker ? Number(cfg.clickRate) || 0 : 0);
    } finally { g.dragonAura = keep[0]; g.dragonAura2 = keep[1]; CCA.quietGains(g); g.cookiesPsRawHighest = hi; }
  }
  CCA.every('comboAura', 1000, () => {
    const g = G();
    // Devastation (Godzamok) is the bot's own short, constantly renewed click buff: it neither starts a combo nor sets its length
    const clickBuffs = Object.values(g.buffs).filter(b => b.multClick > 1 && b.name !== 'Devastation');
    if (combo) {
      if (!clickBuffs.length || g.startDate !== combo.run) { CCA.log('combo aura: buff over, normal aura choice resumes'); combo = null; auraT = 0; }
      return;
    }
    if (!cfg.comboAuras || !cfg.dragon || !cfg.clicker || CCA.locked() || CCA.popping || !clickBuffs.length || g.dragonLevel < 6) return;
    const T = clickBuffs.sort((a, b) => b.multClick - a.multClick)[0].time / g.fps;    // the biggest click buff's time left
    if (T < 4) return;
    let top = null; for (const o of g.ObjectsById) if (o.amount > 0) top = o;
    if (!top) return;
    const cost = 2 * top.price, two = g.dragonLevel >= AURA2_LEVEL, have = [g.dragonAura, g.dragonAura2];
    const now = buffedIncome(g, have[0], have[1]);
    let best = null;
    for (const slot of two ? [0, 1] : [0]) for (const a of COMBO_AURAS) {
      if (g.dragonLevel < auraLevel(a) || have.includes(a)) continue;
      // never swap Dragon Guts out mid-combo while its 2 extra wrinkler slots are in use: the game pops those wrinklers
      if (have[slot] === 21 && g.wrinklers.some(w => w.phase > 0 && w.id >= g.getWrinklersMax() - 2)) continue;
      const pair = slot === 0 ? [a, have[1]] : [have[0], a];
      const gain = (buffedIncome(g, pair[0], pair[1]) - now) * T;
      if (!best || gain > best.gain) best = { slot, a, gain };
    }
    if (!best || best.gain < 3 * cost) return;
    combo = { run: g.startDate, prev: have.slice() };
    CCA.guardWatch('comboAuras');
    setAura(best.slot, best.a);
    CCA.log(`combo aura: ${g.dragonAuras[best.a].name} for ${Math.round(T)} s (≈${CCA.fmt(best.gain)} gained for ${CCA.fmt(cost)} of buildings)`);
  });

  let auraT = 0;
  CCA.every('dragon', 5000, () => {
    if (!cfg.dragon || CCA.locked() || CCA.popping) return;
    const g = G();
    if (!g.Has('A crumbly egg')) return;
    const cps = g.unbuffedCps || g.cookiesPs || 1;
    if (CCA.dragonStep(false)) CCA.log('dragon -> level ' + g.dragonLevel);
    else if (g.dragonLevel >= 5 && g.dragonLevel < AURA2_LEVEL) {
      const c = fullTrainCost(g);
      if (c <= cps * 1800 && c <= g.cookies * 0.5 && CCA.dragonStep(true)) CCA.log('dragon fully trained mid-run (second aura slot), level ' + g.dragonLevel);
      if (g.dragonLevel < AURA2_LEVEL && cfg.dragonMidTrain && secondAuraPays(g) &&
          (CCA.dragonWorth.last.ratio >= 1 && CCA.guardWatch('dragonMidTrain'), CCA.dragonStep(true)))   // the repay case dips on purpose
        CCA.log(`dragon fully trained mid-run (x${CCA.dragonWorth.last.ratio.toFixed(2)} income right after, +${(CCA.dragonWorth.last.extra * 100).toFixed(0)}% once the buildings are rebought), level ${g.dragonLevel}`);
    }
    const nm = (a) => (a ? g.dragonAuras[a].name : '');
    const w = CCA.dragonWorth.last;
    CCA.status.dragon = `level ${g.dragonLevel}/${g.dragonLevels.length - 1}` + [nm(g.dragonAura), nm(g.dragonAura2)].filter(Boolean).map(s => ', ' + s).join('')
      + (g.dragonLevel >= 5 && g.dragonLevel < AURA2_LEVEL ? (g.ObjectsById.some((o, i) => o.amount < toTrain(g)[i]) ? ` · full training needs ${toTrain(g)[g.ObjectsById.length - 1]}+ of every building`
        : w ? ` · full training: x${w.ratio.toFixed(2)} right after, +${(w.extra * 100).toFixed(0)}% once rebought${w.ok ? '' : ` (rebuy repays in ${w.repayH > 999 ? '999+' : w.repayH.toFixed(1)} h, waiting for ≤ 1 h or x1.00)`}` : '') : '');
    if (!combo && Date.now() - auraT > 60000) {          // re-scored once a minute; a change needs +2%, filling an empty slot any gain
      auraT = Date.now();
      const { best, gain } = bestAuras(g);
      const empty = !g.dragonAura || (g.dragonLevel >= AURA2_LEVEL && !g.dragonAura2);
      if (gain >= (empty ? 1.0001 : 1.02)) {
        if (best[0] === g.dragonAura2 || best[1] === g.dragonAura) { setAura(1, 0); }   // avoid the same aura twice mid-swap
        if (best[0] !== g.dragonAura) setAura(0, best[0]);
        if (best[1] !== g.dragonAura2 && g.dragonLevel >= AURA2_LEVEL) setAura(1, best[1]);
      }
    }
    petDragon(g);
  });

  // Petting (heavenly upgrade "Pet the dragon", dragon level 8+): each pet has a 1 in 20 chance to drop that quarter
  // hour's item (scale +3% CpS, claw +3% clicks, fang +3% golden cookie gains, teddy bear +3% drops). Done through the
  // dragon tab's own picture click, muted while petting.
  const PET_DROPS = ['Dragon scale', 'Dragon claw', 'Dragon fang', 'Dragon teddy bear'];
  function petDragon(g) {
    if (!cfg.hunt || !g.Has('Pet the dragon') || g.dragonLevel < 8) return;
    if (PET_DROPS.every(d => g.HasUnlocked(d) || g.Has(d))) { if (g.specialTab === 'dragon' && CCA.pettingOpened) { g.ToggleSpecialMenu(0); g.specialTab = ''; CCA.pettingOpened = false; } return; }
    if (g.specialTab !== 'dragon') { g.specialTab = 'dragon'; g.ToggleSpecialMenu(1); CCA.pettingOpened = true; }
    if (!document.getElementById('specialPic')) return;
    const vol = g.volume; g.volume = 0;
    try { for (let i = 0; i < 10; i++) g.ClickSpecialPic(); } finally { g.volume = vol; }
    const got = PET_DROPS.filter(d => g.HasUnlocked(d) && !g.Has(d));
    CCA.status.dragon += ' · petting' + (got.length ? ` (dropped ${got.join(', ')})` : '');
  }

  // --------------------------------------------------------------- Wrinklers
  // Wrinklers pay back what they eat x1.1, and ten attached together multiply output, so normally they are kept.
  // They are popped (a) all of them when it is Halloween/Easter with drops missing (every pop is a drop roll),
  // (b) during the one-run Moistburster sprint (see countHuntOn), (c) right before ascending (cookies count toward chips),
  // (d) the fullest one when its cookies let the optimizer buy something that pays back within the hour.
  // Popping is done like a player: hover the wrinkler (the game re-checks hover every 5 frames), then click it until it
  // bursts (0.75 hp per click). The auto-clicker pauses meanwhile, because ClickCookie clears the game's click flag.
  const attached = (g) => g.wrinklers.filter(w => w.phase === 2 && w.hp > 0);
  CCA.wrinklerPayout = (w) => {                             // the game's own pop multipliers (main.js, wrinkler pop)
    const g = G(); let m = 1.1 * (g.Has('Sacrilegious corruption') ? 1.05 : 1) * (1 + g.auraMult('Dragon Guts') * 0.2) * (w.type === 1 ? 3 : 1);
    if (g.Has('Wrinklerspawn')) m *= 1.05;
    const lvl = g.hasGod ? g.hasGod('scorn') : 0; if (lvl) m *= [1, 1.15, 1.1, 1.05][lvl];
    return w.sucked * m;
  };
  async function clickPop(g, w) {
    const canvas = document.getElementById('backgroundLeftCanvas'); if (!canvas) return false;
    for (let i = 0; i < 15 && w.phase === 2 && w.hp > 0; i++) {
      const px = w.x * g.scale, py = w.y * g.scale + (window.TopBarOffset || 0);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: px, clientY: py, bubbles: true }));
      await sleep(i ? 70 : 250);
      canvas.dispatchEvent(new MouseEvent('click', { clientX: px, clientY: py, bubbles: true }));
      await sleep(70);
    }
    return !(w.phase === 2 && w.hp > 0);
  }
  CCA.popping = false;
  CCA.popWrinklers = async (filter) => {
    if (CCA.popping) return 0;
    const g = G(); let n = 0;
    CCA.popping = true;
    try {
      for (const w of attached(g)) if ((!filter || filter(w)) && await clickPop(g, w)) n++;
    } finally { CCA.popping = false; }
    if (n) CCA.stat('wrinklersPopped', n);
    return n;
  };
  // Burst-count achievements (Wrinklesquisher 50, Moistburster 200) count pops in ONE run: Game.wrinklersPopped resets on
  // ascension. Popping on sight all run long threw the wrinkler income away every run and still never reached 200 before
  // the next ascension, so the hunt is now one sprint: it starts only at full wrath (Elder Pact), with no pledge chain
  // under way, and when the game's own spawn odds say the rest takes 2 h or less. Once started, ascension holds until done.
  const COUNT_GOAL = 200;
  let countRun = 0;                                          // g.startDate of the run whose sprint has started
  CCA.countHuntEta = (g) => {                                // seconds to finish popping on sight (main.js spawn formula)
    const left = COUNT_GOAL - (g.wrinklersPopped || 0); if (left <= 0) return 0;
    let c = 0.00001 * 3 * (g.eff ? g.eff('wrinklerSpawn') : 1);
    if (g.Has('Unholy bait')) c *= 5;
    const lvl = g.hasGod ? g.hasGod('scorn') : 0; if (lvl) c *= [1, 2.5, 2, 1.5][lvl];
    if (g.Has('Wrinkler doormat')) c = 0.1;
    const max = g.getWrinklersMax ? g.getWrinklersMax() : 10;
    return left * (1 / (c * (g.fps || 30)) + 12) / max;    // wait for a spawn + ~10 s crawl to the cookie + the clicks
  };
  CCA.countHuntOn = (g) => {
    if (!cfg.hunt || !cfg.wrinklers || CCA.won('Moistburster')) return false;
    if (countRun === g.startDate) return true;
    const pledging = g.pledgeT > 0 || (g.pledges > 0 && !CCA.won('Elder slumber'));
    if (g.elderWrath < 3 || pledging || CCA.countHuntEta(g) > 2 * 3600) return false;
    countRun = g.startDate;
    CCA.log(`wrinklers: Moistburster sprint started (${g.wrinklersPopped}/${COUNT_GOAL}, about ${CCA.dur(CCA.countHuntEta(g) * 1000)})`);
    return true;
  };
  const seen = new Map();                                    // wrinkler -> when it was first seen attached
  let lastIncomePop = 0;
  CCA.every('wrinklers', 3000, () => {
    if (!cfg.wrinklers || CCA.popping) return;
    const g = G();
    const att = attached(g);
    const max = g.getWrinklersMax ? g.getWrinklersMax() : 10;
    const dropHunt = cfg.seasons && cfg.seasonHunt && (g.season === 'halloween' || g.season === 'easter') && CCA.seasonMissing && CCA.seasonMissing(g.season) > 0;
    const countHunt = CCA.countHuntOn(g);
    const held = att.reduce((s, w) => s + CCA.wrinklerPayout(w), 0);
    const countNote = countHunt ? `, popping for Moistburster (${g.wrinklersPopped}/${COUNT_GOAL}, ~${CCA.dur(CCA.countHuntEta(g) * 1000)} left)`
      : cfg.hunt && !CCA.won('Moistburster') ? ` · kept (Moistburster sprint ${g.elderWrath < 3 ? 'after Elder Pact' : CCA.countHuntEta(g) > 7200 ? 'needs faster spawns' : 'after the pledges'})` : '';
    CCA.status.wrinklers = g.elderWrath > 0 || att.length ? `${att.length}/${max} attached, ${CCA.fmt(held)} inside` + (dropHunt ? ', popping for drops' : countNote) : '';
    if (!att.length) return;
    const now = Date.now(), cps = g.unbuffedCps || g.cookiesPs || 1;
    for (const w of att) if (!seen.has(w)) seen.set(w, now);
    for (const w of seen.keys()) if (!att.includes(w)) seen.delete(w);
    // Drop hunting: every pop rolls for a drop, so wrinklers are popped once they have fed dropPopMin minutes (Balanced:
    // 10, so each pop still pays something back; Achievements preset: 0, at once).
    if (countHunt) { CCA.popWrinklers(w => !CCA.pokeTarget || w !== CCA.pokeTarget); return; }
    if (dropHunt) {
      const min = (Number(cfg.dropPopMin) || 0) * 60e3;
      if (att.some(w => now - seen.get(w) >= min && w !== CCA.pokeTarget)) CCA.popWrinklers(w => w !== CCA.pokeTarget && now - (seen.get(w) || now) >= min);
      return;
    }
    // Income pop. A popped wrinkler leaves its slot empty until a new one arrives (minutes to tens of minutes), so this
    // is rare: only when the purchase would otherwise take 10+ min of saving, only a wrinkler attached for 30+ min,
    // and at most once per 20 min.
    const t = CCA.econ && CCA.econ.target;
    const ripe = att.filter(w => now - seen.get(w) >= 30 * 60e3 && w !== CCA.pokeTarget).sort((a, b) => b.sucked - a.sucked)[0];
    if (t && ripe && now - lastIncomePop >= 20 * 60e3 && t.payback < 3600 && t.price > g.cookies &&
        (t.price - g.cookies) / cps >= 600 && g.cookies + CCA.wrinklerPayout(ripe) >= t.price) {
      lastIncomePop = now;
      CCA.popWrinklers(w => w === ripe).then(n => { if (n) CCA.log(`popped a wrinkler to afford ${t.name} (saves ${CCA.dur((t.price - g.cookies) / cps * 1000)} of waiting)`); });
    }
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

  // Production field, once the seed hunt is over: Whiskerbloom on clay (+0.25% milk each, so +9% milk from 36 tiles,
  // which every kitten upgrade multiplies). Only planted when the game's own gains say the field pays back its seeds
  // at least 1.5x over a plant's life (~8 h on clay). Plants are harvested just before they die of old age, which
  // counts as a mature harvest (Botany enthusiast, Green aching thumb), and replanted.
  let fieldEval = { t: 0, ok: false };
  function fieldWorth(M, g) {
    if (Date.now() - fieldEval.t < 600e3) return fieldEval.ok;
    const wk = M.plants.whiskerbloom, cps = g.unbuffedCps || g.cookiesPs || 1;
    let w = 0; for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (M.plot[y][x][0] === wk.id + 1) w++;
    const keep = M.effs || {}, hi = g.cookiesPsRawHighest, base = (keep.milk || 1) / (1 + 0.0025 * w), tiles = tilesOf(M).length;
    let gain = 0;
    try {
      M.effs = Object.assign({}, keep, { milk: base }); CCA.quietGains(g); const c0 = g.unbuffedCps;
      M.effs = Object.assign({}, keep, { milk: base * (1 + 0.0025 * tiles) }); CCA.quietGains(g);
      gain = (g.unbuffedCps - c0) / Math.max(c0, 1e-9);
    } finally { M.effs = keep; CCA.quietGains(g); g.cookiesPsRawHighest = hi; }
    const ok = gain * cps * 8 * 3600 >= 1.5 * tiles * M.getCost(wk);
    fieldEval = { t: Date.now(), ok, gain };
    return ok;
  }
  function production(M, g) {
    const wk = M.plants.whiskerbloom;
    if (!wk || !wk.unlocked || !fieldWorth(M, g)) return false;
    const clay = M.soils.clay;
    if (M.soilsById[M.soil].key !== 'clay' && M.nextSoil <= Date.now() && M.parent.amount >= clay.req) { const el = document.getElementById('gardenSoil-' + clay.id); if (el) el.click(); }
    const old = 100 - 1.5 * (wk.ageTick + wk.ageTickR), cps = g.unbuffedCps || g.cookiesPs || 1;
    const spare = () => g.cookies - (Number(cfg.bankMult) || 0) * cps;
    let n = 0;
    for (const [x, y] of tilesOf(M)) {
      const tile = M.plot[y][x], cp = tile[0] > 0 ? M.plantsById[tile[0] - 1] : null;
      if (cp && cp !== wk) { if (cp.unlocked || tile[1] >= cp.mature) M.harvest(x, y); continue; }   // weeds, strays
      if (cp) { if (tile[1] >= old) M.harvest(x, y); else { n++; continue; } }
      if (spare() >= M.getCost(wk)) { M.seedSelected = wk.id; M.useTool(wk.id, x, y); n++; }
    }
    M.seedSelected = -1;
    CCA.status.garden = `Whiskerbloom field ${n}/${tilesOf(M).length} (+${(fieldEval.gain * 100).toFixed(1)}% CpS when full) · ${M.harvestsTotal} harvests`;
    return true;
  }

  CCA.gardenStep = () => {
    const g = G(), farm = g.Objects.Farm, M = CCA.minigame('Farm');
    if (!M) {
      CCA.status.garden = !farm.amount ? 'no farms yet' : !farm.level ? 'locked: Farm needs level 1 (1 sugar lump)'
        : farm.minigameLoading ? 'loading…' : 'not loaded: reload the game tab';
      if (farm.level > 0 && !farm.minigameLoading && g.LoadMinigames) g.LoadMinigames();   // the game's own loader
      return 'no garden';
    }
    CCA.status.garden = `${M.plantsUnlockedN}/${M.plantsN} seeds`;
    if (M.plantsUnlockedN >= M.plantsN) {
      // Sacrificing the full seed log gives 10 lumps (and Seedless to nay the first time). After the first time it is only
      // done when the Whiskerbloom field does not pay: then rediscovering the seeds and sacrificing again is free lumps.
      const convert = typeof M.convert === 'function' && (cfg.hunt || cfg.lumps);
      if (convert && !CCA.won('Seedless to nay')) {
        M.convert(); CCA.record('other', 'garden sacrificed', 1, 0, '+10 lumps'); CCA.log('garden: sacrificed the seed log (+10 lumps, Seedless to nay)');
        GP.layout = null; return 'converted';
      }
      if (production(M, g)) return 'production';
      if (convert) {
        M.convert(); CCA.record('other', 'garden sacrificed', 1, 0, '+10 lumps'); CCA.log('garden: sacrificed the seed log again (+10 lumps; the Whiskerbloom field would not pay)');
        GP.layout = null; return 'converted';
      }
      CCA.status.garden += ' (all)'; M.harvestAll(0, 1, 1); return 'complete';
    }
    if (CCA.won('Seedless to nay') && production(M, g)) return 'production';   // relearning after the sacrifice: production first
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
  CCA.every('garden', 6000, () => {
    // one switch (Settings -> Garden mutation planner); an old hidden 'gardenPlanner' flag no longer blocks it
    if (cfg.garden) CCA.gardenStep();
    else CCA.status.garden = 'off (Settings → Garden mutation planner)';
  });

  // ------------------------------------------------------------ Stock market
  // Prices mean-revert to a resting value (10 + 10*id + bank level - 1) and do not react to trades, so rules can be
  // tested offline on a port of the game's tick (tools/market.mjs). tools/market-search.mjs tried ~2,000 rule sets over
  // 40 simulated days; the winner, about 5% above v5.0.1's rules:
  //   buy <= 0.6x rest (no brokers, 20% fee) up to 0.75x rest (60 brokers, 1% fee), not while falling;
  //   sell on the first fast fall (mode 4) above cost, or at 2.5x rest. "Sell at rest" would be -35%.
  // Brokers matter more than the thresholds: 0 -> 60 brokers is +27% profit, see marketUpkeep.
  // Basis is per share in $ (1$ = 1 s of highest raw CpS) incl. the broker fee, persisted; unknown holdings (bought by
  // hand, or before a restore) get the current price as basis instead of being stuck forever as in v4.
  // Cash: only cookies above the Lucky bank, and only while buildings pay back slower than marketGateSec. The market
  // returns 10-15x the $ tied up per day in the sims, which beats a building that pays back in more than ~2 h.
  const MKEY = 'cca5.market';
  let basis = {};
  try { basis = JSON.parse(localStorage.getItem(MKEY) || '{}'); } catch (e) {}
  let basisDirty = false;
  CCA.setInterval(() => { if (basisDirty) { basisDirty = false; try { localStorage.setItem(MKEY, JSON.stringify(basis)); } catch (e) {} } }, 10000);

  CCA.marketStep = () => {
    const M = CCA.minigame('Bank'); if (!M) return;
    const g = G();
    const over = 1 + 0.2 * Math.pow(0.95, M.brokers);
    const buyBelow = Number(cfg.marketBuyBelow) > 0 ? Number(cfg.marketBuyBelow) : 0.75 - 0.75 * (over - 1);
    const cpsHi = g.cookiesPsRawHighest || 1;
    const cps = g.unbuffedCps || g.cookiesPs || 1;
    let held = 0, worth = 0, cost = 0;
    const buys = [];
    for (const good of M.goodsById) {
      if (!good.active) continue;
      const rest = M.getRestingVal(good.id), p = good.val;
      if (good.stock <= 0) { if (basis[good.id]) { delete basis[good.id]; basisDirty = true; } }
      else if (!basis[good.id]) { basis[good.id] = p * over; basisDirty = true; }
      if (good.stock > 0) {
        const b = basis[good.id];
        const sell = p > b && (good.mode === 4 || p >= rest * cfg.marketSellAt);
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
        held++; worth += good.stock * p; cost += good.stock * b;
      }
      const room = M.getGoodMaxStock(good) - good.stock;
      const cheap = p <= rest * buyBelow && good.d > -0.15 && good.mode !== 4 && good.mode !== 2;
      if (room > 0 && cheap && good.last !== 2 && (!basis[good.id] || p * over < basis[good.id])) buys.push({ good, p, rest, room, deep: p <= rest * (buyBelow - 0.15) });
    }
    // buy the deepest discounts first with the cash the economy can spare
    const gateOpen = CCA.econ.bestPayback > cfg.marketGateSec || CCA.econ.bestPayback === Infinity;
    let budget = !CCA.locked() && !CCA.preAscend ? Math.max(0, g.cookies - (Number(cfg.bankMult) || 0) * cps) * cfg.marketSpendPct * (gateOpen ? 1 : 0.5) : 0;
    buys.sort((a, b) => a.p / a.rest - b.p / b.rest);
    for (const { good, p, room, deep } of buys) {
      if (!gateOpen && !deep) continue;                 // buildings first, except for very deep discounts
      const unit = p * over * cpsHi, n = Math.min(room, Math.floor(budget / unit));
      if (n <= 0) continue;
      const had = good.stock, c0 = g.cookies;
      if (!M.buyGood(good.id, n)) continue;
      const spent = c0 - g.cookies; budget -= spent;
      volume.push({ t: Date.now(), v: p * over * n });
      basis[good.id] = had > 0 ? (basis[good.id] * had + p * over * n) / (had + n) : p * over; basisDirty = true;
      CCA.stat('trades');
      CCA.record('market', 'bought ' + good.symbol, n, spent, `$${p.toFixed(2)} (rest $${M.getRestingVal(good.id)})`);
      held += had ? 0 : 1; worth += n * p; cost += n * p * over;
    }
    // the game's own "profit" counts open positions as losses until they are sold; show closed trades and open ones apart
    const closed = M.profit + cost, open = worth - cost, sign = (v) => (v < 0 ? '-$' : '+$') + CCA.fmt(Math.abs(v));
    CCA.status.market = `closed ${sign(closed)} this run · ${held} held (${sign(open)} open)` + (gateOpen ? '' : ' · buildings first');
  };

  // Upkeep: brokers cut the 20% fee (x0.95 each); offices raise stock caps and lead to "Pyramid scheme". A broker costs
  // 20 min of CpS ($1200) and saves 5% of the remaining fee on every buy, so it is hired when the buy volume of the last
  // 6 h says it pays for itself within a day, from cash above the Lucky bank (or when it is under 3% of the bank).
  // v5.0.1 only used the 3% rule and rarely hired any. An office upgrade sacrifices cursors (rebought by the optimizer)
  // when cursors cover cost + 20%. Brokers and offices reset on ascension.
  const volume = [];
  const dailyVolume = () => {
    const now = Date.now();
    while (volume.length && now - volume[0].t > 6 * 3600e3) volume.shift();
    if (!volume.length) return 0;
    return volume.reduce((s, x) => s + x.v, 0) * 86400e3 / Math.max(now - volume[0].t, 2 * 3600e3);
  };
  CCA.marketUpkeep = () => {
    const M = CCA.minigame('Bank'); if (!M) return;
    const g = G();
    const saving = dailyVolume() * 0.2 * Math.pow(0.95, M.brokers) * 0.05;                   // $ per day
    const spare = g.cookies - (Number(cfg.bankMult) || 0) * (g.unbuffedCps || g.cookiesPs || 0);
    if (M.brokers < M.getMaxBrokers() && !CCA.locked() && (M.getBrokerPrice() <= g.cookies * 0.03 || (saving >= 1200 && M.getBrokerPrice() <= spare))) {
      const b = document.getElementById('bankBrokersBuy'), price = M.getBrokerPrice(), had = M.brokers;
      if (b) { b.click(); if (M.brokers > had) CCA.record('market', 'broker #' + M.brokers, 1, price); }
    }
    const of = M.offices[M.officeLevel], cur = g.Objects['Cursor'];
    if (!CCA.locked() && of && of.cost && cur.amount >= of.cost[0] * 1.2 && cur.level >= of.cost[1]) {
      const b = document.getElementById('bankOfficeUpgrade'), lvl = M.officeLevel;
      if (b) { b.click(); if (M.officeLevel > lvl) { CCA.record('market', 'office: ' + M.offices[M.officeLevel].name, 1, 0, of.cost[0] + ' cursors'); CCA.log('market: office -> ' + M.offices[M.officeLevel].name); } }
    }
  };
  // Stocks reset to 0 on ascension: sell everything first (the cookies go into the pre-ascend spend-down).
  CCA.sellAllStocks = () => {
    const M = CCA.minigame('Bank'); if (!M) return 0;
    const g = G(), cpsHi = g.cookiesPsRawHighest || 1; let n = 0;
    for (const good of M.goodsById) {
      if (!good.active || good.stock <= 0) continue;
      const q = good.stock, p = good.val;
      if (M.sellGood(good.id, q)) { n++; CCA.record('market', 'sold ' + good.symbol, q, p * q * cpsHi, 'before ascending'); delete basis[good.id]; basisDirty = true; }
    }
    return n;
  };
  // Stock market achievements, bought in the pre-ascend sequence with the bank (worthless after ascending) and sold a
  // tick later, so they cost only the broker fee and the price drift on cookies that would vanish anyway:
  //   Buy buy buy (one purchase worth a day of CpS) and Make my day (one sale worth a day: the same lot, 10% margin),
  //   Full warehouses (1000 of one good), Rookie numbers (100 of every good), No nobility in poverty (500 of every good).
  // Each is only bought when the bank covers it and the warehouses have room; otherwise it waits for a richer ascension.
  CCA.stockAchBuy = () => {
    const M = CCA.minigame('Bank'); if (!M) return { bought: 0, pending: false };
    const g = G(), cpsHi = g.cookiesPsRawHighest || 1, over = 1 + 0.01 * (20 * Math.pow(0.95, M.brokers));
    const goods = M.goodsById.filter(x => x.active), all = goods.length === M.goodsById.length;
    const unit = (x) => x.val * over * cpsHi, room = (x) => M.getGoodMaxStock(x) - x.stock;
    let bought = 0, pending = false;
    const buy = (x, n, why) => {
      if (n <= 0) return true;
      if (x.last === 2) { pending = true; return false; }          // sold this tick: wait for the next one
      const c0 = g.cookies;
      if (!M.buyGood(x.id, n)) return false;
      bought++; CCA.record('market', 'bought ' + x.symbol, n, c0 - g.cookies, why);
      CCA.log(`pre-ascend: bought ${n} ${x.symbol} for ${why}`);
      return true;
    };
    if ((!CCA.won('Buy buy buy') || !CCA.won('Make my day')) && !goods.some(x => x.stock * x.val >= 86400)) {
      const c = goods.map(x => ({ x, n: Math.ceil(86400 * 1.1 / x.val) })).filter(c => c.n <= room(c.x)).sort((a, b) => b.x.val - a.x.val)[0];
      if (c && c.n * unit(c.x) <= g.cookies) buy(c.x, c.n, 'Buy buy buy / Make my day');
    }
    if (!CCA.won('Full warehouses') && !goods.some(x => x.stock >= 1000)) {
      const x = goods.filter(x => M.getGoodMaxStock(x) >= 1000).sort((a, b) => a.val - b.val)[0];
      if (x && (1000 - x.stock) * unit(x) <= g.cookies) buy(x, 1000 - x.stock, 'Full warehouses');
    }
    for (const [ach, k] of [['Rookie numbers', 100], ['No nobility in poverty', 500]]) {
      if (CCA.won(ach) || !all || goods.some(x => M.getGoodMaxStock(x) < k)) continue;
      if (goods.reduce((s, x) => s + Math.max(0, k - x.stock) * unit(x), 0) > g.cookies) continue;
      for (const x of goods) if (x.stock < k) buy(x, k - x.stock, ach);
    }
    return { bought, pending };
  };
  CCA.stocksHeld = () => { const M = CCA.minigame('Bank'); return M ? M.goodsById.filter(x => x.active && x.stock > 0).length : 0; };
  CCA.every('market', 5000, () => { if (cfg.market) { CCA.marketStep(); CCA.marketUpkeep(); } });

  console.log('[CCA] minigames loaded');
})();
