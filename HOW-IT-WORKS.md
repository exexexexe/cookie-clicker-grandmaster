# Cookie Clicker Grandmaster v5 (Firefox)

Autoplay for `orteil.dashnet.org/cookieclicker` (game v2.058), built for reaching 100% of the 622 achievements as fast as the game allows.

## Install
1. Firefox 128+ → `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.
2. Open Cookie Clicker. The panel sits bottom-left; **F8** pauses/resumes everything.
3. Temporary add-ons disappear when Firefox restarts (load it again, or sign it with `web-ext sign`).
4. v5 uses new storage keys. Your v4 on/off switches carry over; v4's tuning values do not.

## What limits 100%
- **Sugar lumps.** "Reach level 10" for all 20 buildings costs 1,100 lumps, plus 78 for cursor level 12 (needed for *Pyramid scheme*). At about one lump a day that would take years, so v5 makes nearly every lump **golden** (2–7 lumps each, see below). That is about 4x faster.
- **Cookie totals.** The last "ascend with N cookies baked" achievement needs 1 octodecillion (1e57) in one run, so it takes many ascensions.
- **Time-gated content.** Garden seeds, seasonal drops and 100 ascensions run in parallel with the above.

## How it plays
- **Purchases.** Every building and upgrade is tried virtually with the game's own CpS calculation and ranked by payback time. Buffs are excluded so a Click frenzy does not make mouse upgrades look amazing. A Lucky bank (6000× CpS) is kept. Cheap "Have N buildings" thresholds are topped up.
- **Lumps.** The next lump's type is decided by the exact millisecond you harvest. The bot scans the coming milliseconds with the game's own function and clicks on one that gives the type it wants. Missing types (bifurcated, caramelized, meaty) are targeted once each, then golden every time. At harvest it also briefly slots Rigidel (−1 h), switches the dragon to Dragon's Curve (−5%), and rounds the building count to a multiple of 10. Lumps go to the minigames first, then farm level 9 (full garden), then levels towards 10.
- **Grimoire.** The Force the Hand of Fate outcome is predicted before casting. Bad outcomes are skipped with the cheapest spell predicted to succeed (usually Haggler's charm); good ones are stacked on buffs.
- **Pantheon.** Muridal (diamond) and Selebrak (ruby). No god that makes golden cookies rarer. Each placement costs a swap, as in the game.
- **Dragon.** Levels are trained when rebuying the sacrificed buildings is cheap. Full training for *Here be dragon* happens right before ascending.
- **Garden.** A mutation planner works through every seed. It also fills all 36 tiles once (*In the garden of Eden*) and sacrifices the seed log when it is complete (+10 lumps, *Seedless to nay*).
- **Stock market.** Buys at ≤ 0.7× the resting price. Sells on a fast fall once 3% above cost, or at 1.8× the resting price (rules chosen in `tools/`). It only uses cookies above the Lucky bank, and only while buildings pay back slower than 1 hour.
- **Wrinklers.** Kept attached normally. Popped for Halloween/Easter drops, until 200 have been popped, and right before ascending.
- **Hunters.** Covers: Just wrong, Tiny cookie, Here you go, Tabloid addiction, ticker fortunes (O Fortuna), Olden days, a gift to yourself (No time like the present), Wrinkler poker, the elder pledge/covenant chain, Debt evasion, Eldeer, Fading luck, season planner and Santa. Neverclick and Hardcore are done automatically on a fresh run once it is cheap.
- **Auto-ascend.** Ascends when this run's prestige growth falls below its own average rate (restart overhead included). It holds while a new garden plant is growing, while the $10M stock profit is close, during buffs, and during challenge runs. Before ascending it pops wrinklers, trains the dragon, spends the bank on count achievements, takes a loan (Debt evasion) and saves a backup. Then it buys heavenly upgrades and fills permanent upgrade slots.

## Panel
- **Overview** — what it is doing now, achievement progress, and the few achievements that need you.
- **Purchases** — everything the bot spent on (buildings, upgrades, heavenly, lump levels, market trades, dragon, Santa). Kept across reloads; filter by kind; **Export CSV**.
- **Log** — activity.
- **Settings** — switches and the main numbers.

## Needs you (4 achievements)
What's in a name (rename the bakery), Cookie-dunker (short window), Stifling the press (narrow window, then click the ticker), Baby it's old outside (click an elf grandma at Christmas).

## Console
`CCA.todo()` lists remaining achievements. `CCA.diag()` shows API checks and per-task timings. `CCA.restore()` loads the newest backup. `CCA.purchasesCSV()` returns the purchase log as CSV.

## Rules it keeps
Only things a player can do: clicks, purchases, minigame buttons, the game's own dialogs, timing. It never calls `Game.Win` or edits counters. Wrinklers are popped by zeroing their health, which is what a click does.
