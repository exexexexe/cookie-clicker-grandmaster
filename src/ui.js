/* v5 panel. Lives in a shadow root so the game's CSS cannot reach it (and ours cannot reach the game).
 * Tabs: Overview (what the bot is doing), Purchases (everything it spent on, persisted, CSV export), Log, Settings. */
(() => {
  'use strict';
  const CCA = window.CCA, cfg = CCA.cfg, G = CCA.G;

  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel {
    position: fixed; left: 10px; bottom: 10px; z-index: 2147483647; width: 324px;
    font: 12px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #e4e4e4;
    background: #161616; border: 1px solid #2c2c2c; border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0,0,0,.45); user-select: none; overflow: hidden;
  }
  .num { font-variant-numeric: tabular-nums; }
  .muted { color: #8a8a8a; }
  header { display: flex; align-items: center; gap: 8px; padding: 9px 10px 8px 12px; }
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
  .foot { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
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
  `;

  const host = document.createElement('div');
  host.id = 'cca-panel-host';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>
    <div class="panel">
      <header>
        <span class="dot"></span><span class="title">Grandmaster</span><span class="ver">v${CCA.version}</span>
        <span class="spacer"></span>
        <button class="run" title="F8"></button>
        <button class="icon fold" title="Collapse"></button>
      </header>
      <nav>
        <a data-tab="overview">Overview</a><a data-tab="purchases">Purchases</a><a data-tab="log">Log</a><a data-tab="settings">Settings</a>
      </nav>
      <main></main>
    </div>`;
  document.body.appendChild(host);
  const $ = (s) => root.querySelector(s);
  const panel = $('.panel'), main = $('main');
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  $('.run').onclick = () => { cfg.master = !cfg.master; CCA.save(); paint(); };
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
  const SETTINGS = [
    ['Economy', [['clicker', 'Click the big cookie'], ['clickRate', 'Clicks per second', 'num', 1, 50], ['golden', 'Pop golden cookies'], ['wrath', 'Also pop wrath cookies'],
      ['buyBuildings', 'Buy buildings'], ['buyUpgrades', 'Buy upgrades'], ['bankMult', 'Lucky bank (× CpS)', 'num', 0, 100000], ['fill', 'Top up building-count achievements']]],
    ['Sugar lumps', [['lumps', 'Harvest lumps'], ['lumpTiming', 'Time harvests for golden lumps'], ['lumpTricks', 'Rigidel, Dragon\'s Curve, count tricks'], ['spendLumps', 'Spend lumps on levels']]],
    ['Minigames', [['grimoire', 'Grimoire'], ['combo', 'Predict Force the Hand of Fate'], ['pantheon', 'Pantheon'], ['godzamok', 'Godzamok sell-and-rebuy combo'], ['dragon', 'Dragon'], ['wrinklers', 'Wrinklers'],
      ['garden', 'Garden mutation planner'], ['market', 'Stock market'], ['marketBuyBelow', 'Buy below (× resting price, 0 = auto)', 'num', 0, 1, 0.05],
      ['marketSellAt', 'Always sell at (× resting price)', 'num', 1, 5, 0.1], ['seasons', 'Season planner']]],
    ['Achievements', [['hunt', 'One-off hunters'], ['challenges', 'Neverclick and Hardcore runs']]],
    ['Ascension', [['ascend', 'Auto-ascend'], ['ascendMinMinutes', 'Shortest run (minutes)', 'num', 0, 10000], ['backups', 'Save backups']]],
  ];
  function settings() {
    return SETTINGS.map(([title, items]) => `<h4>${title.toUpperCase()}</h4>` + items.map(([k, label, type, min, max, step]) => type === 'num'
      ? `<div class="set"><label for="s-${k}">${label}</label><input id="s-${k}" type="number" data-k="${k}" min="${min}" max="${max}" step="${step || 1}" value="${cfg[k]}"></div>`
      : `<div class="set"><label for="s-${k}">${label}</label><span class="sw"><input id="s-${k}" type="checkbox" data-k="${k}"${cfg[k] ? ' checked' : ''}><i></i></span></div>`).join('')).join('') +
      `<p class="hint">Auto-ascend resets your run when growth slows; a backup is saved first.</p>
       <div class="foot"><button data-act="backup">Backup now</button><button data-act="copy">Copy last backup</button><button data-act="diag">Diag</button></div>`;
  }

  main.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-f]');
    if (chip) { cfg.ui.filter = chip.dataset.f; CCA.save(); lastKey = ''; paint(); return; }
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
  });
  main.addEventListener('change', (e) => {
    const k = e.target.dataset && e.target.dataset.k; if (!k) return;
    if (e.target.type === 'checkbox') cfg[k] = e.target.checked;
    else { const v = Number(e.target.value); if (!isNaN(v)) cfg[k] = Math.min(Number(e.target.max), Math.max(Number(e.target.min), v)); e.target.value = cfg[k]; }
    CCA.save();
    if (k === 'clickRate' || k === 'clicker') CCA.setClickRate && CCA.setClickRate();
    if (k === 'ascend' && cfg.ascend) CCA.log('auto-ascend enabled');
  });

  // ---------------------------------------------------------------- paint
  // Only the visible tab is rendered, and only when its content changed (settings never re-render under the cursor).
  let lastKey = '';
  function paint() {
    $('.dot').classList.toggle('on', !!cfg.master);
    $('.run').textContent = cfg.master ? 'Pause' : 'Resume';
    $('.fold').textContent = cfg.ui.collapsed ? '+' : '–';
    panel.classList.toggle('collapsed', !!cfg.ui.collapsed);
    root.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === cfg.ui.tab));
    if (cfg.ui.collapsed) return;
    const tab = cfg.ui.tab;
    let html, key;
    if (tab === 'purchases') { key = 'p' + CCA.buyRev + cfg.ui.filter; if (key === lastKey) return; html = purchases(); }
    else if (tab === 'log') { key = 'l' + CCA.logRev; if (key === lastKey) return; html = log(); }
    else if (tab === 'settings') { key = 's'; if (key === lastKey) return; html = settings(); }
    else { html = overview(); key = 'o' + html.length + html; if (key === lastKey) return; }
    lastKey = key;
    const top = main.scrollTop;
    main.innerHTML = G() && G().ready || tab === 'settings' ? html : '<div class="empty">Waiting for the game to load…</div>';
    main.scrollTop = top;
  }
  setInterval(paint, 1000);
  paint();
  window.addEventListener('keydown', (e) => { if (e.key === 'F8') setTimeout(paint, 0); });
  CCA.paint = paint;
})();
