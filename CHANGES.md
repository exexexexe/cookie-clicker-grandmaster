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
