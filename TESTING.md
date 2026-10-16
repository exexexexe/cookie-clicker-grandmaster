# Testing

Tested in headless Chromium on the real game code (v2.058, from a public mirror identical to the live `main.js`), served under the real URL. Test setups use console shortcuts (free buildings, `Game.Win` to mark achievements done) to reach the state being tested. The bot itself was not given any shortcuts.

| Area | Result |
|---|---|
| Fresh game, all modules, 40 s | No page errors. 30 clicks/s. Tiny cookie, Here you go and Just wrong fired. |
| Lump type timing | 12/12 harvests produced the predicted next type: bifurcated → caramelized → normal (for Hand-picked) → golden ×6. Golden lumps yielded 2–7. |
| Harvest boosts | Harvested 100 min before normal ripeness (Rigidel + Dragon's Curve + count rounded to 10). Next lump golden. God, aura and swaps restored. |
| Veil | Clicking continues after the veil breaks (v4 stopped). |
| Stock market | Bought a cheap good to its cap; sold on a fast fall and at the cap; sold holdings with unknown cost; no buys while buildings pay back faster. Real game, 20 seeded days × 9 pairs: new rules +1.6% to +6.2% over 5.0.1, ~100 sales/day, median hold ~85 min. Brokers: 30/30 hired with 2 h of spare CpS (5.0.1: 7). |
| Godzamok | Gods migrated to Godzamok / Muridal / Selebrak. 10 s of Click frenzy: 18× the cookies of the same window without the combo; building counts identical afterwards. |
| Ascension | Dragon trained, 387 pre-ascend purchases, backup, ascend, 35 heavenly upgrades, 2 permanent slots filled (kittens owned in the new run). |
| Hunters | Olden days, No time like the present and Tabloid addiction earned. Dialogs and menus left as they were. Wrinkler poked repeatedly without dying. |
| Performance | Late game: frames p50 16.7 ms / p95 16.8 ms while buying ~4,000 items in 90 s. CalculateGains 0.07 ms. |

Market rules come from a port of the game's tick (`tools/market.mjs`, `tools/market-search.mjs`): 3 × 40 simulated days, 18 goods, bank level 1 and 10, 0–60 brokers.

## 6.x (late-game test save, same setup)

| Area | Result |
|---|---|
| Virtual purchases | No CpS achievements awarded beyond the real highest CpS. |
| Pantheon (6.1.7) | Emptied temple filled to Mokalsium / Godzamok / Muridal in 90 s; with 1 swap the empty diamond slot was filled at once; temple screen matched the data. |
| Wrinklers (6.1.5–6.1.6) | Moistburster sprint started after Elder Pact (estimate ~1 h), popped on sight and held ascension; without Unholy bait wrinklers stayed attached. Aura stayed on Dragon Guts through 3 Elder Pledges (6.1.5: 5 aura changes in 90 s). |
| Dragon (6.1.2–6.1.3) | Mid-run training 25 → 27. Breath of Milk kept over Dragon Guts when clicks dominate income. |
| Ascension (6.1.4) | A Frenzy injected mid-sequence did not restart it; ascended in 16 s. |
| Settings (6.1.0) | Presets, ★ markers and Reset to recommended; Balanced applied once on update. |

## Not verified
- Real Firefox (Chromium only).
- Multi-day behaviour: the ascend rule, the garden planner over weeks, season rotation (partly confirmed by real use since 6.0).
- *Liquid assets* ($10M profit in one run) depends on long late-game runs; the ascend hold helps but is untested end to end.
- Lump timing needs 1 ms `Date.now()`. With Firefox's `privacy.resistFingerprinting` (100 ms) it adapts, but golden lumps become rarer.
