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
