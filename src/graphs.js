/* v6 graphs: a history sampler (one point a minute, kept across reloads) and a floating chart window (F10 or the
 * panel's Graphs button). Plain canvas, no libraries: content scripts cannot load from a CDN. */
(() => {
  'use strict';
  const CCA = window.CCA, cfg = CCA.cfg, G = CCA.G;

  // ------------------------------------------------------------------ history
  // Point layout (arrays keep localStorage small): t, CpS, prestige, pending chips, achievements, lumps, cookies baked
  // this ascension, ascensions, bank, wrinkler bank, market $ profit.
  const HKEY = 'cca6.history', HMAX = 6000,   // ~1 MB at most: the game's own save shares this storage
  F = { t: 0, cps: 1, pres: 2, pend: 3, ach: 4, lumps: 5, earned: 6, resets: 7, bank: 8, wrink: 9, profit: 10 };
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) {}
  // Older than 2 days: keep one point per 10 minutes. Then cap the length.
  function compact() {
    const old = Date.now() - 2 * 864e5, out = [];
    let lastOld = -Infinity;
    for (const p of hist) {
      if (p[0] < old) { if (p[0] - lastOld < 6e5) continue; lastOld = p[0]; }
      out.push(p);
    }
    hist = out.length > HMAX ? out.slice(-HMAX) : out;
  }
  function sample() {
    const g = G();
    if (!g || !g.ready || g.OnAscend) return;
    const M = CCA.minigame('Bank');
    hist.push([Date.now(), g.unbuffedCps || g.cookiesPs, g.prestige, CCA.pendingChips ? CCA.pendingChips() : 0,
      CCA.ach ? CCA.ach.won : 0, g.lumps, g.cookiesEarned, g.resets, g.cookies,
      g.wrinklers.reduce((s, w) => s + (w.phase > 0 ? w.sucked : 0), 0), M ? M.profit : 0]);
    if (hist.length % 60 === 0 || hist.length > HMAX) compact();
    try { localStorage.setItem(HKEY, JSON.stringify(hist)); }
    catch (e) { hist.splice(0, Math.floor(hist.length / 4)); }      // quota: drop the oldest quarter, retry next minute
    if (win && win.open) draw();
  }
  CCA.setInterval(sample, 60000);
  CCA.setTimeout(sample, 5000);
  CCA.history = () => hist;

  // ------------------------------------------------------------------ window
  const CHARTS = {
    cps: { name: 'CpS', log: true, series: [['CpS', F.cps, '#d4a24c']] },
    prestige: { name: 'Prestige', series: [['Prestige level', F.pres, '#d4a24c'], ['Pending chips', F.pend, '#6aa9d8']] },
    ach: { name: 'Achievements', series: [['Achievements', F.ach, '#7fbf6a']] },
    lumps: { name: 'Lumps', series: [['Sugar lumps', F.lumps, '#c98bd6']] },
    bank: { name: 'Bank', log: true, series: [['Bank', F.bank, '#d4a24c'], ['Wrinklers hold', F.wrink, '#c0675a']] },
  };
  const RANGES = [['1h', 36e5], ['6h', 216e5], ['24h', 864e5], ['7d', 6048e5], ['all', Infinity]];
  if (!cfg.ui.graphs) cfg.ui.graphs = { open: false, expanded: false, x: 360, y: 60, w: 560, h: 340, tab: 'cps', range: '24h' };
  const geo = cfg.ui.graphs;

  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .win {
    position: fixed; z-index: 2147483647; display: none; flex-direction: column; min-width: 340px; min-height: 220px;
    font: 12px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #e4e4e4;
    background: #161616; border: 1px solid #2c2c2c; border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,.45); overflow: hidden;
  }
  .win.open { display: flex; }
  header { display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: move; user-select: none; border-bottom: 1px solid #262626; }
  .title { font-weight: 600; }
  .spacer { flex: 1; }
  button { font: inherit; color: #d6d6d6; background: #222; border: 1px solid #333; border-radius: 5px; padding: 2px 8px; cursor: pointer; }
  button:hover { background: #2a2a2a; }
  .bar { display: flex; flex-wrap: wrap; gap: 4px; padding: 7px 10px 0; user-select: none; }
  .chip { padding: 2px 8px; border-radius: 10px; border: 1px solid #2f2f2f; color: #9a9a9a; cursor: pointer; }
  .chip.on { color: #161616; background: #d4a24c; border-color: #d4a24c; }
  .sep { width: 1px; background: #2c2c2c; margin: 0 4px; }
  .legend { display: flex; gap: 12px; padding: 6px 12px 0; color: #9a9a9a; }
  .legend i { display: inline-block; width: 10px; height: 3px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }
  .plot { position: relative; flex: 1; min-height: 0; margin: 4px 6px 6px; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .grip { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, #3a3a3a 50%, #3a3a3a 60%, transparent 60%, transparent 75%, #3a3a3a 75%, #3a3a3a 85%, transparent 85%); }
  `;
  const host = document.createElement('div');
  host.id = 'cca-graphs-host';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>
    <div class="win">
      <header><span class="title">Graphs</span><span class="spacer"></span>
        <button class="exp" title="Expand"></button><button class="close" title="Close (F10)">×</button></header>
      <div class="bar">${Object.entries(CHARTS).map(([k, c]) => `<span class="chip" data-tab="${k}">${c.name}</span>`).join('')}
        <span class="sep"></span>${RANGES.map(([k]) => `<span class="chip" data-range="${k}">${k}</span>`).join('')}</div>
      <div class="legend"></div>
      <div class="plot"><canvas></canvas></div>
      <div class="grip"></div>
    </div>`;
  document.body.appendChild(host);
  const $ = (s) => root.querySelector(s);
  const box = $('.win'), canvas = $('canvas'), plot = $('.plot');
  const win = { get open() { return !!geo.open; } };

  const clampGeo = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    geo.w = Math.min(Math.max(340, geo.w), vw); geo.h = Math.min(Math.max(220, geo.h), vh);
    geo.x = Math.min(Math.max(0, geo.x), vw - geo.w); geo.y = Math.min(Math.max(0, geo.y), vh - geo.h);
  };
  function layout() {
    box.classList.toggle('open', !!geo.open);
    $('.exp').textContent = geo.expanded ? '⤡' : '⤢';
    $('.exp').title = geo.expanded ? 'Restore' : 'Expand';
    $('.grip').style.display = geo.expanded ? 'none' : '';
    if (geo.expanded) Object.assign(box.style, { left: '24px', top: '24px', width: 'calc(100vw - 48px)', height: 'calc(100vh - 48px)' });
    else { clampGeo(); Object.assign(box.style, { left: geo.x + 'px', top: geo.y + 'px', width: geo.w + 'px', height: geo.h + 'px' }); }
    root.querySelectorAll('[data-tab]').forEach(c => c.classList.toggle('on', c.dataset.tab === geo.tab));
    root.querySelectorAll('[data-range]').forEach(c => c.classList.toggle('on', c.dataset.range === geo.range));
    if (geo.open) draw();
  }
  const toggle = (on = !geo.open) => { geo.open = on; CCA.save(); layout(); };
  CCA.graphs = { toggle, draw: () => draw() };

  $('.close').onclick = () => toggle(false);
  $('.exp').onclick = () => { geo.expanded = !geo.expanded; CCA.save(); layout(); };
  $('.bar').onclick = (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    if (c.dataset.tab) geo.tab = c.dataset.tab; else geo.range = c.dataset.range;
    CCA.save(); layout();
  };
  // drag by the header, resize by the corner grip
  function dragger(el, onMove) {
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button') || geo.expanded) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, g0 = { ...geo };
      const move = (ev) => { onMove(g0, ev.clientX - sx, ev.clientY - sy); layout(); };
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); CCA.save(); };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    });
  }
  dragger($('header'), (g0, dx, dy) => { geo.x = g0.x + dx; geo.y = g0.y + dy; });
  dragger($('.grip'), (g0, dx, dy) => { geo.w = g0.w + dx; geo.h = g0.h + dy; });
  $('header').addEventListener('dblclick', (e) => { if (!e.target.closest('button')) { geo.expanded = !geo.expanded; CCA.save(); layout(); } });
  window.addEventListener('resize', () => layout());
  window.addEventListener('keydown', (e) => { if (e.key === 'F10') { e.preventDefault(); toggle(); } });

  // ------------------------------------------------------------------ drawing
  let view = null, hover = null;
  const fmtT = (t, span) => {
    const d = new Date(t), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return span > 2 * 864e5 ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (span < 8 * 864e5 ? ' ' + hm : '') : hm;
  };
  function draw() {
    if (!geo.open) return;
    const chart = CHARTS[geo.tab] || CHARTS.cps, range = (RANGES.find(r => r[0] === geo.range) || RANGES[2])[1];
    $('.legend').innerHTML = chart.series.map(([n, , c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('');
    const dpr = window.devicePixelRatio || 1, W = plot.clientWidth, H = plot.clientHeight;
    if (!W || !H) return;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    const now = Date.now(), t0 = range === Infinity ? (hist[0] ? hist[0][0] : now) : now - range;
    const pts = hist.filter(p => p[0] >= t0);
    if (pts.length < 2) {
      view = null;
      ctx.fillStyle = '#6f6f6f'; ctx.textAlign = 'center';
      ctx.fillText(hist.length < 2 ? 'Collecting data… (one point a minute)' : 'No data in this range yet', W / 2, H / 2);
      return;
    }
    // y range over all shown series; log charts skip zeros
    const tf = chart.log ? (v) => Math.log10(v) : (v) => v, ok = (v) => chart.log ? v > 0 : isFinite(v);
    let lo = Infinity, hi = -Infinity;
    for (const p of pts) for (const [, i] of chart.series) if (ok(p[i])) { const v = tf(p[i]); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-9) { hi += chart.log ? 0.5 : Math.max(1, Math.abs(hi) * 0.05); lo -= chart.log ? 0.5 : Math.max(1, Math.abs(lo) * 0.05); }
    else { const pad = (hi - lo) * 0.06; hi += pad; if (!chart.log && lo >= 0 && lo - pad < 0) lo = 0; else lo -= pad; }
    const ticks = [0, 1, 2, 3, 4].map(k => CCA.fmt(chart.log ? Math.pow(10, lo + (hi - lo) * k / 4) : lo + (hi - lo) * k / 4));
    const L = Math.ceil(Math.max(...ticks.map(t => ctx.measureText(t).width))) + 14, R = 10, T = 10, B = 20, pw = W - L - R, ph = H - T - B;
    const xa = pts[0][0], xb = Math.max(pts[pts.length - 1][0], xa + 1);
    const X = (t) => L + (t - xa) / (xb - xa) * pw, Y = (v) => T + (1 - (tf(v) - lo) / (hi - lo)) * ph;
    view = { pts, X, chart, L, R, T, B, W, H, Y };
    // grid + labels
    ctx.strokeStyle = '#242424'; ctx.fillStyle = '#6f6f6f'; ctx.lineWidth = 1; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let k = 0; k <= 4; k++) {
      const y = T + (1 - k / 4) * ph;
      ctx.beginPath(); ctx.moveTo(L, Math.round(y) + .5); ctx.lineTo(W - R, Math.round(y) + .5); ctx.stroke();
      ctx.fillText(ticks[k], L - 6, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let k = 0; k <= 4; k++) { const t = xa + (xb - xa) * k / 4; ctx.fillText(fmtT(t, xb - xa), Math.min(Math.max(L + pw * k / 4, L + 20), W - R - 20), H - B + 5); }
    // ascension markers
    ctx.strokeStyle = 'rgba(212,162,76,.35)'; ctx.setLineDash([3, 3]);
    for (let i = 1; i < pts.length; i++) if (pts[i][F.resets] > pts[i - 1][F.resets]) {
      const x = Math.round(X(pts[i][0])) + .5; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke();
    }
    ctx.setLineDash([]);
    // series (a gap of more than 10 sampling periods breaks the line: the tab was closed)
    for (const [, idx, color] of chart.series) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath();
      let pen = false, lastT = 0;
      const gap = Math.max(6e5, (xb - xa) / 200);
      for (const p of pts) {
        if (!ok(p[idx])) { pen = false; continue; }
        const x = X(p[0]), y = Y(p[idx]);
        if (pen && p[0] - lastT <= gap) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        pen = true; lastT = p[0];
      }
      ctx.stroke();
    }
    if (hover) drawHover(ctx);
  }
  function drawHover(ctx) {
    const v = view; if (!v) return;
    let best = v.pts[0], bd = Infinity;
    for (const p of v.pts) { const d = Math.abs(v.X(p[0]) - hover.x); if (d < bd) { bd = d; best = p; } }
    const x = Math.round(v.X(best[0])) + .5;
    ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, v.T); ctx.lineTo(x, v.H - v.B); ctx.stroke();
    const lines = [new Date(best[0]).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })]
      .concat(v.chart.series.map(([n, i]) => n + ': ' + CCA.fmt(best[i])));
    for (const [, i, c] of v.chart.series) if (!v.chart.log || best[i] > 0) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, v.Y(best[i]), 3, 0, 7); ctx.fill(); }
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 14, h = lines.length * 15 + 8;
    const bx = x + 10 + w > v.W - v.R ? x - 10 - w : x + 10, by = v.T + 4;
    ctx.fillStyle = 'rgba(20,20,20,.94)'; ctx.strokeStyle = '#333'; ctx.fillRect(bx, by, w, h); ctx.strokeRect(bx + .5, by + .5, w - 1, h - 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((l, k) => { ctx.fillStyle = k ? '#dcdcdc' : '#8a8a8a'; ctx.fillText(l, bx + 7, by + 5 + k * 15); });
  }
  canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); hover = { x: e.clientX - r.left }; draw(); });
  canvas.addEventListener('mouseleave', () => { hover = null; draw(); });
  layout();
})();
