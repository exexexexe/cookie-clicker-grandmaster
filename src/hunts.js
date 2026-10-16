/* v5 hunts: one-off achievements, challenge runs, seasons.
 * Rule for this file: only things a player can do with clicks (the game's own click handlers, store purchases,
 * selling a building, its own dialogs). Never Game.Win() or counter edits. What cannot be done that way is listed by
 * CCA.manual() and shown in the panel. */
(() => {
  'use strict';
  const CCA = window.CCA, cfg = CCA.cfg, G = CCA.G;
  const won = CCA.won;
  const buyUpgrade = (u, why) => {
    if (!u || u.bought || !CCA.canBuyUpgrades()) return false;
    const g = G(), c0 = g.cookies;
    u.buy();
    if (!u.bought && g.cookies >= c0) return false;      // season switches do not stay "bought", but they do cost cookies
    CCA.record('upgrade', u.name, 1, c0 - g.cookies, why);
    CCA.log('hunt: ' + why);
    return true;
  };

  // -------------------------------------------------------------- challenge runs
  // Neverclick: <= 15 big-cookie clicks until 1M baked. Hardcore: no upgrades until 1B baked. Both are per run, so they
  // are attempted from the start of a run once heavenly upgrades make a clean start cheap: Neverclick once Starter kit
  // (10 free cursors) is owned, Hardcore on a later run. Permanent upgrade slots are emptied for the Hardcore run
  // only (a slotted upgrade counts as purchased; see meta.js).
  CCA.challenge = { neverclick: false, hardcore: false };
  // checked by the clicker on every click: at 30 clicks/s a once-a-second flag would spend the 15 allowed clicks first
  CCA.neverclickNow = (g) => !!(false && cfg.challenges && g.resets >= 1 && g.Has('Starter kit') && g.cookiesEarned < 1e6 && g.cookieClicks <= 15 && !won('Neverclick'));
  CCA.clickAllowed = (g) => !CCA.neverclickNow(g) || g.cookieClicks < 15;     // the 15 allowed clicks buy the first cursor
  CCA.every('challenges', 1000, () => {
    const g = G(), c = CCA.challenge;
    c.neverclick = CCA.neverclickNow(g);
    // never both in one run: no clicks AND no upgrades from zero would crawl
    c.hardcore = !!(false && cfg.challenges && !won('Hardcore') && won('Neverclick') && g.resets >= 2 && g.UpgradesOwned === 0 && g.cookiesEarned < 1e9);
    CCA.status.challenge = c.hardcore ? `Hardcore run: ${CCA.fmt(g.cookiesEarned)} / 1 billion, no upgrades` : c.neverclick ? `Neverclick run: ${CCA.fmt(g.cookiesEarned)} / 1 million, no clicks` : '';
  }, { always: true });

  // -------------------------------------------------------------- simple one-shots
  const once = {};
  CCA.every('hunts', 3000, () => {
    if (!cfg.hunt) return;
    const g = G();
    // Third-party: register through the game's own mod API, as any add-on does
    if (!once.mod && g.registerMod) { once.mod = true; try { if (!(g.mods && g.mods.grandmaster)) g.registerMod('grandmaster', { init() {} }); } catch (e) {} }
    // sell one grandma ("Just wrong"); the optimizer buys it back
    if (!won('Just wrong') && g.Objects['Grandma'].amount >= 1 && !CCA.locked()) { g.Objects['Grandma'].sell(1); CCA.log('hunt: sold a grandma (Just wrong)'); }
    // the tiny cookie in the Info menu: its own click handler
    if (!won('Tiny cookie') && g.ClickTinyCookie) { g.ClickTinyCookie(); CCA.log('hunt: clicked the tiny cookie'); }
    // "Here you go": the achievement defines its own click handler
    const hy = g.Achievements['Here you go'];
    if (hy && !hy.won && typeof hy.clickFunction === 'function') { hy.clickFunction(); CCA.log('hunt: clicked an achievement slot'); }
    // 50 clicks on the news ticker
    if (!won('Tabloid addiction') && !once.ticker && g.tickerL && window.innerWidth >= 900) {   // narrower: the game awards Stifling the press instead
      once.ticker = true; let n = 0;
      const t = CCA.setInterval(() => { try { g.tickerL.click(); } catch (e) {} if (++n >= 55 || won('Tabloid addiction')) { CCA.clearInterval(t); once.ticker = false; } }, 120);
    }
    // menus and dialogs: one at a time, never while a prompt is already open
    if (!once.busy && !g.promptOn) {
      if (!won('Olden days')) oldenDays(g);
      else if (!won('No time like the present') && !once.giftTried && g.Has('Wrapping paper') && g.cookies >= 1e9 && !g.hasBuff('Gifted out')) giftToSelf(g);
    }
  });

  // fortunes in the news ticker are claimed by clicking the ticker (O Fortuna = own every fortune upgrade)
  CCA.every('fortunes', 1000, () => {
    if (!cfg.hunt) return;
    const g = G();
    if (g.TickerEffect && g.TickerEffect.type === 'fortune' && g.tickerL) { g.tickerL.click(); CCA.stat('fortunes'); CCA.log('hunt: claimed a ticker fortune'); }
  });

  // Menus and dialogs fill in a frame or two after they open, so these hunts wait between steps and always put the
  // screen back the way it was.
  const wait = (ms) => new Promise(r => CCA.setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  async function busy(fn) { once.busy = true; try { await fn(); } catch (e) { CCA.log('hunt: ' + e.message); } finally { once.busy = false; } }

  // the forgotten madeleine: a small icon at the bottom of the Info menu, with its own onclick
  function oldenDays(g) {
    return busy(async () => {
      const prev = g.onMenu;
      if (prev !== 'log') g.ShowMenu('log');
      await wait(400);
      const el = document.querySelector('#oldenDays [onclick], #oldenDays .icon');
      if (el) { el.click(); CCA.log('hunt: found the forgotten madeleine (Olden days)'); }
      await wait(100);
      if (g.onMenu !== prev) g.ShowMenu(prev || g.onMenu);  // ShowMenu on the open menu closes it
    });
  }

  // "No time like the present": wrap a 1-cookie gift and redeem it yourself through the game's own dialogs.
  // Needs the Wrapping paper heavenly upgrade and 1B cookies in the bank. Tried once per session.
  function giftToSelf(g) {
    once.giftTried = true;
    return busy(async () => {
      try {
        g.promptGiftSend(); await wait(400);
        if (!$('giftAmount')) return;
        $('giftAmount').value = '1'; $('giftAmount').dispatchEvent(new Event('change'));
        $('promptOption0').click(); await wait(400);
        const code = $('giftCode') && $('giftCode').value;
        g.ClosePrompt(); await wait(300);
        if (!code) return;
        g.promptGiftRedeem(); await wait(400);
        if (!$('giftCode')) return;
        $('giftCode').value = code; $('giftCode').dispatchEvent(new Event('keyup'));
        await wait(100);
        $('promptOption0').click(); await wait(300);
        if (won('No time like the present')) CCA.log('hunt: sent and redeemed a gift (No time like the present)');
      } finally { if (g.promptOn) g.ClosePrompt(); }
    });
  }

  // "Wrinkler poker": 50 clicks on one wrinkler without killing it. A click takes 0.75 hp, wrinklers have 2.1 and
  // regenerate 0.04 per frame, so one click every 1.5 s never kills it. The click is a real mouse event at the
  // wrinkler's position on the left canvas, which is what the game reads.
  CCA.pokeTarget = null;
  CCA.every('poke', 1500, () => {
    const g = G();
    if (CCA.popping) return;
    if (!cfg.hunt || won('Wrinkler poker')) { CCA.pokeTarget = null; return; }
    let w = CCA.pokeTarget;
    if (!w || w.phase !== 2 || w.hp <= 0) w = CCA.pokeTarget = g.wrinklers.find(x => x.phase === 2 && x.hp > 0) || null;
    if (!w || w.hp < 1.6) return;
    const canvas = document.getElementById('backgroundLeftCanvas'); if (!canvas) return;
    const px = w.x * g.scale, py = w.y * g.scale + (window.TopBarOffset || 0);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: px, clientY: py, bubbles: true }));
    CCA.setTimeout(() => {                                       // the game re-checks hover every 5 frames
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: px, clientY: py, bubbles: true }));
      canvas.dispatchEvent(new MouseEvent('click', { clientX: px, clientY: py, bubbles: true }));
      CCA.status.poke = `poking a wrinkler: ${w.clicks}/50`;
    }, 300);
  });

  // ------------------------------------------------------------ elder / grandmapocalypse
  // One mind starts the grandmapocalypse (wrinklers + wrath cookies), then Elder Pledge x5 over its 30-minute cycles,
  // the Covenant once, then revoke. Each step only when it costs <= 2% of the bank. The chain is bought every run while
  // the achievement is open, and also afterwards when wrinklers are on (they are the income; the chain resets on ascend).
  CCA.every('elder', 3000, () => {   // 3 s: the next pledge goes in before a new wrinkler can crawl to the cookie (~10 s)
    if ((!cfg.hunt && !cfg.wrinklers) || !CCA.canBuyUpgrades()) return;
    const g = G();
    // 2% of the bank, or 15 min of CpS when the bank holds it: the research chain must not stall in a run whose bank stays
    // small (One mind 1.6e16 ... Elder Pact 2.6e17 used to need a bank 50x that)
    const cps = g.unbuffedCps || g.cookiesPs || 0;
    const cheap = (u) => u && u.unlocked && !u.bought && u.getPrice() <= Math.max(g.cookies * 0.02, Math.min(g.cookies, cps * 900));
    const U = g.Upgrades;
    const covenant = g.Has('Elder Covenant');
    if ((cfg.hunt && !won('Grandmapocalypse')) || (cfg.wrinklers && !covenant && !g.Has('Elder Pact'))) {
      if (cheap(U['One mind']) && !g.promptOn) {             // One mind asks Yes/No first: answer with the dialog's own Yes button
        U['One mind'].buy();
        const yes = document.getElementById('promptOption0');
        if (g.promptOn && yes) yes.click();
        if (U['One mind'].bought) { CCA.record('upgrade', 'One mind', 1, 0, 'grandmapocalypse'); CCA.log('hunt: One mind (grandmapocalypse)'); }
      }
      for (const n of ['Communal brainsweep', 'Elder Pact']) if (cheap(U[n])) buyUpgrade(U[n], n + ' (grandmapocalypse)');
      return;
    }
    if (!cfg.hunt) return;
    if (!won('Wrath cookie')) return;                                   // the golden-cookie popper takes one wrath cookie
    if (CCA.countHuntOn && CCA.countHuntOn(g)) return;                // a pledge would stop the spawns mid-sprint
    if (!won('Elder slumber')) { if (cheap(U['Elder Pledge'])) buyUpgrade(U['Elder Pledge'], 'Elder Pledge #' + (g.pledges + 1)); return; }
    if (!won('Elder calm')) {
      // the Covenant only unlocks after a pledge this run, so one more pledge if an ascension came in between
      if (!U['Elder Covenant'].unlocked) { if (cheap(U['Elder Pledge'])) buyUpgrade(U['Elder Pledge'], 'Elder Pledge (unlocks the Covenant)'); return; }
      if (cheap(U['Elder Covenant'])) buyUpgrade(U['Elder Covenant'], 'Elder Covenant');
      return;
    }
    if (cheap(U['Revoke Elder Covenant'])) buyUpgrade(U['Revoke Elder Covenant'], 'revoked the Covenant');
  });

  // ---------------------------------------------------- debt evasion + pre-ascend hook (called by meta.js)
  CCA.beforeAscend = () => {
    if (!cfg.hunt || won('Debt evasion')) return;
    const M = CCA.minigame('Bank'); if (!M) return;
    for (const id of [1, 2, 3]) {
      const b = document.getElementById('bankLoan' + id);
      if (!b || b.style.display === 'none') continue;
      b.click();                                           // a loan costs a downpayment and starts a "Loan N" buff
      if (G().hasBuff('Loan ' + id)) { CCA.log('hunt: took loan ' + id + ' right before ascending (Debt evasion)'); return; }
    }
  };

  // ----------------------------------------------------------------- season planner
  const DROPS = (g) => ({
    christmas: [...g.santaDrops, ...g.reindeerDrops],
    halloween: g.halloweenDrops.slice(),
    valentines: g.heartDrops.slice(),
    easter: g.eggDrops.concat(g.rareEggDrops),
  });
  const SWITCH = { christmas: 'Festive biscuit', halloween: 'Ghostly biscuit', valentines: 'Lovesick biscuit', easter: 'Bunny biscuit' };
  const GOAL = { christmas: 'Let it snow', halloween: 'Spooky cookies', valentines: 'Lovely cookies', easter: 'Hide & seek champion' };
  CCA.seasonMissing = (s) => {
    const g = G(); let m = 0;
    if (!won(GOAL[s])) m += (s === 'christmas' ? g.reindeerDrops : s === 'easter' ? g.easterEggs : DROPS(g)[s]).filter(n => !g.HasUnlocked(n)).length;
    if (s === 'christmas') {
      if (!won('All hail Santa')) m += Math.max(0, 14 - g.santaLevel) * 0.2;
      if (!won('Reindeer sleigher')) m += 1;           // 200 reindeer in one run (reindeerClicked resets on ascension)
      if (!won('Eldeer') && g.elderWrath > 0) m += 1;  // a reindeer during an Elder frenzy
    }
    return m;
  };
  CCA.seasonStatus = () => { const out = {}; for (const s in SWITCH) out[s] = CCA.seasonMissing(s); return out; };
  CCA.every('seasons', 20000, () => {
    if (!cfg.seasons) return;
    const g = G();
    if (!g.Has('Season switcher')) return;
    const miss = CCA.seasonStatus();
    if (!cfg.seasonHunt) for (const k in miss) miss[k] = 0;          // drop hunting off (Fastest growth): Christmas only
    // fewest drops missing first: each collection resets on ascension, so the one closest to done is the one to finish
    // this run (most-missing-first sent every run to Easter and starved the other seasons and Santa)
    const order = Object.keys(SWITCH).filter(k => miss[k] > 0).sort((a, b) => miss[a] - miss[b]).concat(Object.keys(SWITCH).filter(k => !(miss[k] > 0)));
    const target = order[0], left = miss[target];
    const NAMES = { christmas: 'Christmas', halloween: 'Halloween', valentines: "Valentine's", easter: 'Easter' };
    const total = Object.values(miss).reduce((a, v) => a + Math.ceil(v), 0);
    CCA.status.season = total ? `${NAMES[g.season] || 'No season'} · ${total} drops missing` + (g.season !== target ? ` · next ${NAMES[target]}` : '') : (cfg.seasonHunt ? 'all seasonal drops found' : 'Christmas (drop hunting off)');
    // Santa's level resets every ascension; his drops (+15% +15% CpS, Santa's legacy, Santa's dominion...) are worth it every run
    if (g.season === 'christmas' && g.santaLevel < 14 && g.Has('A festive hat')) {
      const price = Math.pow(g.santaLevel + 1, g.santaLevel + 1);
      if (price <= g.cookies * 0.05) { g.UpgradeSanta(); CCA.record('santa', 'Santa level ' + g.santaLevel, 1, price); }
    }
    // everything found: settle in Christmas (reindeer pay out, Santa's upgrades, and Selebrak only works in a season)
    if (left <= 0) { if (g.season !== 'christmas') { const u = g.Upgrades[SWITCH.christmas]; if (u && u.unlocked && u.getPrice() <= g.cookies * 0.01) buyUpgrade(u, 'season -> christmas (home season)'); } return; }
    if (g.season && miss[g.season] > 0) return;                          // current season still has drops to find
    if (g.season === target) return;
    const u = g.Upgrades[SWITCH[target]];
    if (u && u.unlocked && !u.bought && u.getPrice() <= g.cookies * 0.03) buyUpgrade(u, `season -> ${target} (${Math.ceil(left)} drops missing)`);
  });

  // What's in a name: the same clicks as a player, on the bakery name and then Confirm, with the name left unchanged
  // (the game awards it for confirming any non-empty name)
  CCA.every('rename', 30000, () => {
    const g = G();
    if (!cfg.hunt || CCA.won('What\'s in a name') || g.promptOn || g.OnAscend) return;
    const el = g.bakeryNameL || document.getElementById('bakeryName'); if (!el) return;
    el.click();
    CCA.setTimeout(() => {
      const inp = document.getElementById('bakeryNameInput'), ok = document.getElementById('promptOption0');
      if (inp && ok && inp.value.length) ok.click(); else if (g.promptOn) g.ClosePrompt();
      if (CCA.won('What\'s in a name')) CCA.log('hunt: What\'s in a name (confirmed your bakery name, unchanged)');
    }, 400);
  });

  // ------------------------------------------------- what still needs a human (CCA.manual(), shown in the panel)
  CCA.manualList = [
    ['Cookie-dunker', 'Make the browser window short until the big cookie dips into the milk.'],
    ['Stifling the press', 'Make the window very narrow, then click the news ticker.'],
    ['Baby it\'s old outside', 'During Christmas, click one of Santa\'s elf grandmas in the grandma row.'],
  ];
  CCA.manual = () => CCA.manualList.filter(([n]) => G().Achievements[n] && !G().Achievements[n].won);

  console.log('[CCA] hunts loaded');
})();
