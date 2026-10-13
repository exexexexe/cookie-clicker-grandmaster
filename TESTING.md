# Testing

Tested in headless Chromium on the real game code (v2.058, from a public mirror identical to the live `main.js`), served under the real URL. Test setups use console shortcuts (free buildings, `Game.Win` to mark achievements done) to reach the state being tested. The bot itself was not given any shortcuts.

| Area | Result |
|---|---|
| Fresh game, all modules, 40 s | No page errors. 30 clicks/s. Tiny cookie, Here you go and Just wrong fired. |
| Lump type timing | 12/12 harvests produced the predicted next type: bifurcated → caramelized → normal (for Hand-picked) → golden ×6. Golden lumps yielded 2–7. |
| Harvest boosts | Harvested 100 min before normal ripeness (Rigidel + Dragon's Curve + count rounded to 10). Next lump golden. God, aura and swaps restored. |
| Veil | Clicking continues after the veil breaks (v4 stopped). |
| Stock market | Bought a cheap good to its cap; sold on fast fall and at 1.8×; sold holdings with unknown cost; no buys while buildings pay back faster. |
| Ascension | Dragon trained, 387 pre-ascend purchases, backup, ascend, 35 heavenly upgrades, 2 permanent slots filled (kittens owned in the new run). |
| Hunters | Olden days, No time like the present and Tabloid addiction earned. Dialogs and menus left as they were. Wrinkler poked repeatedly without dying. |
| Challenges | Neverclick uses exactly 15 clicks; Hardcore buys 0 upgrades. |
| Performance | Late game: frames p50 16.7 ms / p95 16.8 ms while buying ~4,000 items in 90 s. CalculateGains 0.07 ms. |

Market rules come from a port of the game's tick (`tools/market.mjs`, `tools/compare.mjs`): 90 simulated days, 18 goods, bank level 1 and 10, 0 and 60 brokers.

## Not verified
- Real Firefox (Chromium only).
- Multi-day behaviour: the ascend rule, the garden planner over weeks, season rotation.
- *Liquid assets* ($10M profit in one run) depends on long late-game runs; the ascend hold helps but is untested end to end.
- Lump timing needs 1 ms `Date.now()`. With Firefox's `privacy.resistFingerprinting` (100 ms) it adapts, but golden lumps become rarer.
