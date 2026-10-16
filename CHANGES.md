# 6.1.6 → 6.1.7
Focus: keep the Pantheon full.
- **Empty Pantheon fixed.** Ascending empties the temple, and worship swaps come back slowly (1 h at 2 left, 4 h at 1, 16 h at 0). The bot placed gods only with 2+ swaps (keeping one for Rigidel) and took gods out for free whenever another layout scored higher, so slots stayed empty for hours. Now only layouts reachable with the swaps in hand are compared: an empty slot is filled for +1% even with the last swap, a replacement needs +3% and keeps a swap for Rigidel, and a god is only taken out when the slot is better off empty.
- **Jeremy** (+10% building CpS, golden cookies rarer) is now considered.
- **Tested.** An emptied temple filled to Mokalsium / Godzamok / Muridal within 90 s; with 1 swap left the diamond slot was filled at once; the temple screen matched.

# 6.1.5 → 6.1.6
Focus: stop wrinklers being popped needlessly.
- **Dragon aura flip-flop fixed.** During an Elder Pledge, Dragon Guts looked worthless, so the aura switched away and back every pledge cycle. Each switch cost a building, and dropping Guts makes the game pop the wrinklers in its 2 extra slots. Guts is now valued for the whole Grandmapocalypse.
- **Combo aura swaps** never remove Dragon Guts while its extra slots are in use.
- **Elder Pledges** (5 in one run for *Elder slumber*; the game pops every wrinkler at each one) are now bought within 3 s of the previous one ending, before new wrinklers reach the cookie.

# 6.1.4 → 6.1.5
Focus: a clear wrinkler strategy.
- **Moistburster as one sprint.** It needs 200 pops in one run (the count resets on ascension), but the bot popped every wrinkler on sight in every run and never got there. Now it's one sprint: started only after Elder Pact, with no pledge chain under way, when the game's spawn odds say it takes ≤ 2 h. Ascension and pledges wait for it. Otherwise wrinklers are kept, and the Wrinklers row says why.

# 6.1.3 → 6.1.4
Focus: a full code review against the game source.
- **No unearned achievements.** The optimizer's virtual purchases asked the game to recalculate CpS, which also awards CpS achievements. Those recalculations are now muted.
- **Lump harvest.** A missed timed harvest now puts the dragon aura and the god back; after 4 misses it harvests with a plain click.
- **Grimoire.** Double casts and Diminish Ineptitude use the right failure chance (each golden cookie on screen adds +15%), and the tower buy-back cost is priced correctly.
- **Seasons** go to the one closest to done (Easter used to starve the others), then Christmas, even during a calendar season.
- **Ascension.** A golden-cookie buff no longer restarts the pre-ascend sequence; wrinklers that attach during the Lucky wait are popped; Lucky upgrades are bought first; a failing backup no longer blocks ascending.
- **Smaller fixes.** Frenzy no longer inflates mouse upgrades; Pantheon moves use the game's drag-and-drop so the temple screen stays in sync; wrinkler payout includes all multipliers; Debt evasion takes one loan; Tabloid addiction only runs on wide windows; the Grandmapocalypse chain no longer stalls in small-bank runs; graph history is capped.

# 6.1.2 → 6.1.3
- **Aura choice.** An empty aura slot is filled for any gain; Reality Bending and Dragon Guts are candidates. Dragon Guts is scored with the wrinkler income it adds.

# 6.1.1 → 6.1.2
- **Dragon training cost fixed.** The rebuy cost was priced far too high, which kept the dragon stuck at level 25. Tested: 25 → 27 mid-run. The Dragon cookie's +5% now counts.

# 6.1.0 → 6.1.1
- **Mid-run dragon training** covers all remaining levels. It trains when income right after is at least today's, or when the bank can rebuy everything and the stronger auras repay it within an hour.

# 6.0.9 → 6.1.0
Focus: presets, a better Settings tab, and more achievements.
- **Presets:** Fastest growth, Balanced (recommended, applied once on update), Achievements.
- **Settings tab:** foldable sections, one-line hints, a ★ on changed settings, and *Reset to recommended*.
- **Combo aura swaps** during click buffs, when the gain is at least 3× the two buildings it costs.
- **New achievements handled:** stock-market ones before ascending (Buy buy buy, Make my day, Full warehouses, Rookie numbers, No nobility in poverty), What's in a name, and Lucky digit / number / payout (waits for a prestige level with enough 7s).
- **Sugar baking:** keeps a 100-lump reserve. Level-10 buildings are scored for Sugar crystal cookies.
- **Safety guard:** if a feature makes CpS drop by more than 10% twice, it is switched off with a notification.
- **Heavenly row** in the Overview.

# 6.0.8 → 6.0.9
- **Dragon second aura** trained mid-run when it pays off; the Dragon row shows the numbers.

# 6.0.7 → 6.0.8
- **Garden** no longer blocked by a hidden setting; the Garden row always says why it isn't running.

# 6.0.6 → 6.0.7
- **Santa** is levelled every run, even after the season achievements are won.

# 6.0.5 → 6.0.6
Focus: pop wrinklers much less often.
- **Pops to afford a purchase are stricter.** Only a wrinkler attached 30+ minutes, only when the purchase would otherwise take 10+ minutes of saving, and at most once every 20 minutes. Each pop leaves the slot empty for a while, which lost income.

# 6.0.4 → 6.0.5
Focus: more lumps from an idle garden.
- **Repeat seed-log sacrifice.** When a Whiskerbloom field doesn't pay, the garden rediscovers all seeds and sacrifices again for another 10 lumps (about one batch every few weeks).
- **No Juicy Queenbeet farm.** Checked against the game code: it doesn't pay (wiped on ascension, 2–4 days to mature, about 48 h of CpS per cycle).

# 6.0.3 → 6.0.4
Focus: stop early ascensions set off by cookie bursts.
- **Burst filter.** A cookie chain, storm or big Lucky raised the run's average growth, so normal growth afterwards looked slow and the bot ascended early. Jumps far above the surrounding growth are now capped in that comparison.
- **Cookies inside wrinklers count**, and ascension waits for the Grandmapocalypse research to finish.

# 6.0.2 → 6.0.3
- **Grandmapocalypse every run.** One mind was only bought for its achievement, so later runs had no wrinklers. It is now bought (answering Yes on its popup), then Communal brainsweep and Elder Pact, whenever wrinklers are on.

# 6.0.1 → 6.0.2
- **Ascension screen fail-safe.** If buying heavenly upgrades or filling permanent slots fails, the bot logs it and reincarnates anyway instead of getting stuck. Each ascension logs what it bought.

# 6.0.0 → 6.0.1
- **Panel header fix.** The Graphs button pushed the minimize button off the panel; it is now a small 📈 icon.

# 5.1.0 → 6.0.0
Focus: bug fixes, more CpS, stricter no-cheating, new UI.
- **Grandmapocalypse starts**, unblocking wrinklers, wrath cookies and about 10 achievements.
- **Neverclick and Hardcore attempts removed.** Clicking is no longer held back at the start of a run, and permanent slots are no longer emptied.
- **Seasons.** Easter counts all 20 eggs and holds ascension while the last few are missing; Christmas stays until *Reindeer sleigher*; then it settles in Christmas.
- **Before ascending:** sells all stocks, pops wrinklers, opens the Chocolate egg.
- **Pantheon** tries every combination of gods with the game's own numbers. **Dragon** trains the second aura mid-run when cheap and pets the dragon for its drops. **Grimoire** looks two casts ahead, double-casts, and uses Diminish Ineptitude to turn a predicted failure into a success. **Garden** sacrifices the seed log once and runs a Whiskerbloom field if it pays.
- **Wrinklers** are kept as income. Wrath cookies are clicked by default.
- **No-cheating fixes.** Wrinklers are popped with real clicks, the loan uses the visible button, *Third-party* goes through the game's mod system.
- **UI.** Desktop notifications (off by default), a resizable Graphs window (F10), and a draggable panel.
- **Godzamok fix.** Auto-ascend could wait forever while combos kept his buff running.

# 5.0.3 → 5.1.0
Focus: keep playing in a hidden tab.
- **Background play.** Bot timers run in a background worker, and when the game's own loop falls behind the bot runs the missed ticks. The Overview shows the game's fps.
- **Black screen** (F9 or ◐) hides the game's flashing while the bot keeps playing.

# 5.0.2 → 5.0.3
- **Permanent upgrade slots** are filled on every ascension (most expensive Kitten upgrades first, then cookies). Slots set by hand are replaced.

# 5.0.1 → 5.0.2

Focus: more cookies per hour.
- **Godzamok combo (new).** Godzamok goes in the diamond slot (Muridal moves to ruby, Selebrak to jade). The bot sells cheap buildings and buys them straight back in the same frame. Godzamok then gives +1% click power per building sold for 10 s, and CpS never drops. A combo only runs when the expected extra clicks are worth at least 3× the sell loss, and the losses stay under half the bank. It never sells Grandmas (selling the last one cancels the Elder Pledge and pops every wrinkler) or the minigame buildings. Test: 18× more cookies during a 10 s Click frenzy, with every building count restored. Toggle: Settings → *Godzamok sell-and-rebuy combo*.
- **Stock market: there was no selling bug.** On the real game code, the bot sold about 100 times a day with a median hold of about 85 minutes. The Overview line was misleading: it showed the game's own "profit", which counts every open position as a loss until it's sold. It now shows closed profit and open positions separately.
- **Stock market rules:** the buy threshold now follows the broker fee (0.6× resting price with no brokers, up to 0.75× with many). The first fast fall above cost sells, without waiting for +3%. The hard cap moved from 1.8× to 2.5×. The new rules came from a search of about 2,000 rule sets (`tools/market-search.mjs`). Paired 20-day runs on the real game code: +1.6% to +6.2% in 9 of 9.
- **Brokers:** hired when the last 6 h of buying says one pays for itself within a day. The old rule needed about 11 h of CpS in the bank and rarely hired any. Going from 0 to 60 brokers is about +20% market profit.
- **Settings migration:** a saved 5.0.1 god list and all market numbers reset to the new defaults once. *Buy below* now defaults to 0 (auto).

# 5.0.0 → 5.0.1

Focus: more golden cookies. For an auto-clicker they are the biggest income source (one Click frenzy is x777 clicks for 13 s).
- **Pantheon:** Muridal (+15% clicks) in diamond and Selebrak in ruby (golden cookies 3% more often during any season, better drop rates); jade stays empty. Mokalsium (golden cookies −15%) and Jeremy (−10%/−3%) cost more in golden cookies than they add, so they are no longer used and are removed (free) if slotted. A saved 5.0.0 default is migrated automatically.
- **Grimoire:** when a bad Force the Hand of Fate outcome is skipped, the cheapest throwaway spell predicted to succeed is used: Haggler's charm (10 + 10% mana) before Conjure baked goods (2 + 40%). More mana is left for Force the Hand of Fate. In tests it picked Haggler's 86% of the time and never when it would backfire.

# v4.0.1 → v5.0.0

## Bugs fixed
- **Shimmering veil read backwards.** The veil is up while you own `Shimmering veil [off]`. v4 stopped clicking for the rest of the run once the veil broke, and its veil hunter tried to buy the veil back (24 h of CpS). v5 always clicks (worth far more than +50% once mouse upgrades exist).
- **Holobore in the default Pantheon.** Clicking any golden cookie unslots Holobore and uses up every swap, so v4 kept re-slotting it. Rigidel was also slotted permanently, but it only works when the building count ends in 0. The new defaults are Mokalsium, Muridal and Jeremy; Rigidel is swapped in only at lump harvest.
- **Pantheon placed gods into empty slots for free.** The game always charges a swap; v5 does too.
- **Market holdings without a recorded cost were never sold.** v5 adopts them at the current price.
- **Market spent 40% of the bank per good.** Three cheap goods in one tick took 78% of the Lucky bank. v5 only uses cash above the Lucky bank, and only while buildings pay back slowly.
- **Market "d < −0.3" exit sold on noise.** It cost 13% profit in the simulations. The fast-fall exit and the 1.8× cap are kept, because they were near-optimal.
- **Optimizer valued purchases during buffs.** A ×777 Click frenzy made mouse upgrades look like the best buy. Buffs are now divided out.
- **Neverclick toggle froze clicks without buying a cursor.** Automatic Neverclick now uses the 15 allowed clicks and checks the limit on every click.

## New
- Golden sugar lumps by harvest timing, plus Rigidel, Dragon's Curve and count tricks at harvest.
- Lump spending ordered for 100%: minigames, farm 9, levels to 10, cursor to 12.
- Growth-rate auto-ascend, with garden, stock profit, buff and challenge holds.
- Pre-ascend sequence: pop wrinklers, full dragon training, spend the bank on count achievements, Debt evasion loan, backup.
- Permanent upgrade slots are filled (kittens first), once Hardcore is done.
- Hunters: ticker fortunes, Olden days, gift to yourself, Wrinkler poker, Eden fill, Seedless to nay, Eldeer, automatic Neverclick and Hardcore.
- Wrinkler policy: keep, except to pop for seasonal drops, for the burst count, and before ascending.
- New panel (shadow DOM): Overview / Purchases / Log / Settings. A persistent purchase log with filters and CSV export.
- The optimizer runs in a 12 ms budget every 250 ms; idle tasks cost under 0.3 ms.
