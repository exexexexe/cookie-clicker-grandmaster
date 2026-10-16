/* v5 panel. Lives in a shadow root so the game's CSS cannot reach it (and ours cannot reach the game).
 * Tabs: Overview (what the bot is doing), Purchases (everything it spent on, persisted, CSV export), Log, Settings. */
(() => {
  'use strict';
  const CCA = window.CCA, cfg = CCA.cfg, G = CCA.G;

  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel {
    position: fixed; left: 10px; bottom: 10px; z-index: 2147483647; width: 352px;
    font: 12px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #e4e4e4;
    background: #161616; border: 1px solid #2c2c2c; border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0,0,0,.45); user-select: none; overflow: hidden;
  }
  .num { font-variant-numeric: tabular-nums; }
  .muted { color: #8a8a8a; }
  header { display: flex; align-items: center; gap: 8px; padding: 9px 10px 8px 12px; cursor: move; }
  header button { cursor: pointer; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #5d5d5d; flex: none; }
  .dot.on { background: #7fbf6a; }
  .title { font-weight: 600; letter-spacing: .01em; }
  .ver { color: #6f6f6f; font-size: 11px; }
  .spacer { flex: 1; }
  button {
    font: inherit; color: #d6d6d6; background: #222; border: 1px solid #333; border-radius: 5px;
    padding: 3px 9px; cursor: pointer;
  }
  button:hover { background: #2a2a2a; border-color: #3d3d3d; }
  button.icon { padding: 3px 7px; color: #9a9a9a; }
  nav { display: flex; gap: 2px; padding: 0 8px; border-bottom: 1px solid #262626; }
  nav a {
    padding: 6px 6px 7px; color: #8a8a8a; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;
  }
  nav a:hover { color: #cfcfcf; }
  nav a.on { color: #ececec; border-bottom-color: #d4a24c; }
  main { max-height: min(62vh, 520px); overflow-y: auto; padding: 10px 12px 12px; }
  main::-webkit-scrollbar { width: 8px; } main::-webkit-scrollbar-thumb { background: #2e2e2e; border-radius: 4px; }
  .collapsed nav, .collapsed main { display: none; }

  .prog { margin-bottom: 10px; }
  .prog .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .bar { height: 3px; background: #262626; border-radius: 2px; overflow: hidden; }
  .bar > i { display: block; height: 100%; background: #d4a24c; }
  dl { display: grid; grid-template-columns: 78px 1fr; gap: 5px 10px; margin: 0; }
  dt { color: #8a8a8a; }
  dd { margin: 0; color: #dcdcdc; overflow-wrap: anywhere; }
  h4 { margin: 14px 0 6px; font-size: 11px; font-weight: 600; color: #8a8a8a; letter-spacing: .04em; }
  .need { margin: 0 0 6px; } .need b { font-weight: 600; color: #e4e4e4; } .need span { color: #8a8a8a; }
  .err { color: #e07a6a; margin-top: 8px; }

  .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
  .chip { padding: 2px 8px; border-radius: 10px; border: 1px solid #2f2f2f; color: #9a9a9a; cursor: pointer; }
  .chip.on { color: #161616; background: #d4a24c; border-color: #d4a24c; }
  .list { border-top: 1px solid #242424; }
  .item { display: grid; grid-template-columns: 40px 1fr auto; gap: 8px; padding: 5px 0; border-bottom: 1px solid #222; align-items: baseline; }
  .item .t { color: #6f6f6f; }
  .item .n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item .x { display: block; color: #7a7a7a; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item .c { text-align: right; color: #bdbdbd; }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
  .empty { color: #6f6f6f; padding: 12px 0; }

  .log div { padding: 2px 0; display: grid; grid-template-columns: 58px 1fr; gap: 6px; }
  .log .t { color: #6f6f6f; }

  .set { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; }
  .set label { cursor: pointer; flex: 1; }
  .sw { position: relative; width: 26px; height: 14px; flex: none; cursor: pointer; }
  .sw input { opacity: 0; position: absolute; inset: 0; margin: 0; cursor: pointer; }
  .sw i { position: absolute; inset: 0; background: #333; border-radius: 7px; transition: background .12s; pointer-events: none; }
  .sw i::after { content: ''; position: absolute; left: 2px; top: 2px; width: 10px; height: 10px; border-radius: 50%; background: #bdbdbd; transition: transform .12s; }
  .sw input:checked + i { background: #d4a24c; } .sw input:checked + i::after { transform: translateX(12px); background: #161616; }
  .set input[type=number] {
    width: 64px; font: inherit; color: #e4e4e4; background: #1f1f1f; border: 1px solid #333; border-radius: 4px; padding: 2px 5px; text-align: right;
  }
  .hint { color: #6f6f6f; font-size: 11px; margin: -2px 0 4px; }
  .presets { display: flex; gap: 4px; margin-bottom: 6px; }
  .presets button { flex: 1; }
  .presets button.on { color: #161616; background: #d4a24c; border-color: #d4a24c; }
  h4.sec { display: flex; justify-content: space-between; cursor: pointer; padding: 4px 0; margin: 8px 0 2px; border-top: 1px solid #242424; }
  h4.sec:hover span:first-child { color: #cfcfcf; }
  .set .h { display: block; color: #6f6f6f; font-size: 11px; line-height: 1.3; margin-top: 1px; }
  .set { gap: 10px; }
  .star { color: #d4a24c; margin-left: 4px; font-weight: 600; }

  .black {
    position: fixed; inset: 0; z-index: 2147483646; background: #000; display: none; cursor: pointer;
    align-items: center; justify-content: center; text-align: center;
    font: 13px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #3a3a3a;
  }
  .black.on { display: flex; }
  .black b { color: #555; font-weight: 600; }
  `;

  const host = document.createElement('div');
  host.id = 'cca-panel-host';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>
    <div class="panel">
      <header>
        <span class="dot"></span><span class="title">Grandmaster</span><span class="ver">v${CCA.version}</span>
        <span class="spacer"></span>
        <button class="icon graphs" title="Graphs (F10)">📈</button>
        <button class="icon dim" title="Black screen (F9)">◐</button>
        <button class="run" title="F8"></button>
        <button class="icon fold" title="Collapse"></button>
      </header>
      <nav>
        <a data-tab="overview">Overview</a><a data-tab="purchases">Purchases</a><a data-tab="log">Log</a><a data-tab="settings">Settings</a>
      </nav>
      <main></main>
    </div>
    <div class="black"><div><b>Grandmaster is playing</b><br><span class="bl"></span><br>F9 or click to show the game</div></div>`;
  document.body.appendChild(host);
  const $ = (s) => root.querySelector(s);
  const panel = $('.panel'), main = $('main');
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  $('.run').onclick = () => { cfg.master = !cfg.master; CCA.save(); paint(); };
  // Black screen: covers the game's flashes. The tab still counts as visible, so nothing is slowed down.
  const black = $('.black');
  const setBlack = (on) => { cfg.blackout = on; CCA.save(); lastKey = ''; paint(); };
  $('.dim').onclick = () => setBlack(!cfg.blackout);
  black.onclick = () => setBlack(false);
  $('.graphs').onclick = () => CCA.graphs && CCA.graphs.toggle();

  // Drag by the header (not its buttons). Position is kept in cfg.ui.pos and clamped to the window; double-click resets.
  function place() {
    const p = cfg.ui.pos;
    if (!p) { Object.assign(panel.style, { left: '10px', bottom: '10px', top: '' }); return; }
    const r = panel.getBoundingClientRect();
    p.x = Math.min(Math.max(0, p.x), Math.max(0, window.innerWidth - r.width));
    p.y = Math.min(Math.max(0, p.y), Math.max(0, window.innerHeight - 40));
    Object.assign(panel.style, { left: p.x + 'px', top: p.y + 'px', bottom: 'auto' });
  }
  $('header').addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = (ev) => { cfg.ui.pos = { x: ev.clientX - dx, y: ev.clientY - dy }; place(); };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); CCA.save(); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  });
  $('header').addEventListener('dblclick', (e) => { if (!e.target.closest('button')) { delete cfg.ui.pos; CCA.save(); place(); } });
  window.addEventListener('resize', place);
  place();

  // ---------------------------------------------------------------- notifications
  // Desktop notifications for new achievements, ascensions, things that need you and bot errors. At most one every
  // 10 s; anything arriving in between is merged into the next one. Every notification is also written to the log.
  if (!('notify' in cfg)) cfg.notify = false;
  const canNotify = () => typeof Notification !== 'undefined' && Notification.permission === 'granted';
  let queue = [], lastSent = 0, sendTimer = 0;
  function flush() {
    sendTimer = 0;
    if (!queue.length) return;
    const items = queue; queue = []; lastSent = Date.now();
    const title = items.length === 1 ? items[0][0] : `Grandmaster: ${items.length} updates`;
    const body = items.length === 1 ? items[0][1] : items.map(i => i[0] + (i[1] ? ': ' + i[1] : '')).join('\n');
    try { if (cfg.notify && canNotify()) new Notification(title, { body, tag: 'cca', silent: true }); } catch (e) {}
  }
  CCA.notify = (title, body = '') => {
    CCA.log('notify: ' + title + (body ? ' (' + body + ')' : ''));
    if (!cfg.notify) return;
    queue.push([title, body]);
    if (!sendTimer) sendTimer = CCA.setTimeout(flush, Math.max(0, lastSent + 10000 - Date.now()));
  };
  let seenAch = null, seenAsc = null, seenManual = null, seenErr = new Set();
  CCA.setInterval(() => {
    const g = G(); if (!g || !g.ready) return;
    const won = new Set(Object.values(g.AchievementsById).filter(a => a.won).map(a => a.name));
    if (seenAch) {
      const fresh = [...won].filter(n => !seenAch.has(n));
      if (fresh.length > 5) CCA.notify(fresh.length + ' achievements', 'save loaded or imported');   // not real-time wins
      else for (const n of fresh) CCA.notify('Achievement: ' + n, (g.Achievements[n] && g.Achievements[n].pool === 'shadow') ? 'shadow achievement' : '');
    }
    seenAch = won;
    const asc = g.resets;                                // counts manual ascensions too
    if (seenAsc !== null && asc > seenAsc) CCA.notify('Ascended', 'prestige level ' + CCA.fmt(g.prestige));
    seenAsc = asc;
    const man = (CCA.manual ? CCA.manual() : []).map(m => m[0]);
    if (seenManual) for (const n of man) if (!seenManual.includes(n)) CCA.notify('Needs you: ' + n, (CCA.manual().find(m => m[0] === n) || [])[1] || '');
    seenManual = man;
    for (const k of Object.keys(CCA.errors)) if (!seenErr.has(k)) { seenErr.add(k); CCA.notify('Bot error in ' + k, CCA.errors[k]); }
    for (const k of seenErr) if (!(k in CCA.errors)) seenErr.delete(k);
  }, 3000);

  $('.fold').onclick = () => { cfg.ui.collapsed = !cfg.ui.collapsed; CCA.save(); paint(); };
  root.querySelectorAll('nav a').forEach(a => a.onclick = () => { cfg.ui.tab = a.dataset.tab; CCA.save(); lastKey = ''; paint(); });

  // ---------------------------------------------------------------- overview
  function overview() {
    const g = G(), s = CCA.status, ach = CCA.ach || { won: 0, total: 622 };
    const rows = [
      ['Next buy', s.target],
      ['CpS', g && g.ready ? CCA.fmt(g.unbuffedCps || g.cookiesPs) + (g.cookiesPs > (g.unbuffedCps || 0) * 1.01 ? ' (buffed ' + CCA.fmt(g.cookiesPs) + ')' : '') : ''],
      ['Challenge', s.challenge],
      ['Ascend', s.ascend],
      ['Heavenly', s.heavenly],
      ['Background', s.background],
      ['Lumps', s.lumps && s.lumps + (s.lumpNext ? ' · next ' + s.lumpNext : '')],
      ['Lump plan', s.lumpPlan],
      ['Grimoire', s.magic && s.magic + (s.fthof ? ' · ' + s.fthof : '')],
      ['Pantheon', s.pantheon],
      ['Godzamok', s.godzamok],
      ['Dragon', s.dragon],
      ['Garden', s.garden],
      ['Market', s.market],
      ['Season', s.season],
      ['Wrinklers', s.wrinklers],
      ['Poke', s.poke],
    ].filter(r => r[1]);
    const manual = CCA.manual ? CCA.manual() : [];
    const errs = Object.entries(CCA.errors);
    return `
      <div class="prog"><div class="row"><span>Achievements</span><span class="num">${ach.won} / ${ach.total}</span></div>
        <div class="bar"><i style="width:${(100 * ach.won / Math.max(1, ach.total)).toFixed(1)}%"></i></div></div>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd class="num">${esc(v)}</dd>`).join('')}</dl>
      ${manual.length ? `<h4>NEEDS YOU</h4>${manual.map(([n, how]) => `<p class="need"><b>${esc(n)}</b> <span>${esc(how)}</span></p>`).join('')}` : ''}
      ${errs.length ? `<div class="err">${errs.map(([k, v]) => esc(k + ': ' + v)).join('<br>')}</div>` : ''}`;
  }

  // ---------------------------------------------------------------- purchases
  const KINDS = [['all', 'All'], ['building', 'Buildings'], ['upgrade', 'Upgrades'], ['heavenly', 'Heavenly'], ['level', 'Levels'], ['market', 'Market'], ['other', 'Other']];
  const OTHER = new Set(['dragon', 'santa', 'other']);
  const hhmm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  function purchases() {
    const f = cfg.ui.filter || 'all';
    const all = CCA.purchases();
    const list = all.filter(b => f === 'all' || b.k === f || (f === 'other' && OTHER.has(b.k)));
    const shown = list.slice(-250).reverse();
    let day = '';
    const today = new Date().toDateString(), yesterday = new Date(Date.now() - 864e5).toDateString();
    const label = (t) => { const s = new Date(t).toDateString(); return s === today ? 'TODAY' : s === yesterday ? 'YESTERDAY' : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase(); };
    const rows = shown.map(b => {
      const d = label(b.t), sep = d !== day ? (day = d, `<h4>${esc(d)}</h4>`) : '';
      const cost = b.c > 0 ? CCA.fmt(b.c) : '';
      return sep + `<div class="item"><span class="t num">${hhmm(b.t)}</span>
        <span class="n">${esc(b.n)}${b.q > 1 ? ` <span class="muted num">×${b.q}</span>` : ''}${b.x ? `<span class="x">${esc(b.x)}</span>` : ''}</span>
        <span class="c num">${cost}</span></div>`;
    }).join('');
    return `<div class="chips">${KINDS.map(([k, l]) => `<span class="chip${k === f ? ' on' : ''}" data-f="${k}">${l}</span>`).join('')}</div>
      <div class="list">${rows || '<div class="empty">Nothing yet.</div>'}</div>
      <div class="foot"><span class="muted num">${list.length} entries${list.length > 250 ? ' · latest 250 shown' : ''}</span><span class="spacer"></span>
        <button data-act="csv">Export CSV</button><button data-act="clear">Clear</button></div>`;
  }

  // ---------------------------------------------------------------- log
  const log = () => `<div class="log">${CCA.logs.slice().reverse().map(l => `<div><span class="t num">${l.t}</span><span>${esc(l.msg)}</span></div>`).join('') || '<div class="empty">Nothing yet.</div>'}</div>`;

  // ---------------------------------------------------------------- settings
  // Sections fold open and closed (remembered); presets set every playing switch at once; a star marks a switch that
  // differs from the chosen preset. Each switch has a one-line hint.
  const S = (k, l, h) => ({ k, l, h });
  const N = (k, l, min, max, step, h) => ({ k, l, h, num: [min, max, step || 1] });
  const SETTINGS = [
    ['Main', [S('clicker', 'Click the big cookie', 'Most of your income during combos.'), S('golden', 'Pop golden cookies'),
      S('wrath', 'Also pop wrath cookies', 'After the Grandmapocalypse most golden cookies are wrath cookies.'),
      S('buyBuildings', 'Buy buildings'), S('buyUpgrades', 'Buy upgrades'),
      S('ascend', 'Auto-ascend', 'When growth slows below the run average. A backup is saved first.')]],
    ['Combos', [S('grimoire', 'Grimoire'), S('combo', 'Predict Force the Hand of Fate'),
      S('godzamok', 'Godzamok sell-and-rebuy combo'), S('comboAuras', 'Dragon aura swap during combos', 'Only when it gains 3x the two buildings a swap costs.'),
      S('pantheon', 'Pantheon')]],
    ['Dragon & wrinklers', [S('dragon', 'Dragon'), S('dragonMidTrain', 'Full training mid-run', 'Second aura as soon as it outweighs the 250 buildings sacrificed.'),
      S('wrinklers', 'Wrinklers')]],
    ['Garden & market', [S('garden', 'Garden', 'Seed hunt, then Whiskerbloom or sacrifice for lumps.'), S('market', 'Stock market trading', 'Buys dips only while buildings pay back slowly.')]],
    ['Sugar lumps', [S('lumps', 'Harvest lumps'), S('lumpTiming', 'Time harvests for golden lumps'), S('lumpTricks', 'Rigidel, Dragon\'s Curve, count tricks'),
      S('spendLumps', 'Spend lumps on levels'), S('lumpReserve', 'Keep 100 lumps (Sugar baking)', 'Only with Sugar baking: +1% CpS per unspent lump.'),
      S('levelTen', 'Aim for level 10s (Sugar crystal cookies)', '+1% CpS per building type at level 10.')]],
    ['Achievements & seasons', [S('hunt', 'One-off achievement hunters'), S('seasons', 'Seasons', 'Christmas is the home season: Santa, reindeer, Selebrak.'),
      S('seasonHunt', 'Hunt seasonal drops', 'Pops wrinklers for eggs and Halloween cookies, which costs wrinkler income.'),
      S('stockAch', 'Stock market achievements', 'Bought with the bank right before ascending, sold a minute later.'),
      S('luckyAscend', 'Time ascensions for Lucky upgrades', 'Waits for a prestige level with enough 7s.'),
      S('fill', 'Top up building-count achievements')]],
    ['Display', [S('blackout', 'Black screen (F9)'), S('keepAlive', 'Keep running in a background tab'), S('notify', 'Desktop notifications'), S('backups', 'Save backups')]],
    ['Advanced', [N('clickRate', 'Clicks per second', 1, 50), N('bankMult', 'Lucky bank (× CpS)', 0, 100000), N('dropPopMin', 'Pop for drops after (min)', 0, 120),
      N('godzamokMargin', 'Godzamok: gain ≥ × loss', 1, 10, 0.5), N('marketBuyBelow', 'Market: buy below (× rest, 0 = auto)', 0, 1, 0.05),
      N('marketSellAt', 'Market: always sell at (× rest)', 1, 5, 0.1), N('ascendMinMinutes', 'Shortest run (minutes)', 0, 10000),
      S('guard', 'Safety guard', 'Switches a 6.1 feature off if CpS drops after it acts, twice.')]],
  ];
  if (!cfg.ui.open) cfg.ui.open = { Main: true };
  function settings() {
    const P = CCA.PRESETS, diff = CCA.presetDiff(), cur = P[cfg.preset];
    const item = (x) => {
      const star = diff.includes(x.k) ? '<span class="star" title="changed from the preset">★</span>' : '';
      const lab = `<label for="s-${x.k}">${x.l}${star}${x.h ? `<span class="h">${x.h}</span>` : ''}</label>`;
      return x.num
        ? `<div class="set">${lab}<input id="s-${x.k}" type="number" data-k="${x.k}" min="${x.num[0]}" max="${x.num[1]}" step="${x.num[2]}" value="${cfg[x.k]}"></div>`
        : `<div class="set">${lab}<span class="sw"><input id="s-${x.k}" type="checkbox" data-k="${x.k}"${cfg[x.k] ? ' checked' : ''}><i></i></span></div>`;
    };
    const sec = ([title, items]) => {
      const open = !!cfg.ui.open[title], on = items.filter(x => !x.num && cfg[x.k]).length, sw = items.filter(x => !x.num).length;
      const changed = items.filter(x => diff.includes(x.k)).length;
      return `<h4 class="sec" data-sec="${title}"><span>${open ? '▾' : '▸'} ${title.toUpperCase()}</span><span class="muted">${changed ? '★ ' : ''}${sw ? on + '/' + sw + ' on' : ''}</span></h4>` +
        (open ? items.map(item).join('') : '');
    };
    return `<div class="presets">${Object.entries(P).map(([id, p]) => `<button data-preset="${id}" class="${cfg.preset === id ? 'on' : ''}">${p.name}</button>`).join('')}</div>
      <p class="hint">${cur ? cur.hint : ''}${diff.length ? ` <b class="star">★ ${diff.length} changed</b>` : ''}</p>` +
      SETTINGS.map(sec).join('') +
      (cfg.notify && typeof Notification !== 'undefined' && Notification.permission === 'denied' ? '<p class="hint">Notifications are blocked by the browser. Allow them for this site in the address bar.</p>' : '') +
      `<div class="foot"><button data-act="recommended">Reset to recommended</button><span class="spacer"></span><button data-act="backup">Backup now</button><button data-act="copy">Copy backup</button><button data-act="diag">Diag</button></div>`;
  }

  main.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-f]');
    if (chip) { cfg.ui.filter = chip.dataset.f; CCA.save(); lastKey = ''; paint(); return; }
    const sec = e.target.closest('[data-sec]');
    if (sec) { const t = sec.dataset.sec; cfg.ui.open[t] = !cfg.ui.open[t]; CCA.save(); lastKey = ''; paint(); return; }
    const pre = e.target.closest('[data-preset]');
    if (pre) { CCA.applyPreset(pre.dataset.preset); afterPreset(); return; }
    const act = e.target.closest('[data-act]'); if (!act) return;
    const a = act.dataset.act;
    if (a === 'csv') {
      const url = URL.createObjectURL(new Blob([CCA.purchasesCSV()], { type: 'text/csv' }));
      const link = document.createElement('a'); link.href = url; link.download = 'cookie-purchases.csv'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    if (a === 'clear' && confirm('Clear the purchase log?')) { CCA.clearPurchases(); lastKey = ''; paint(); }
    if (a === 'backup') CCA.backup('manual');
    if (a === 'copy') { const b = CCA.backups(); if (b.length) navigator.clipboard.writeText(b[b.length - 1].s).then(() => CCA.log('backup copied to clipboard')); }
    if (a === 'diag') CCA.diag();
    if (a === 'recommended') { CCA.applyPreset('balanced'); afterPreset(); }
  });
  function afterPreset() { CCA.setClickRate && CCA.setClickRate(); lastKey = ''; paint(); }
  main.addEventListener('change', (e) => {
    const k = e.target.dataset && e.target.dataset.k; if (!k) return;
    if (e.target.type === 'checkbox') cfg[k] = e.target.checked;
    else { const v = Number(e.target.value); if (!isNaN(v)) cfg[k] = Math.min(Number(e.target.max), Math.max(Number(e.target.min), v)); e.target.value = cfg[k]; }
    CCA.save();
    if (k === 'clickRate' || k === 'clicker') CCA.setClickRate && CCA.setClickRate();
    if (k === 'ascend' && cfg.ascend) CCA.log('auto-ascend enabled');
    if (k === 'blackout') paint();
    if (k === 'notify' && cfg.notify && typeof Notification !== 'undefined' && Notification.permission === 'default')
      Notification.requestPermission().then(() => { lastKey = ''; paint(); }).catch(() => {});      // must run inside the click
    if (k === 'notify') { lastKey = ''; paint(); }
    lastKey = ''; paint();                                   // refresh the stars and section counts
  });

  // ---------------------------------------------------------------- paint
  // Only the visible tab is rendered, and only when its content changed (settings never re-render under the cursor).
  let lastKey = '';
  function paint() {
    $('.dot').classList.toggle('on', !!cfg.master);
    black.classList.toggle('on', !!cfg.blackout);
    if (cfg.blackout) {
      const g = G(), s = CCA.status;
      $('.bl').textContent = g && g.ready ? [CCA.fmt(g.cookiesPs) + ' per second', s.ascend].filter(Boolean).join(' · ') : '';
    }
    $('.run').textContent = cfg.master ? 'Pause' : 'Resume';
    $('.fold').textContent = cfg.ui.collapsed ? '+' : '–';
    panel.classList.toggle('collapsed', !!cfg.ui.collapsed);
    if (cfg.ui.pos) place();
    root.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === cfg.ui.tab));
    if (cfg.ui.collapsed) return;
    const tab = cfg.ui.tab;
    let html, key;
    if (tab === 'purchases') { key = 'p' + CCA.buyRev + cfg.ui.filter; if (key === lastKey) return; html = purchases(); }
    else if (tab === 'log') { key = 'l' + CCA.logRev; if (key === lastKey) return; html = log(); }
    else if (tab === 'settings') { key = 's' + JSON.stringify(cfg, (k, v) => (k === 'ui' ? undefined : v)) + JSON.stringify(cfg.ui.open); if (key === lastKey) return; html = settings(); }
    else { html = overview(); key = 'o' + html.length + html; if (key === lastKey) return; }
    lastKey = key;
    const top = main.scrollTop;
    main.innerHTML = G() && G().ready || tab === 'settings' ? html : '<div class="empty">Waiting for the game to load…</div>';
    main.scrollTop = top;
  }
  setInterval(paint, 1000);
  paint();
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F8') setTimeout(paint, 0);
    if (e.key === 'F9') { e.preventDefault(); setBlack(!cfg.blackout); }
  });
  CCA.paint = paint;
})();
