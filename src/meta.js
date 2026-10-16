/* v5 meta: achievement tracker, auto-ascend, heavenly shopping, permanent upgrade slots.
 *
 * When to ascend. Prestige multiplies all production, and this run's contribution is
 * L(t) = ln(multiplier after ascending / multiplier now). To maximise long-run growth (the classic renewal argument),
 * restart when the CURRENT rate dL/dt falls below this run's AVERAGE rate L/T: past that point a fresh run, slow start
 * included, grows faster than continuing. Both rates are measured from samples, so golden cookies, minigames and
 * everything else are in the numbers. Extra holds: a new garden plant still growing (ascending wipes the plot), the
 * $10M stock profit achievement close to done (profit resets), a lump harvest in progress, a buff running. */
(() => {
  'use strict';
  const CCA = window.CCA, cfg = CCA.cfg, G = CCA.G;

  // ------------------------------------------------------------ achievements
  const strip = (s) => String(s || '').replace(/<[^>]+>/g, '');
  const normal = () => Object.values(G().AchievementsById).filter(a => a.pool !== 'dungeon' && a.pool !== 'shadow');
  CCA.todo = () => {
    const left = normal().filter(a => !a.won).map(a => ({ name: a.name, how: strip(a.desc).slice(0, 120) }));
    console.table(left);
    return left;
  };
  CCA.every('achievements', 15000, () => {
    const all = normal(), w = all.filter(a => a.won).length;
    CCA.ach = { won: w, total: all.length };
  });

  // ------------------------------------------------------------- heavenly shopping
  // Order: income and restart speed first (a permanent slot early: it carries a kitten into every run), then wrinkler and
  // sugar-lump upgrades, then achievement enablers, then the rest cheapest-first. Chips are saved for a listed upgrade
  // that is within 4x of the current chips instead of being spent on cheaper, lower-ranked ones.
  const PRIORITY = ['Legacy', 'Heavenly cookies', 'How to bake your dragon', 'Permanent upgrade slot I', 'Starter kit', 'Season switcher',
    'Heavenly luck', 'Lasting fortune', 'Decisive fate', 'Starter kitchen', 'Divine discount', 'Divine sales', 'Halo gloves', 'Kitten angels',
    'Pet the dragon', 'Synergies Vol. I', 'Divine bakeries', 'Five-finger discount', 'Twin Gates of Transcendence', 'Stevia Caelestis', 'Sugar baking', 'Sugar craving',
    'Sugar aging process', 'Unholy bait', 'Elder spice', 'Sacrilegious corruption', 'Wrinkly cookies', 'Diabetica Daemonicus',
    'Sucralosia Inutilis', 'Synergies Vol. II', 'Permanent upgrade slot II', 'Angels', 'Belphegor', 'Persistent memory', 'Heralds',
    'Lucky digit', 'Lucky number', 'Lucky payout', 'Wrapping paper', 'Fortune cookies', 'Starspawn', 'Starsnow', 'Starterror', 'Starlove',
    'Startrade', 'Keepsakes', 'Sugar crystal cookies', 'Shimmering veil', 'Reinforced membrane', 'Permanent upgrade slot III',
    'Distilled essence of redoubled luck', 'Chimera', 'Permanent upgrade slot IV', 'Permanent upgrade slot V'];
  const rank = (u) => { const i = PRIORITY.indexOf(u.name); return i >= 0 ? i : 1000; };
  function buyHeavenly(g) {
    let bought = 0, saving = '';
    for (let guard = 0; guard < 500; guard++) {
      g.BuildAscendTree();
      const open = Object.values(g.PrestigeUpgrades).filter(u => !u.bought && u.canBePurchased);
      open.sort((a, b) => (rank(a) - rank(b)) || (a.getPrice() - b.getPrice()));
      // the Lucky upgrades only appear when this prestige level has enough 7s, so they go first (never saved past)
      let pick = open.find(u => /^Lucky (digit|number|payout)$/.test(u.name) && u.getPrice() <= g.heavenlyChips) || null;
      if (!pick) for (const u of open) {
        const price = u.getPrice();
        if (price <= g.heavenlyChips) { pick = u; break; }
        if (rank(u) < 1000 && price <= 4 * g.heavenlyChips) { saving = u.name; break; }
      }
      if (!pick) break;
      const price = pick.getPrice();
      g.PurchaseHeavenlyUpgrade(pick.id);
      if (!pick.bought) break;
      bought++;
      CCA.record('heavenly', pick.name, 1, 0, CCA.fmt(price) + ' chips');
    }
    if (saving) CCA.log('heavenly: saving chips for ' + saving);
    heavenlyStatus(g);
    return bought;
  }
  // Overview row: how much of the heavenly tree is owned and what is next (shows e.g. whether Sugar baking is owned)
  function heavenlyStatus(g) {
    const all = Object.values(g.PrestigeUpgrades || {}).filter(u => u.pool === 'prestige');
    const own = all.filter(u => u.bought).length;
    const next = all.filter(u => !u.bought).sort((a, b) => (rank(a) - rank(b)) || (a.getPrice() - b.getPrice()))[0];
    CCA.status.heavenly = `${own}/${all.length} owned` + (next ? ` · next: ${next.name} (${CCA.fmt(next.getPrice())} chips)` : '');
  }
  CCA.every('heavenlyStatus', 60000, () => { const g = G(); if (g && g.PrestigeUpgrades) heavenlyStatus(g); });
  CCA.buyHeavenly = () => buyHeavenly(G());

  // Permanent upgrade slots carry an upgrade into every new run. Kittens (milk multipliers) are worth the most early in a
  // run, then the priciest cookie upgrades. A slotted upgrade counts as "purchased", which breaks Hardcore, so the slots
  // are emptied only for the run that will attempt it (same test as hunts.js: Neverclick won, second reset or later).
  const SLOTS = ['I', 'II', 'III', 'IV', 'V'];
  const hardcoreNext = (g) => !!(false && cfg.challenges && !g.HasAchiev('Hardcore') && g.HasAchiev('Neverclick') && g.resets + 1 >= 2);
  function fillPermanentSlots(g) {
    if (hardcoreNext(g)) {
      let n = 0;
      SLOTS.forEach((s, i) => { if (g.permanentUpgrades[i] !== -1) { g.permanentUpgrades[i] = -1; n++; } });
      if (n) { g.BuildAscendTree(); CCA.log(`emptied ${n} permanent slots for the Hardcore run`); }
      return 0;
    }
    const owned = SLOTS.map((s, i) => g.Has('Permanent upgrade slot ' + s) ? i : -1).filter(i => i >= 0);
    if (!owned.length) return 0;
    const pool = Object.values(g.Upgrades).filter(u => u.bought && u.unlocked && !u.noPerm && (u.pool === '' || u.pool === 'cookie'))
      .sort((a, b) => ((/^Kitten /.test(b.name) ? 1 : 0) - (/^Kitten /.test(a.name) ? 1 : 0)) || (b.getPrice() - a.getPrice()));
    let n = 0;
    owned.forEach((slot, k) => {
      const u = pool[k];
      if (u && g.permanentUpgrades[slot] !== u.id) { g.permanentUpgrades[slot] = u.id; n++; }   // what the slot dialog's Confirm does
    });
    if (n) g.BuildAscendTree();
    return n;
  }

  // ------------------------------------------------------------- auto-ascend
  // continuous prestige level if we ascended now; wrinklers count, since they are all popped before ascending
  const inWrinklers = (g) => g.wrinklers.reduce((s, w) => s + (w.phase === 2 ? (CCA.wrinklerPayout ? CCA.wrinklerPayout(w) : w.sucked) : 0), 0);
  const potential = (g) => g.HowMuchPrestige(g.cookiesReset + g.cookiesEarned + inWrinklers(g));
  const pendingChips = (g) => Math.floor(potential(g)) - Math.floor(g.HowMuchPrestige(g.cookiesReset));
  const L = (g, q) => Math.log((1 + 0.01 * q) / (1 + 0.01 * g.prestige));
  CCA.pendingChips = () => pendingChips(G());

  let samples = [], runId = 0, wantSince = 0;
  function sample(g) {
    if (g.startDate !== runId) { runId = g.startDate; samples = []; wantSince = 0; }
    const now = Date.now();
    if (!samples.length || now - samples[samples.length - 1].t >= 20000) {
      samples.push({ t: now, q: potential(g) });
      if (samples.length > 2000) samples.splice(0, samples.length - 2000);
    }
  }
  // Bursts (cookie chains, storms, a big Lucky) are one-off luck: left in, they lift the run average and then make the
  // growth that follows look slow, which used to trigger an early ascension. Each 20 s step is capped at 4x the median
  // step of the 5 minutes around it, for both the average and the current rate. The real gain is still reported.
  CCA.ascendRates = () => {
    const g = G(), now = Date.now(), T = (now - g.startDate) / 1000;
    const lNow = L(g, potential(g));
    const st = samples.map((s, i) => (i ? { t: s.t, dt: (s.t - samples[i - 1].t) / 1000, dl: L(g, s.q) - L(g, samples[i - 1].q) } : null)).slice(1);
    let excess = 0;
    for (let i = 0; i < st.length; i++) {
      const near = st.slice(Math.max(0, i - 7), i + 8).map(x => x.dl / x.dt).sort((a, b) => a - b);
      const med = near[Math.floor(near.length / 2)];
      const cap = Math.max(med, 0) * 4 * st[i].dt;
      st[i].cl = near.length >= 5 && st[i].dl > cap ? cap : st[i].dl;
      excess += st[i].dl - st[i].cl;
    }
    const lCap = lNow - excess;
    const W = Math.min(3600, Math.max(300, T * 0.1));
    const win = st.filter(x => x.t > now - W * 1000), dt = win.reduce((s, x) => s + x.dt, 0);
    return { T, lNow, gain: Math.exp(lNow), avg: T > 0 ? lCap / T : 0, cur: dt > 30 ? win.reduce((s, x) => s + x.cl, 0) / dt : Infinity, spikes: excess };
  };

  function holdReason(g, committed) {
    if (CCA.challenge.neverclick || CCA.challenge.hardcore) return 'challenge run';
    if (CCA.locked()) return 'lump harvest';
    if (committed) return '';                            // pre-ascend already under way: golden-cookie buffs no longer restart it
    const extra = wantSince ? Date.now() - wantSince : 0;
    if (extra < 8 * 3600e3) {
      // Godzamok's Devastation is the bot's own near-constant combo buff; it must not hold ascension forever
      if (Object.values(g.buffs).some(b => b.name !== 'Devastation' && (b.multCpS > 1 || b.multClick > 1))) return 'buff running';
      if (CCA.gardenHold && CCA.gardenHold()) return 'new plant growing';
      // the Grandmapocalypse research chain restarts every run; let it finish so the wrinklers can pay off
      if (cfg.wrinklers && !g.Has('Elder Pact') && !g.Has('Elder Covenant') && g.Has('Bingo center/Research facility')) return 'Grandmapocalypse research';
      // Elder slumber needs 5 pledges in one run (the count resets on ascension); hold once they have started
      if (cfg.hunt && !g.HasAchiev('Elder slumber') && g.pledges > 0 && g.pledges < 5) return `Elder Pledges (${g.pledges}/5)`;
      // the Moistburster sprint counts pops in this run only; once started it finishes before ascending
      if (CCA.countHuntOn && CCA.countHuntOn(g)) return `Moistburster sprint (${g.wrinklersPopped}/200)`;
      // Hide & seek champion needs all 20 eggs unlocked in the same run
      if (cfg.hunt && cfg.seasonHunt && g.season === 'easter' && !g.HasAchiev('Hide & seek champion')) {
        const miss = g.easterEggs.filter(e => !g.HasUnlocked(e)).length;
        if (miss > 0 && miss <= 4) return `${miss} Easter eggs left`;
      }
      const M = CCA.minigame('Bank');
      if (M && cfg.hunt && !g.HasAchiev('Liquid assets') && M.profit > 0) {
        const runS = (Date.now() - g.startDate) / 1000, eta = (1e7 - M.profit) / (M.profit / runS);
        if (eta < 6 * 3600) return 'stock profit near $10M';
      }
    }
    return '';
  }

  CCA.shouldAscend = (g) => {
    const pend = pendingChips(g), r = CCA.ascendRates();
    if (pend < 1) return { go: false, why: 'no chips yet' };
    if (r.T < (Number(cfg.ascendMinMinutes) || 0) * 60) return { go: false, why: 'run too young' };
    if (!g.Has('Legacy')) return { go: pend >= 20, why: pend >= 20 ? 'first ascension' : `first ascension at 20 chips (${pend})` };
    if (r.gain < (Number(cfg.ascendMinGain) || 1)) return { go: false, why: 'gain too small' };
    if (r.cur >= r.avg) return { go: false, why: 'still growing faster than average' };
    return { go: true, why: 'growth slowed below run average' };
  };

  // Pre-ascend runs over several ticks so the game sees the higher building counts (achievements are checked by the
  // game loop) before the dragon's full training sacrifices buildings.
  let phase = null, phaseT = 0, popDone = false, stockAchBought = false, luckyT = 0, luckyP = null, popRun = 0, popping = false, backupFails = 0;
  const LUCKY = [['Lucky digit', 1], ['Lucky number', 2], ['Lucky payout', 4]];
  const sevens = (g) => String(Math.floor(g.HowMuchPrestige(g.cookiesReset + g.cookiesEarned))).split('7').length - 1;
  // the 7-counts of the Lucky upgrades that can be bought right after this ascension (missing, parents owned)
  function luckyNeeds(g, waited) {
    const cap = waited > 30 * 60e3 ? 0 : waited > 20 * 60e3 ? 1 : waited > 10 * 60e3 ? 2 : 4;
    const out = [], ok = new Set();                 // a Lucky parent bought in the same ascension screen counts
    for (const [n, k] of LUCKY) {
      const u = g.Upgrades[n];
      if (!u || u.bought || k > cap) continue;
      const parents = (u.parents || []).map(p => (typeof p === 'string' ? g.Upgrades[p] : p));
      if (parents.every(p => p && (p.bought || ok.has(p.name))) && u.getPrice() <= g.heavenlyChips + pendingChips(g)) { out.push(k); ok.add(n); }
    }
    return out;
  }
  CCA.ascendStep = () => {
    const g = G();
    if (g.OnAscend) {
      if (g.AscendTimer > 0) return 'anim';
      if (!cfg.ascend) { CCA.status.ascend = 'on the ascension screen, auto-ascend is off: your turn'; return 'manual'; }
      // each step on its own: a failure is logged and never leaves the run stuck on this screen
      let n = 0, p = 0;
      try { n = buyHeavenly(g); } catch (e) { CCA.log('heavenly shopping failed: ' + e.message); }
      try { p = fillPermanentSlots(g); } catch (e) { CCA.log('permanent slots failed: ' + e.message); }
      CCA.log(`ascension screen: ${n} heavenly upgrades bought, ${p} permanent slots changed, ${CCA.fmt(g.heavenlyChips)} chips left`);
      g.Reincarnate(true);
      phase = null; CCA.preAscend = false;
      CCA.stat('ascensions'); CCA.log(`reincarnated (${n} heavenly upgrades${p ? ', ' + p + ' permanent slots set' : ''}, prestige ${CCA.fmt(g.prestige)})`);
      return 'reincarnated';
    }
    if (g.AscendTimer > 0 || g.ReincarnateTimer > 0) return 'anim';
    if (!CCA.ok()) return 'busy';
    sample(g);
    const pend = pendingChips(g), r = CCA.ascendRates();
    const dec = CCA.shouldAscend(g), committed = !!(phase && cfg.ascend);
    const hold = dec.go || committed ? holdReason(g, committed) : '';
    if (dec.go && !wantSince) wantSince = Date.now();
    if (!dec.go && !committed) wantSince = 0;            // a brief dip must not use up the 8 h hold allowance for later
    CCA.status.ascend = `+${CCA.fmt(pend)} chips (x${r.gain.toFixed(2)}) · ` + (hold ? 'holding: ' + hold : committed ? 'ascending: ' + phase : dec.why);
    CCA.preAscend = !!(cfg.ascend && (dec.go || committed) && !hold);
    if (committed && hold) return 'wait';                // lump harvest: pause the sequence, keep its progress
    if (!cfg.ascend || (!dec.go && !committed) || hold) { phase = null; luckyT = 0; luckyP = null; popRun++; return 'wait'; }

    const now = Date.now();
    if (!phase) {                                        // 1. cash in: sell stocks (they reset to 0) and pop wrinklers (real clicks, a few s)
      phase = 'cash'; phaseT = now; popDone = false; const run = ++popRun;
      const s = CCA.sellAllStocks ? CCA.sellAllStocks() : 0;
      if (s) CCA.log(`pre-ascend: sold ${s} stock positions`);
      if (CCA.popWrinklers) CCA.popWrinklers().then(n => { if (run !== popRun) return; popDone = true; if (n) CCA.log(`pre-ascend: popped ${n} wrinklers`); });
      else popDone = true;
      return phase;
    }
    if (phase === 'cash') {                              // 2. Chocolate egg (+5% of the bank) and full dragon training
      // a stock bought this market tick cannot be sold until the next one (60 s), so keep trying
      const left = CCA.sellAllStocks ? (CCA.sellAllStocks(), CCA.stocksHeld()) : 0;
      if ((!popDone || left) && now - phaseT < 75000) return phase;
      phase = 'dragon'; phaseT = now;
      const egg = g.Upgrades['Chocolate egg'];
      if (egg && egg.unlocked && !egg.bought && egg.getPrice() <= g.cookies * 0.04) {
        const c0 = g.cookies; egg.buy();
        if (egg.bought) { CCA.record('upgrade', 'Chocolate egg', 1, 0, `+${CCA.fmt(g.cookies - c0)} cookies`); CCA.log('pre-ascend: opened the Chocolate egg'); }
      }
      if (cfg.dragon && !g.HasAchiev('Here be dragon') && CCA.dragonStep(true)) CCA.log('pre-ascend: dragon trained to level ' + g.dragonLevel);
      return phase;
    }
    if (now - phaseT < 3000) return phase;
    // 3. stock market achievements with the bank, which is worthless after ascending; the stocks are sold again a
    // market tick later (a good cannot be bought in the tick it was sold, nor sold in the tick it was bought)
    if (phase === 'dragon') { phase = 'stockbuy'; phaseT = now; }
    if (phase === 'stockbuy') {
      const r = cfg.stockAch && CCA.stockAchBuy ? CCA.stockAchBuy() : { bought: 0, pending: false };
      if (r.bought) stockAchBought = true;
      if (r.pending && now - phaseT < 70000) return phase;
      phase = 'stocksell'; phaseT = now;
    }
    if (phase === 'stocksell') {
      const left = stockAchBought && CCA.sellAllStocks ? (CCA.sellAllStocks(), CCA.stocksHeld()) : 0;
      if (left && now - phaseT < 75000) return phase;
      stockAchBought = false;
      phase = 'spend'; phaseT = now;                     // 4. then turn the rest of the bank into building/upgrade counts
      CCA.log(`pre-ascend: ${CCA.spendAll()} purchases`);
      return phase;
    }
    // 5. Lucky digit / number / payout only show up in the ascension screen when the new prestige level contains one,
    // two or four 7s. Its low digits change with every cookie baked, so a few checks find one; the demand is relaxed
    // after 10 / 20 / 30 minutes so a missing parent upgrade or bad luck can never hold the ascension for long.
    // wrinklers that attached since the cash-in would be thrown away by the reset (it pays nothing): pop them first
    if (g.wrinklers.some(w => w.phase === 2) && CCA.popWrinklers) {
      if (!popping) { popping = true; CCA.popWrinklers().then(n => { popping = false; if (n) CCA.log(`pre-ascend: popped ${n} more wrinklers`); }); }
      return 'popping';
    }
    if (popping) return 'popping';
    const needs = cfg.luckyAscend ? luckyNeeds(g, now - (luckyT || (luckyT = now))) : [];
    // only the digits that actually change between checks can become 7s; a target they cannot reach is dropped at once
    const P = Math.floor(g.HowMuchPrestige(g.cookiesReset + g.cookiesEarned)), str = String(P), moving = luckyP === null ? str.length : Math.min(str.length, P === luckyP ? 0 : Math.ceil(Math.log10(Math.abs(P - luckyP) + 1)) + 1);
    luckyP = P;
    const reach = (str.slice(0, str.length - moving).split('7').length - 1) + moving;
    const need = Math.max(0, ...needs.filter(k => k <= reach));
    if (need && sevens(g) < need) { CCA.status.ascend = `waiting for a prestige level with ${need} sevens (Lucky upgrades) · now ${sevens(g)}`; return 'lucky'; }
    if (need) CCA.log(`pre-ascend: prestige level ${CCA.fmt(Math.floor(potential(g)))} has ${sevens(g)} sevens (Lucky upgrades)`);
    luckyT = 0; luckyP = null;
    if (CCA.beforeAscend) { try { CCA.beforeAscend(); } catch (e) { CCA.log('beforeAscend: ' + e.message); } }
    if (cfg.backups && !CCA.backup('pre-ascend')) {
      if (++backupFails < 3) { CCA.log('pre-ascend: backup failed, retrying'); return 'nobackup'; }
      if (CCA.notify) CCA.notify('Ascending without a backup', 'the backup failed 3 times (browser storage full?)');
    }
    backupFails = 0;
    CCA.log(`ASCENDING for ${CCA.fmt(pend)} chips (x${r.gain.toFixed(2)})`);
    g.Ascend(true);
    return 'ascending';
  };
  CCA.every('ascend', 2000, () => {
    try { CCA.ascendStep(); } catch (e) { CCA.status.ascend = 'error: ' + e.message; CCA.log('ascend error: ' + e.message); }
  }, { always: true });

  console.log('[CCA] meta loaded');
})();
