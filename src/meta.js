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
  // Order: income and restart speed first, then the sugar-lump upgrades (lumps are the long pole for 100%), then
  // achievement enablers, then the rest cheapest-first.
  const PRIORITY = ['Legacy', 'Heavenly cookies', 'How to bake your dragon', 'Starter kit', 'Season switcher', 'Heavenly luck',
    'Lasting fortune', 'Lucky digit', 'Decisive fate', 'Starter kitchen', 'Divine discount', 'Divine sales', 'Halo gloves',
    'Kitten angels', 'Synergies Vol. I', 'Lucky number', 'Divine bakeries', 'Five-finger discount', 'Twin Gates of Transcendence',
    'Stevia Caelestis', 'Sugar aging process', 'Diabetica Daemonicus', 'Sucralosia Inutilis', 'Synergies Vol. II', 'Wrinkly cookies',
    'Angels', 'Belphegor', 'Elder spice', 'Persistent memory', 'Heralds', 'Lucky payout', 'Wrapping paper', 'Fortune cookies',
    'Keepsakes', 'Sugar crystal cookies', 'Shimmering veil', 'Reinforced membrane', 'Permanent upgrade slot I'];
  const rank = (u) => { const i = PRIORITY.indexOf(u.name); return i >= 0 ? i : 1000; };
  function buyHeavenly(g) {
    let bought = 0;
    for (let guard = 0; guard < 500; guard++) {
      g.BuildAscendTree();
      const open = Object.values(g.PrestigeUpgrades).filter(u => !u.bought && u.canBePurchased && u.getPrice() <= g.heavenlyChips);
      if (!open.length) break;
      open.sort((a, b) => (rank(a) - rank(b)) || (a.getPrice() - b.getPrice()));
      const u = open[0], price = u.getPrice();
      g.PurchaseHeavenlyUpgrade(u.id);
      if (!u.bought) break;
      bought++;
      CCA.record('heavenly', u.name, 1, 0, CCA.fmt(price) + ' chips');
    }
    return bought;
  }
  CCA.buyHeavenly = () => buyHeavenly(G());

  // Permanent upgrade slots carry an upgrade into every new run. Kittens (milk multipliers) are worth the most early in a
  // run, then the priciest cookie upgrades. Left empty until Hardcore is done (a slotted upgrade counts as "purchased").
  const SLOTS = ['I', 'II', 'III', 'IV', 'V'];
  function fillPermanentSlots(g) {
    if (cfg.challenges && !g.HasAchiev('Hardcore')) return 0;
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
  const potential = (g) => g.HowMuchPrestige(g.cookiesReset + g.cookiesEarned);     // continuous prestige level if we ascended now
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
  CCA.ascendRates = () => {
    const g = G(), now = Date.now(), T = (now - g.startDate) / 1000;
    const lNow = L(g, potential(g));
    const W = Math.min(3600, Math.max(300, T * 0.1));
    const old = samples.find(s => s.t >= now - W * 1000) || samples[0];
    const dt = old ? (now - old.t) / 1000 : 0;
    return { T, lNow, gain: Math.exp(lNow), avg: T > 0 ? lNow / T : 0, cur: dt > 30 ? (lNow - L(g, old.q)) / dt : Infinity };
  };

  function holdReason(g) {
    if (CCA.challenge.neverclick || CCA.challenge.hardcore) return 'challenge run';
    if (CCA.locked()) return 'lump harvest';
    if (Object.values(g.buffs).some(b => b.multCpS > 1 || b.multClick > 1)) return 'buff running';
    const extra = wantSince ? Date.now() - wantSince : 0;
    if (extra < 8 * 3600e3) {
      if (CCA.gardenHold && CCA.gardenHold()) return 'new plant growing';
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
  let phase = null, phaseT = 0;
  CCA.ascendStep = () => {
    const g = G();
    if (g.OnAscend) {
      if (g.AscendTimer > 0) return 'anim';
      if (!cfg.ascend) return 'manual';                  // the player ascended by hand: leave the heavenly screen to them
      const n = buyHeavenly(g), p = fillPermanentSlots(g);
      g.Reincarnate(true);
      phase = null;
      CCA.stat('ascensions'); CCA.log(`reincarnated (${n} heavenly upgrades${p ? ', ' + p + ' permanent slots set' : ''}, prestige ${CCA.fmt(g.prestige)})`);
      return 'reincarnated';
    }
    if (g.AscendTimer > 0 || g.ReincarnateTimer > 0) return 'anim';
    if (!CCA.ok()) return 'busy';
    sample(g);
    const pend = pendingChips(g), r = CCA.ascendRates();
    const dec = CCA.shouldAscend(g);
    const hold = dec.go ? holdReason(g) : '';
    if (dec.go && !wantSince) wantSince = Date.now();
    CCA.status.ascend = `+${CCA.fmt(pend)} chips (x${r.gain.toFixed(2)}) · ` + (hold ? 'holding: ' + hold : dec.why);
    if (!cfg.ascend || !dec.go || hold) { phase = null; return 'wait'; }

    const now = Date.now();
    if (!phase) {                                        // 1. full dragon training first: it needs cookies to rebuy what it sacrifices
      phase = 'dragon'; phaseT = now;
      const w = CCA.popWrinklers ? CCA.popWrinklers() : 0;
      if (w) CCA.log(`pre-ascend: popped ${w} wrinklers`);
      if (cfg.dragon && !g.HasAchiev('Here be dragon') && CCA.dragonStep(true)) CCA.log('pre-ascend: dragon trained to level ' + g.dragonLevel);
      return phase;
    }
    if (now - phaseT < 3000) return phase;
    if (phase === 'dragon') {                            // 2. then turn the rest of the bank into building/upgrade counts
      phase = 'spend'; phaseT = now;
      CCA.log(`pre-ascend: ${CCA.spendAll()} purchases`);
      return phase;
    }
    if (CCA.beforeAscend) { try { CCA.beforeAscend(); } catch (e) { CCA.log('beforeAscend: ' + e.message); } }
    if (cfg.backups && !CCA.backup('pre-ascend')) { CCA.log('ascend cancelled: backup failed'); phase = null; return 'nobackup'; }
    CCA.log(`ASCENDING for ${CCA.fmt(pend)} chips (x${r.gain.toFixed(2)})`);
    g.Ascend(true);
    return 'ascending';
  };
  CCA.every('ascend', 2000, () => {
    try { CCA.ascendStep(); } catch (e) { CCA.status.ascend = 'error: ' + e.message; CCA.log('ascend error: ' + e.message); }
  }, { always: true });

  console.log('[CCA] meta loaded');
})();
