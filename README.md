# 🍪 Cookie Clicker Grandmaster

A browser extension that plays [Cookie Clicker](https://orteil.dashnet.org/cookieclicker/) for you, with one goal: **unlock every achievement as fast as the game allows.**

Leave it running in a tab and it clicks, buys, casts spells, tends the garden, trades stocks, hunts achievements and ascends when it's worth it. A small panel shows what it's doing and logs everything it buys.

<p>
  <img src="docs/overview.png" width="300" alt="Overview tab">
  <img src="docs/purchases.png" width="300" alt="Purchases tab">
</p>

## Install (2 minutes)

You only need the files from this repo, nothing else.

1. Click the green **Code** button above → **Download ZIP**.

**Firefox (recommended)**

2. Type `about:debugging#/runtime/this-firefox` in the address bar.
3. Click **Load Temporary Add-on…** and pick the ZIP you just downloaded.
4. Open [Cookie Clicker](https://orteil.dashnet.org/cookieclicker/). The panel appears in the bottom-left corner.

> Firefox removes temporary add-ons when you close it, so you'll redo step 2–3 after a restart.

**Chrome / Edge / Brave**

2. Unzip the download.
3. Go to `chrome://extensions`, switch on **Developer mode** (top right).
4. Click **Load unpacked** and pick the unzipped folder. (A warning about `browser_specific_settings` is harmless.)

## Before you start

- **Back up your save.** In the game: Options → *Export save*, and paste it somewhere safe. The bot also keeps its own backups (Settings → *Backup now*).
- **It will ascend for you.** That resets your run (as ascending always does) when it decides it's worth it. Don't want that? Turn off *Auto-ascend* in Settings.
- **Press F8** any time to pause or resume everything.

## What it does

- **Clicks** the big cookie and every golden cookie and reindeer.
- **Buys** the building or upgrade that pays for itself fastest, and keeps a cookie reserve so golden cookies pay out big.
- **Sugar lumps:** times each harvest so your next lump is usually a **golden** one (2–7 lumps instead of 1). Lumps are the slowest part of 100%, so this matters a lot.
- **Minigames:** predicts spell outcomes in the Grimoire, picks gods in the Pantheon, raises the dragon, breeds every garden seed, and trades on the stock market.
- **Achievement hunting:** dozens of one-off achievements (hidden clicks, the madeleine, gift codes, wrinkler poking, seasons, Neverclick and Hardcore runs…).
- **Ascends** when your progress starts slowing down, and spends your leftover cookies on achievements first.

## The panel

| Tab | What's in it |
|---|---|
| **Overview** | What it's doing right now, achievement progress, and the few things only you can do |
| **Purchases** | Everything it bought, with filters and *Export CSV* |
| **Log** | A running diary of its actions |
| **Settings** | Switch any feature on or off |

## A few achievements need you

The bot can't do these, but the panel reminds you:

- **What's in a name**: click your bakery name and rename it.
- **Cookie-dunker**: make the browser window short until the cookie dips into the milk.
- **Stifling the press**: make the window very narrow, then click the news ticker.
- **Baby it's old outside**: at Christmas, click one of the elf grandmas.

## FAQ

**How long until 100%?** Months. Some achievements are tied to real time (sugar lumps, garden growth, seasons). The bot makes those as fast as possible, but it can't skip them.

**Is this cheating?** It plays the way a very patient, very fast human would: it clicks, buys and times things. It never edits your save or grants achievements directly. Whether that counts as cheating is up to you. 🙂

**Will it mess up my save?** It saves a backup every 10 minutes and before every ascension. Restore the latest one by typing `CCA.restore()` in the browser console (F12).

**Does it work on the Steam version?** No, only the web version at orteil.dashnet.org.

**Something stopped working after a game update?** Type `CCA.diag()` in the console (F12) and open an issue with the output.

---

Curious how it works under the hood? See [HOW-IT-WORKS.md](HOW-IT-WORKS.md). Test notes are in [TESTING.md](TESTING.md).
