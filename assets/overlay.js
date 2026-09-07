// Fact-check overlay.
// Marks each claim's anchor text in the document, shows sources on hover, and gives the
// reviewer Accept / Dismiss / Apply-to-doc decisions that persist in localStorage and
// can be copied out as a block for the agent to act on.
//
// Data: window.FACTCHECK (embedded by build_review.py: {doc, title, claims}) or, failing
// that, claims.json next to this script. Activation: always on when window.FACTCHECK
// exists; otherwise only with ?factcheck=1 in the URL (for injection into a live page).
(function () {
  var q = new URLSearchParams(location.search);
  var embedded = window.FACTCHECK || null;
  if (!embedded && !(q.get('factcheck') || q.get('fc'))) return;
  var ONLY = q.get('only') || '';
  var STATUS = {
    'supported': { label: 'Supported', color: '#1f8a4c', bg: 'rgba(52,199,89,.22)' },
    'supported-with-caveat': { label: 'Caveat', color: '#b26a00', bg: 'rgba(255,170,0,.28)' },
    'unsupported': { label: 'Unsupported', color: '#c62828', bg: 'rgba(255,59,48,.25)' },
    'contradicted': { label: 'Contradicted', color: '#c62828', bg: 'rgba(255,59,48,.38)' },
    'unverifiable': { label: 'Opinion / forecast', color: '#555', bg: 'rgba(120,120,120,.18)' },
    'unchecked': { label: 'Unchecked', color: '#555', bg: 'rgba(120,120,255,.18)' }
  };
  var RED = { 'unsupported': 1, 'contradicted': 1 };
  var DECISION = { accept: '✓', dismiss: '✕', apply: '✎' };
  var css = '\
#fc-bar{position:fixed;top:0;left:0;right:0;z-index:99990;background:#1c1c1e;color:#fff;font:13px/1.4 -apple-system,Helvetica,Arial,sans-serif;padding:8px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,.3)}\
#fc-bar b{font-weight:600}\
#fc-bar button{font:inherit;border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer}\
#fc-bar button.on{background:#fff;color:#1c1c1e}\
#fc-bar .dot{display:inline-block;width:10px;height:10px;border-radius:5px;margin-right:4px;vertical-align:-1px}\
#fc-bar .orphans{color:#ffb3b3}\
#fc-bar .decided{color:#bbb}\
#fc-bar .spacer{flex:1}\
body.fc-active{padding-top:44px}\
mark[data-fc]{background:var(--fc-bg);color:inherit;border-bottom:2px solid var(--fc-color);cursor:help;padding:0 1px;border-radius:2px}\
mark[data-fc].fc-dim{background:transparent;border-bottom-color:transparent;cursor:inherit}\
mark[data-fc] sup.fc-n{font-size:.62em;color:var(--fc-color);font-weight:700;margin-left:1px;vertical-align:super;line-height:0;white-space:nowrap}\
mark[data-fc].fc-dim sup.fc-n{display:none}\
#fc-pop{position:fixed;z-index:99991;width:520px;max-width:calc(100vw - 20px);max-height:calc(100vh - 70px);overflow:auto;background:#fff;color:#111;font:13px/1.45 -apple-system,Helvetica,Arial,sans-serif;border:1px solid #ccc;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.25);padding:12px 14px;display:none;text-align:left}\
#fc-pop.pinned{border-color:#333}\
#fc-pop h4{margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase}\
#fc-pop .claim{margin:0 0 10px;font-style:italic;color:#333}\
#fc-pop .src{border-top:1px solid #eee;padding:8px 0}\
#fc-pop .src .key{font-weight:600}\
#fc-pop .src .loc{color:#666;margin-left:6px}\
#fc-pop blockquote{margin:4px 0 6px;padding:4px 10px;border-left:3px solid #ddd;color:#222;white-space:pre-wrap;max-height:150px;overflow:auto;font-size:12.5px}\
#fc-pop a{color:#0b6bcb}\
#fc-pop .note{border-top:1px solid #eee;padding-top:8px;color:#444;font-size:14px;line-height:1.45}\
#fc-pop .meta{color:#888;font-size:11px;margin-top:6px}\
#fc-pop .close{float:right;border:0;background:none;font-size:16px;cursor:pointer;color:#666}\
#fc-pop .decide{border-top:1px solid #eee;margin-top:8px;padding-top:8px}\
#fc-pop .decide button{font:inherit;border:1px solid #bbb;background:#fafafa;border-radius:4px;padding:3px 9px;margin-right:6px;cursor:pointer}\
#fc-pop .decide button.on{background:#1c1c1e;color:#fff;border-color:#1c1c1e}\
#fc-pop textarea{width:100%;box-sizing:border-box;font:inherit;margin-top:6px;min-height:56px;border:1px solid #bbb;border-radius:4px;padding:6px}\
#fc-pop .decide label{display:block;color:#666;font-size:11px;margin-top:6px}\
';
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  var claims = [], byId = {}, filter = ONLY === 'red' ? 'red' : (ONLY || ''), orphans = [];
  var docKey = (embedded && embedded.doc) || location.pathname;
  var decisions = {};
  try { decisions = JSON.parse(localStorage.getItem('fc-decisions:' + docKey) || '{}'); } catch (e) { decisions = {}; }
  function saveDecisions() { try { localStorage.setItem('fc-decisions:' + docKey, JSON.stringify(decisions)); } catch (e) {} }

  function textFragment(quote) {
    if (!quote) return '';
    var w = quote.replace(/\s+/g, ' ').trim().replace(/^[“"']+|[”"'.]+$/g, '').split(' ');
    var enc = function (s) { return encodeURIComponent(s).replace(/-/g, '%2D'); };
    if (w.length <= 10) return '#:~:text=' + enc(w.join(' '));
    return '#:~:text=' + enc(w.slice(0, 5).join(' ')) + ',' + enc(w.slice(-5).join(' '));
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Pull a suggested replacement out of a note written as: Suggest: 'text' / Suggest "text".
  function suggestedText(c) {
    var m = /Suggest(?:ed)?(?: wording)?:\s*['‘"“](.+?)['’"”]\.?(?:\s|$)/.exec(c.note || '');
    return m ? m[1] : '';
  }

  // ---- anchoring ---------------------------------------------------------
  function textNodes(root) {
    var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        var t = p.tagName;
        if (t === 'SCRIPT' || t === 'STYLE' || t === 'TEXTAREA' || (t === 'SUP' && p.classList.contains('fc-n')) || p.closest('#fc-bar,#fc-pop')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n; while ((n = w.nextNode())) out.push(n);
    return out;
  }
  function norm(ch) {
    if (/\s/.test(ch) || ch === ' ') return ' ';
    if (ch === '’' || ch === '‘') return "'";
    if (ch === '“' || ch === '”') return '"';
    if (ch === '–' || ch === '—') return '-';
    return ch;
  }
  function normStr(s) { var o = ''; for (var i = 0; i < s.length; i++) o += norm(s[i]); return o.replace(/ +/g, ' ').trim(); }
  function buildIndex(root) {
    var nodes = textNodes(root), str = '', map = [], lastSpace = true;
    nodes.forEach(function (n) {
      var t = n.textContent;
      for (var i = 0; i < t.length; i++) {
        var c = norm(t[i]);
        if (c === ' ') { if (lastSpace) continue; lastSpace = true; } else lastSpace = false;
        str += c; map.push({ node: n, off: i });
      }
    });
    return { str: str, map: map };
  }
  function wrapRange(idx, start, end, claim, n) {
    var segs = [], cur = null;
    for (var i = start; i < end; i++) {
      var m = idx.map[i];
      if (!cur || cur.node !== m.node) { cur = { node: m.node, from: m.off, to: m.off + 1 }; segs.push(cur); }
      else cur.to = m.off + 1;
    }
    segs.forEach(function (s, si) {
      var node = s.node;
      var tail = node.splitText(s.to);
      var mid = node.splitText(s.from);
      var mark = document.createElement('mark');
      mark.setAttribute('data-fc', claim.id);
      mark.style.setProperty('--fc-bg', STATUS[claim.status].bg);
      mark.style.setProperty('--fc-color', STATUS[claim.status].color);
      mark.tabIndex = 0;
      node.parentNode.insertBefore(mark, tail);
      mark.appendChild(mid);
      if (si === segs.length - 1) { var sup = document.createElement('sup'); sup.className = 'fc-n'; sup.textContent = n; mark.appendChild(sup); }
    });
  }
  function badge() {
    document.querySelectorAll('mark[data-fc]').forEach(function (m) {
      var sup = m.querySelector('sup.fc-n'); if (!sup) return;
      var d = decisions[m.getAttribute('data-fc')];
      var n = sup.textContent.replace(/[✓✕✎]$/, '');
      sup.textContent = n + (d && DECISION[d.d] ? DECISION[d.d] : '');
    });
  }
  function apply(root) {
    orphans = [];
    claims.forEach(function (c, i) {
      c.status = STATUS[c.status] ? c.status : 'unchecked';
      var idx = buildIndex(root), a = normStr(c.anchor || '');
      if (!a) { orphans.push(c); return; }
      var at = idx.str.indexOf(a);
      var occ = c.occurrence || 1;
      while (occ > 1 && at >= 0) { at = idx.str.indexOf(a, at + 1); occ--; }
      if (at < 0) { orphans.push(c); return; }
      wrapRange(idx, at, at + a.length, c, i + 1);
    });
    badge(); applyFilter();
  }
  function isRed(c) { return !!RED[c.status]; }
  function visible(c) {
    if (!filter) return true;
    if (filter === 'red') return isRed(c);
    if (filter === 'problems') return isRed(c) || c.status === 'supported-with-caveat';
    if (filter === 'undecided') return (isRed(c) || c.status === 'supported-with-caveat') && !decisions[c.id];
    return c.status === filter;
  }
  function applyFilter() {
    document.querySelectorAll('mark[data-fc]').forEach(function (m) {
      var c = byId[m.getAttribute('data-fc')];
      m.classList.toggle('fc-dim', !(c && visible(c)));
    });
    document.querySelectorAll('#fc-bar button[data-filter]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-filter') === filter); });
  }

  // ---- popover -----------------------------------------------------------
  var pop = document.createElement('div'); pop.id = 'fc-pop'; document.body.appendChild(pop);
  var pinned = null, hideTimer = null, current = null;
  function render(c) {
    var st = STATUS[c.status], d = decisions[c.id] || {};
    var h = '<button class="close" title="Close" aria-label="Close">×</button>';
    h += '<h4 style="color:' + st.color + '">' + esc(st.label) + ' · ' + esc(c.id) + '</h4>';
    if (c.claim) h += '<p class="claim">' + esc(c.claim) + '</p>';
    (c.sources || []).forEach(function (s) {
      var href = s.url ? s.url + (s.no_fragment ? '' : textFragment(s.quote)) : '';
      h += '<div class="src"><span class="key">' + esc(s.key || s.url || 'Source') + '</span>';
      if (s.locator) h += '<span class="loc">' + esc(s.locator) + '</span>';
      if (s.quote) h += '<blockquote>' + esc(s.quote) + '</blockquote>';
      if (href) h += '<a href="' + esc(href) + '" target="_blank" rel="noopener">Open source ↗</a>';
      if (s.verified_against) h += ' <span class="meta">matched in ' + esc(s.verified_against) + '</span>';
      h += '</div>';
    });
    if (!(c.sources || []).length) h += '<div class="src" style="color:#c62828">No source recorded.</div>';
    if (c.note) h += '<div class="note">' + esc(c.note) + '</div>';
    if (c.checked_by && c.checked_by.length) h += '<div class="meta">Checked by: ' + esc(c.checked_by.join(', ')) + '</div>';
    h += '<div class="decide">';
    h += '<button data-d="accept"' + (d.d === 'accept' ? ' class="on"' : '') + ' title="The check is right; I will handle it or it needs nothing">✓ Accept</button>';
    h += '<button data-d="dismiss"' + (d.d === 'dismiss' ? ' class="on"' : '') + ' title="Not a problem; leave the text as it is">✕ Dismiss</button>';
    h += '<button data-d="apply"' + (d.d === 'apply' ? ' class="on"' : '') + ' title="Replace the marked text in the document with the text below">✎ Apply to doc</button>';
    h += '<label>Replacement text (used by Apply to doc)</label><textarea data-f="replacement" placeholder="Replacement for the marked text">' + esc(d.replacement != null ? d.replacement : suggestedText(c)) + '</textarea>';
    h += '<label>Your note (optional)</label><textarea data-f="note" style="min-height:36px">' + esc(d.note || '') + '</textarea>';
    h += '</div>';
    pop.innerHTML = h;
  }
  function position(mark) {
    var r = mark.getBoundingClientRect();
    pop.style.display = 'block';
    var w = pop.offsetWidth, hgt = pop.offsetHeight, top = r.bottom + 8, left = r.left;
    if (top + hgt > innerHeight - 10) top = Math.max(50, r.top - hgt - 8);
    if (left + w > innerWidth - 10) left = Math.max(10, innerWidth - w - 10);
    pop.style.top = top + 'px'; pop.style.left = left + 'px';
  }
  function show(mark, pin) {
    var c = byId[mark.getAttribute('data-fc')]; if (!c) return;
    clearTimeout(hideTimer);
    if (pin) { pinned = mark; pop.classList.add('pinned'); } else if (pinned) return;
    current = c; render(c); position(mark);
  }
  function hide(force) {
    if (pinned && !force) return;
    pinned = null; current = null; pop.classList.remove('pinned'); pop.style.display = 'none';
  }
  function decide(c, d) {
    var rec = decisions[c.id] || {};
    if (d) { if (rec.d === d) delete rec.d; else rec.d = d; }
    rec.replacement = pop.querySelector('[data-f="replacement"]').value;
    rec.note = pop.querySelector('[data-f="note"]').value;
    if (!rec.d && !rec.note && rec.replacement === suggestedText(c)) delete decisions[c.id]; else decisions[c.id] = rec;
    saveDecisions(); badge(); renderBar(); applyFilter();
    pop.querySelectorAll('.decide button').forEach(function (b) { b.classList.toggle('on', (decisions[c.id] || {}).d === b.getAttribute('data-d')); });
  }
  document.addEventListener('mouseover', function (e) {
    var m = e.target.closest && e.target.closest('mark[data-fc]');
    if (m && !m.classList.contains('fc-dim')) show(m, false);
  });
  document.addEventListener('mouseout', function (e) {
    var m = e.target.closest && e.target.closest('mark[data-fc]');
    if (m && !pinned) hideTimer = setTimeout(function () { hide(false); }, 250);
  });
  pop.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
  pop.addEventListener('mouseleave', function () { if (!pinned) hideTimer = setTimeout(function () { hide(false); }, 250); });
  pop.addEventListener('click', function (e) {
    if (e.target.classList.contains('close')) { hide(true); return; }
    var b = e.target.closest('.decide button'); if (b && current) { pinned = pinned || true; pop.classList.add('pinned'); decide(current, b.getAttribute('data-d')); }
  });
  pop.addEventListener('input', function (e) { if (e.target.tagName === 'TEXTAREA' && current) { pinned = pinned || true; pop.classList.add('pinned'); decide(current, null); } });
  document.addEventListener('click', function (e) {
    var m = e.target.closest && e.target.closest('mark[data-fc]');
    if (m && !m.classList.contains('fc-dim')) { e.preventDefault(); e.stopPropagation(); if (pinned === m) hide(true); else show(m, true); return; }
    if (!e.target.closest('#fc-pop')) hide(true);
  }, true);
  document.addEventListener('focusin', function (e) { var m = e.target.closest && e.target.closest('mark[data-fc]'); if (m) show(m, false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(true); });

  // ---- summary bar -------------------------------------------------------
  var bar = document.createElement('div'); bar.id = 'fc-bar';
  function problems() { return claims.filter(function (c) { return isRed(c) || c.status === 'supported-with-caveat'; }); }
  function renderBar() {
    var counts = {}; claims.forEach(function (c) { counts[c.status] = (counts[c.status] || 0) + 1; });
    var h = '<b>Fact check</b> <span>' + claims.length + ' claims</span>';
    h += '<button data-filter="">All</button>';
    ['supported', 'supported-with-caveat', 'unsupported', 'contradicted', 'unverifiable', 'unchecked'].forEach(function (k) {
      if (!counts[k]) return;
      h += '<button data-filter="' + k + '"><span class="dot" style="background:' + STATUS[k].color + '"></span>' + esc(STATUS[k].label) + ' ' + counts[k] + '</button>';
    });
    h += '<button data-filter="problems">Problems only</button>';
    var p = problems(), decided = p.filter(function (c) { return decisions[c.id] && decisions[c.id].d; }).length;
    if (p.length) h += '<button data-filter="undecided" title="Problems you have not accepted, dismissed or marked for applying">Undecided ' + (p.length - decided) + '</button>';
    if (orphans.length) h += '<span class="orphans" title="' + esc(orphans.map(function (c) { return c.id + ': ' + c.anchor; }).join('\n')) + '">' + orphans.length + ' orphaned anchor' + (orphans.length > 1 ? 's' : '') + ' (hover)</span>';
    h += '<span class="spacer"></span>';
    var nd = Object.keys(decisions).length;
    h += '<button id="fc-decisions" title="Copy your decisions to paste back to the agent">Copy decisions' + (nd ? ' (' + nd + ')' : '') + '</button>';
    h += '<button id="fc-copy" title="Copy the full claim table as Markdown">Copy list</button>';
    if (!embedded) h += '<button id="fc-off">Hide</button>';
    bar.innerHTML = h;
  }
  function flash(b, t) { var o = b.textContent; b.textContent = t; setTimeout(function () { renderBar(); }, 1500); }
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-filter')) { filter = b.getAttribute('data-filter'); applyFilter(); return; }
    if (b.id === 'fc-copy') {
      var md = '| # | Status | Claim | Sources | Note |\n|---|---|---|---|---|\n' + claims.map(function (c, i) {
        return '| ' + (i + 1) + ' | ' + c.status + ' | ' + (c.claim || c.anchor).replace(/\|/g, '\\|') + ' | ' + (c.sources || []).map(function (s) { return s.url ? '[' + (s.key || 'src') + '](' + s.url + ')' : (s.key || ''); }).join(', ') + ' | ' + (c.note || '').replace(/\|/g, '\\|') + ' |';
      }).join('\n');
      navigator.clipboard.writeText(md).then(function () { flash(b, 'Copied'); });
    }
    if (b.id === 'fc-decisions') {
      var out = { doc: docKey, decisions: {} };
      Object.keys(decisions).forEach(function (id) {
        var c = byId[id], d = decisions[id]; if (!c) return;
        out.decisions[id] = { d: d.d || null, anchor: c.anchor, replacement: d.replacement, note: d.note || '' };
      });
      var block = 'FACTCHECK DECISIONS\n```json\n' + JSON.stringify(out, null, 1) + '\n```';
      navigator.clipboard.writeText(block).then(function () { flash(b, 'Copied, paste to the agent'); });
    }
    if (b.id === 'fc-off') { q.delete('factcheck'); q.delete('fc'); q.delete('only'); location.search = q.toString(); }
  });

  // ---- boot ---------------------------------------------------------------
  function root() { return document.getElementById('document') || document.getElementById('page') || document.body; }
  function boot(data) {
    claims = Array.isArray(data) ? data : (data.claims || []);
    claims.forEach(function (c) { byId[c.id] = c; });
    document.body.classList.add('fc-active');
    document.body.insertBefore(bar, document.body.firstChild);
    apply(root()); renderBar(); applyFilter();
  }
  function start(data) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(data); }); else boot(data); }
  if (embedded) { start(embedded); return; }
  var src = (document.currentScript && document.currentScript.src) || 'overlay.js';
  fetch(src.replace(/overlay\.js.*$/, 'claims.json') + '?t=' + Date.now()).then(function (r) { return r.json(); }).then(start).catch(function (e) {
    document.body.classList.add('fc-active');
    bar.innerHTML = '<b>Fact check</b> <span style="color:#ffb3b3">could not load claims.json: ' + esc(e.message) + '</span>';
    document.body.insertBefore(bar, document.body.firstChild);
  });
})();
