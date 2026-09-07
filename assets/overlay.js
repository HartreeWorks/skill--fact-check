// Fact-check overlay (v2).
// Marks each claim's anchor text in the document and adds a review sidebar: a queue of
// issues, a detail card per claim with Queue edit / Agree / Dismiss decisions, evidence,
// and a "Send edits to agent" button that copies the decision block. Decisions persist in
// localStorage under the same key and format as v1 ('fc-decisions:<doc>').
//
// Data: window.FACTCHECK, embedded by build_review.py as {doc, title, claims}.
// Layout: sidebar on the right; on wide screens (1500px and up) it has two columns, the
// issue list and the selected claim side by side; under 860px it is a bottom sheet.
(function () {
  var q = new URLSearchParams(location.search);
  var embedded = window.FACTCHECK || null;
  if (!embedded) return;

  var STATUS = {
    'supported': { label: 'Supported', tone: 'supported', color: '#2e7d4f' },
    'supported-with-caveat': { label: 'Caveat', tone: 'caveat', color: '#6b4a00', pill: '#f3dc9c', row: '#fcf6e8' },
    'unsupported': { label: 'Unsupported', tone: 'red', color: '#8f1a12', pill: '#f7c9c3', row: '#fcefec' },
    'contradicted': { label: 'Contradicted', tone: 'red', color: '#8f1a12', pill: '#f7c9c3', row: '#fcefec' },
    'unverifiable': { label: 'Opinion / forecast', tone: 'grey', color: '#6b6862' },
    'unchecked': { label: 'Unchecked', tone: 'grey', color: '#6b6862' }
  };
  var KIND = { fact: 'Factual claim', characterisation: 'Characterisation', link: 'Link target', 'author-view': 'Author’s own position' };
  var DECIDED = { apply: '✎ Edit queued', accept: '✓ Agreed', dismiss: '— Dismissed' }; // accept kept for v1 decision files
  var SANS = '"IBM Plex Sans",-apple-system,"Helvetica Neue",Helvetica,sans-serif';
  var SERIF = '"Source Serif 4",Georgia,"Iowan Old Style",serif';

  var css = '\
body.fc-active{padding-top:54px;padding-right:400px}\
body.fc-active.fc-narrow{padding-right:0;padding-bottom:60vh}\
body.fc-active.fc-wide.fc-detail{padding-right:780px}\
#fc-top{position:fixed;top:0;left:0;right:0;height:54px;z-index:99990;display:flex;align-items:center;gap:20px;padding:0 20px;box-sizing:border-box;background:#faf9f6;border-bottom:1px solid #e2dfd6;color:#1c1b18;font:14px/1.45 ' + SANS + '}\
#fc-top .brand{display:flex;align-items:baseline;gap:12px;min-width:0}\
#fc-top .eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a877f}\
#fc-top .title{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:34vw}\
#fc-top a{color:#2456a4;font-size:13px;white-space:nowrap;text-decoration:none}\
#fc-top .grow{flex:1}\
#fc-top .progress{display:flex;align-items:center;gap:10px;font-size:13px;color:#6b6862;white-space:nowrap}\
#fc-top .track{width:120px;height:6px;border-radius:3px;background:#e2dfd6;overflow:hidden}#fc-top .fill{height:100%;background:#1c1b18;transition:width .25s}\
#fc-top .actions{display:flex;gap:8px}\
#fc-top .kbdlink{border:0;background:transparent;color:#8a877f;font-size:12px;padding:4px 8px;white-space:nowrap}#fc-top .kbdlink:hover{color:#1c1b18;background:#f1efe9}#fc-top .kbdlink kbd{font:600 10px/1 ' + SANS + ';color:#6b6862;border:1px solid #d3cfc4;border-bottom-width:2px;border-radius:3px;padding:2px 4px;background:#faf9f6;margin-left:3px}\
#fc-side .tip{display:flex;align-items:flex-start;gap:8px;margin:0 0 4px;padding:8px 10px;border:1px solid #e2dfd6;border-radius:6px;background:#fff;font-size:12px;line-height:1.45;color:#3d3b36}#fc-side .tip .x{margin-left:auto;border:0;background:transparent;color:#8a877f;font-size:14px;line-height:1;padding:0 2px}#fc-side .tip .x:hover{color:#1c1b18}\
#fc-top button{font:inherit;border:1px solid #d3cfc4;background:transparent;color:#1c1b18;border-radius:6px;padding:6px 12px;cursor:pointer;white-space:nowrap}\
#fc-top button:hover{background:#f1efe9}\
#fc-top button.send{display:flex;align-items:center;gap:7px;border-color:#2e7d4f;background:#2e7d4f;color:#fff;font-weight:600;padding:6px 14px;box-shadow:0 1px 2px rgba(46,125,79,.3)}#fc-top button.send:hover{background:#256a41}\
#fc-side{position:fixed;top:54px;right:0;bottom:0;width:400px;z-index:99990;display:flex;flex-direction:column;background:#faf9f6;border-left:1px solid #e2dfd6;color:#1c1b18;font:14px/1.45 ' + SANS + ';box-sizing:border-box}\
body.fc-narrow #fc-side{top:auto;left:0;width:auto;height:60vh;border-left:0;border-top:1px solid #e2dfd6;box-shadow:0 -6px 20px rgba(0,0,0,.08)}\
body.fc-wide #fc-side.fc-split{width:780px;flex-direction:row}\
#fc-side .col{display:flex;flex-direction:column;min-height:0;min-width:0}\
#fc-side .col.card{flex:none;width:380px;border-right:1px solid #e2dfd6}\
#fc-side .col.card .cardwrap{max-height:none;flex:1;padding-bottom:12px}\
#fc-side .col.evidence{flex:1}#fc-side .col.evidence .body{min-height:0}\
#fc-side .item.sel{box-shadow:inset 0 0 0 2px #1c1b18;border-radius:2px}\
#fc-side .pick{flex:1;display:flex;align-items:center;justify-content:center;padding:40px;text-align:center;color:#8a877f;font-size:13px;line-height:1.5}\
#fc-side *{box-sizing:border-box}\
#fc-side button{font:inherit;cursor:pointer}\
#fc-side .hd{flex:none;padding:14px 16px 10px;border-bottom:1px solid #e2dfd6;display:flex;flex-direction:column;gap:10px}\
#fc-side .seg{display:flex;background:#e9e6de;border-radius:8px;padding:3px;gap:2px}\
#fc-side .seg button{flex:1;border:0;border-radius:6px;padding:5px 6px;font-size:12px;font-weight:600;white-space:nowrap;background:transparent;color:#6b6862}\
#fc-side .seg button.on{background:#fff;color:#1c1b18;box-shadow:0 1px 2px rgba(0,0,0,.08)}\
#fc-side .scroll{flex:1;min-height:0;overflow:auto}\
#fc-side .empty{padding:40px 20px;text-align:center;color:#6b6862;font-size:13px;line-height:1.5}\
#fc-side .item{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #eceae3;border-left:3px solid transparent;background:transparent;padding:12px 16px 12px 14px;color:inherit}\
#fc-side .item:hover{filter:brightness(.97)}\
#fc-side .item .row{display:flex;align-items:center;gap:8px}\
#fc-side .item .tag{flex:none;white-space:nowrap;font-size:11px;letter-spacing:.04em;text-transform:uppercase;font-weight:700;padding:2px 7px;border-radius:4px}\
#fc-side .item .dec{margin-left:auto;font-size:11px;font-weight:600;color:#6b6862}\
#fc-side .item .qd{margin-left:auto;flex:none;white-space:nowrap;display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:#2e7d4f;color:#fff}\
#fc-side .item .snip{margin-top:6px;font:15px/1.4 ' + SERIF + ';color:#1c1b18;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\
#fc-side .item.queued .snip{color:#8a877f;text-decoration:line-through}\
#fc-side .item.queued .snip.new{color:#1f5f3a;text-decoration:none;margin-top:4px}\
#fc-side .nav{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 10px 8px 8px;border-bottom:1px solid #e2dfd6}\
#fc-side .nav .back{border:0;background:transparent;color:#1c1b18;padding:6px 8px;border-radius:6px;display:flex;align-items:center;gap:6px;white-space:nowrap}#fc-side .nav .back span{color:#6b6862}#fc-side .nav .back:hover{background:#eceae3}\
#fc-side .nav .pos{margin-left:auto;font-size:12px;color:#6b6862;white-space:nowrap}\
#fc-side .nav .step{border:1px solid #d3cfc4;background:#fff;height:28px;width:28px;justify-content:center;padding:0;border-radius:6px;color:#1c1b18;display:inline-flex;align-items:center;gap:5px;font-size:14px}#fc-side .nav .step:hover{background:#f1efe9}\
#fc-side kbd{font:600 10px/1 ' + SANS + ';color:#6b6862;border:1px solid #d3cfc4;border-bottom-width:2px;border-radius:3px;padding:2px 4px;background:#faf9f6}\
#fc-side .nav .keys{border:0;background:transparent;color:#8a877f;font-size:11px;padding:4px 6px;border-radius:5px;white-space:nowrap}#fc-side .nav .keys:hover{background:#eceae3;color:#1c1b18}\
#fc-modal .box.wide{width:760px}#fc-modal h2 .sub{font-weight:400;font-size:13px;color:#8a877f}\
#fc-modal .excerpt{max-height:60vh;overflow:auto;white-space:pre-wrap;font:15px/1.6 ' + SERIF + ';color:#3d3b36;background:#faf9f6;border:1px solid #e2dfd6;border-radius:6px;padding:14px 16px;margin:0 0 14px}#fc-modal .excerpt mark{background:#fbe9bf;box-shadow:inset 0 -2px #dda634;color:#1c1b18}\
#fc-modal .row a{font-size:13px}#fc-modal .row .faint{color:#8a877f;font-size:12px}\
#fc-modal table{border-collapse:collapse;width:100%;margin:0 0 14px}#fc-modal td{padding:6px 0;border-bottom:1px solid #eceae3;vertical-align:top}#fc-modal td:first-child{width:38%;white-space:nowrap}#fc-modal th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8a877f;padding:10px 0 4px}\
#fc-side .cardwrap{flex:none;padding:10px 12px 0;max-height:62%;overflow:auto}\
#fc-side .card{display:flex;flex-direction:column;gap:10px;padding:12px 16px 8px;background:#fff;border:1px solid #e2dfd6;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.04)}\
#fc-side .meta{display:flex;align-items:center;gap:8px}\
#fc-side .pill{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:4px}\
#fc-side .kind{font-size:12px;color:#6b6862}#fc-side .cid{margin-left:auto;font:11px ui-monospace,Menlo,monospace;color:#a09d95}\
#fc-side .note{font-size:14px;line-height:1.5;text-wrap:pretty}\
#fc-side .edit{border:1px solid #e2dfd6;border-radius:6px;background:#faf9f6;padding:10px}\
#fc-side .edit .lbl{margin-bottom:4px}\
#fc-side .edit .old{padding:0 2px 10px;font:15px/1.45 ' + SERIF + ';color:#9a978f;text-decoration:line-through}\
#fc-side .edit textarea{display:block;width:100%;border:1px solid #c9c5ba;border-radius:5px;resize:none;overflow:hidden;padding:8px 10px;font:15px/1.45 ' + SERIF + ';background:#fff;color:#1c1b18;outline:none;min-height:56px;box-shadow:inset 0 1px 2px rgba(0,0,0,.05)}\
#fc-modal{position:fixed;inset:0;z-index:99999;background:rgba(28,27,24,.45);display:flex;align-items:center;justify-content:center;padding:20px;font:14px/1.5 ' + SANS + '}\
#fc-modal .box{background:#fff;color:#1c1b18;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.3);width:520px;max-width:100%;padding:24px 26px 20px;box-sizing:border-box}\
#fc-modal h2{margin:0 0 10px;font-size:18px;line-height:1.3;display:flex;align-items:center;gap:10px}\
#fc-modal h2 .ok{display:inline-flex;width:26px;height:26px;border-radius:13px;background:#2e7d4f;color:#fff;align-items:center;justify-content:center;font-size:15px}\
#fc-modal p{margin:0 0 12px;color:#3d3b36}\
#fc-modal ol{margin:0 0 14px;padding-left:20px;color:#3d3b36}#fc-modal li{margin:0 0 6px}\
#fc-modal textarea{width:100%;box-sizing:border-box;height:120px;font:12px/1.4 ui-monospace,Menlo,monospace;border:1px solid #c9c5ba;border-radius:5px;padding:8px;margin:0 0 12px}\
#fc-modal .row{display:flex;align-items:center;gap:14px;margin-top:6px}\
#fc-modal .row .btn{font:inherit;font-weight:600;border:1px solid #1c1b18;background:#1c1b18;color:#fff;border-radius:6px;padding:8px 16px;cursor:pointer}#fc-modal .row .btn:hover{background:#000}\
#fc-modal .row .btn kbd.enter{margin-left:8px;color:#fff;background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.35)}#fc-modal kbd{font:inherit;font-size:11px;border:1px solid #c9c5ba;border-bottom-width:2px;border-radius:4px;padding:0 5px;background:#faf9f6}\
#fc-side .notewrap{position:relative}#fc-side .btn.queued .b{display:none}#fc-side .btn.queued:hover .a{display:none}#fc-side .btn.queued:hover .b{display:inline}#fc-side .btn.queued:hover{background:#8f1a12;border-color:#8f1a12;color:#fff}\
#fc-side .savedhint{position:absolute;right:0;bottom:2px;font-size:11px;color:#8a877f;background:#fff;padding-left:6px;opacity:0;transition:opacity .2s;pointer-events:none}#fc-side .savedhint.show{opacity:1}\
#fc-side .edit textarea:focus{border-color:#1c1b18;box-shadow:0 0 0 3px rgba(28,27,24,.12)}\
#fc-side .edit .acts{margin-top:10px}\
#fc-side .btn{border-radius:6px;padding:7px 12px;font-weight:600;font-size:13px;white-space:nowrap;border:1px solid #d3cfc4;background:#fff;color:#1c1b18}\
#fc-side .btn.primary{border-color:#1c1b18;background:#1c1b18;color:#faf9f6}\
#fc-side .btn.on{border-color:#2e7d4f;background:#2e7d4f;color:#fff}#fc-side .btn.on.grey{border-color:#6b6862;background:#6b6862}\
#fc-side .acts{display:flex;align-items:center;gap:6px;flex-wrap:wrap}\
#fc-side .usernote{display:block;width:100%;border:0;border-top:1px solid #eceae3;padding:8px 0 0;background:transparent;resize:none;overflow:hidden;outline:none;font:13px/1.45 ' + SANS + ';min-height:30px}\
#fc-side .body{flex:1;min-height:120px;overflow:auto;padding:18px 18px 32px;display:flex;flex-direction:column;gap:18px}\
#fc-side .lbl{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a877f;margin-bottom:8px}\
#fc-side .anchor{font:16px/1.5 ' + SERIF + '}#fc-side .claim{font-size:13px;color:#6b6862;font-style:italic;margin-top:6px}\
#fc-side .src{display:flex;flex-direction:column;gap:4px;padding:10px 12px;background:#fff;border:1px solid #e6e3dc;border-radius:6px;margin-bottom:8px}\
#fc-side .src .h{display:flex;gap:8px;align-items:baseline;font-size:12px}#fc-side .src .h b{font-weight:600}#fc-side .src .h .loc{color:#8a877f}#fc-side .src .h a{margin-left:auto;color:#2456a4;text-decoration:none}\
#fc-side .src .q{font:15px/1.5 ' + SERIF + ';color:#2a2925;white-space:pre-wrap;max-height:160px;overflow:auto}\
#fc-side .fine{font-size:11px;color:#a09d95}#fc-side .fine a{color:#2456a4;text-decoration:none}#fc-side .fine a:hover{text-decoration:underline}\
#fc-side .more{align-self:flex-start;border:0;background:transparent;color:#2456a4;padding:0;font-size:13px}\
#fc-side .nosrc{font-size:13px;color:#b3261e}\
#fc-side table{width:100%;border-collapse:collapse;font-size:12px}#fc-side th{text-align:left;color:#8a877f;font-size:11px;letter-spacing:.04em;text-transform:uppercase;padding:8px 6px;border-bottom:1px solid #e2dfd6}\
#fc-side td{padding:8px 6px;border-bottom:1px solid #eceae3;vertical-align:top}#fc-side tr.r{cursor:pointer}#fc-side tr.r:hover{background:#f1efe9}\
#fc-side td.n{color:#a09d95;font:11px ui-monospace,Menlo,monospace;padding-left:14px}#fc-side td.s{white-space:nowrap;font-weight:600}#fc-side td .srcs{color:#8a877f;margin-top:2px}\
mark[data-fc]{background:transparent;color:inherit;cursor:pointer;padding:2px 0;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone;transition:background .15s,box-shadow .15s}\
mark[data-fc][data-tone="supported"]{background:#dff0e3;box-shadow:inset 0 -2px #5aa876}\
mark[data-fc][data-tone="grey"]{border-bottom:1.5px dashed #9a978f}\
mark[data-fc][data-tone="caveat"]{background:#fbe9bf;box-shadow:inset 0 -2px #dda634}\
mark[data-fc][data-tone="red"]{background:#fad6d1;box-shadow:inset 0 -2px #d9564b}\
mark[data-fc][data-quiet="1"]{background:transparent;box-shadow:none;border-bottom-color:transparent;cursor:text}\
mark[data-fc][data-decided="1"]{background:transparent;box-shadow:none;border-bottom:2px solid}\
mark[data-fc][data-decided="1"][data-tone="caveat"]{border-color:#dda634}mark[data-fc][data-decided="1"][data-tone="red"]{border-color:#d9564b}\
mark[data-fc][data-queued="1"]{background:transparent!important;box-shadow:none!important;border-bottom:2px solid #2e7d4f!important}\
mark[data-fc][data-queued="1"]::after{content:"\\270E";color:#2e7d4f;font:700 .7em/1 ' + SANS + ';margin-left:3px;vertical-align:super}\
mark[data-fc][data-dismissed="1"],mark[data-fc][data-dismissed="1"][data-tone="red"],mark[data-fc][data-dismissed="1"][data-tone="caveat"],mark[data-fc][data-dismissed="1"][data-sel="1"]{background:transparent!important;box-shadow:none!important;border-bottom:0!important}\
mark[data-fc]:hover:not([data-quiet="1"]){box-shadow:0 0 0 3px rgba(28,27,24,.12)}\
mark[data-fc][data-sel="1"]{outline:2px solid #1c1b18;outline-offset:2px}\
mark[data-fc][data-tone="caveat"][data-sel="1"]{background:#f7d98f}mark[data-fc][data-tone="red"][data-sel="1"]{background:#f5b9b1}mark[data-fc][data-tone="supported"][data-sel="1"]{background:#c4e5cc}\
@keyframes fc-pulse{0%{outline-color:#1c1b18}50%{outline-color:transparent}100%{outline-color:#1c1b18}}\
mark[data-fc][data-pulse="1"]{animation:fc-pulse .6s ease 2}\
#fc-legend{max-width:720px;margin:14px auto 0;font:12px/1.5 ' + SANS + ';color:#8a877f;display:flex;gap:18px;flex-wrap:wrap}\
#fc-legend i{display:inline-block;width:14px;height:8px;vertical-align:-1px;margin-right:6px}\
';
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ---- state ---------------------------------------------------------------
  var claims = [], byId = {}, orphans = [];
  var docKey = (embedded && embedded.doc) || location.pathname;
  var decisions = {};
  try { decisions = JSON.parse(localStorage.getItem('fc-decisions:' + docKey) || '{}'); } catch (e) { decisions = {}; }
  function tipSeen() { try { return localStorage.getItem('fc-tip-seen') === '1'; } catch (e) { return true; } }
  function markTip() { try { localStorage.setItem('fc-tip-seen', '1'); } catch (e) {} }
  function save() { try { localStorage.setItem('fc-decisions:' + docKey, JSON.stringify(decisions)); } catch (e) {} }
  var view = 'list', filter = q.get('only') === 'all' ? 'all' : 'issues', selId = null, more = false, forceEdit = false, draft = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function st(c) { return STATUS[c.status] || STATUS.unchecked; }
  function isProblem(c) { return /^(unsupported|contradicted|supported-with-caveat)$/.test(c.status); }
  function decided(c) { var d = decisions[c.id]; return d && d.d; }
  function suggested(c) { var m = /Suggest(?:ed)?(?: wording)?:\s*['‘"“](.+?)['’"”]\.?(?:\s|$)/.exec(c.note || ''); return m ? m[1] : ''; }
  function noteBody(c) { return (c.note || '').replace(/\s*Suggest(?:ed)?(?: wording)?:\s*['‘"“].+?['’"”]\.?(?:\s|$)/, ' ').trim(); }
  function textFragment(quote) {
    if (!quote) return '';
    var w = quote.replace(/\s+/g, ' ').trim().replace(/^[“"']+|[”"'.]+$/g, '').split(' ');
    var enc = function (s) { return encodeURIComponent(s).replace(/-/g, '%2D'); };
    if (w.length <= 10) return '#:~:text=' + enc(w.join(' '));
    return '#:~:text=' + enc(w.slice(0, 5).join(' ')) + ',' + enc(w.slice(-5).join(' '));
  }
  function dedupe(list) {
    var n = function (s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); };
    return list.filter(function (s, i) {
      var qq = n(s.quote); if (!qq) return true;
      return !list.some(function (o, j) { var oq = n(o.quote); return j !== i && oq.length >= qq.length && oq.indexOf(qq) >= 0 && (oq.length > qq.length || j < i); });
    });
  }

  // ---- anchoring -------------------------------------------------------------
  function root() { return document.getElementById('document') || document.body; }
  function textNodes(r) {
    var out = [], w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement; if (!p) return NodeFilter.FILTER_REJECT;
        var t = p.tagName;
        if (t === 'SCRIPT' || t === 'STYLE' || t === 'TEXTAREA' || p.closest('#fc-top,#fc-side,#fc-legend')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n; while ((n = w.nextNode())) out.push(n);
    return out;
  }
  function norm(ch) {
    if (/\s/.test(ch) || ch === '\u00a0') return ' ';
    if (ch === '’' || ch === '‘') return "'";
    if (ch === '“' || ch === '”') return '"';
    if (ch === '–' || ch === '—') return '-';
    return ch;
  }
  function normStr(s) { var o = ''; for (var i = 0; i < s.length; i++) o += norm(s[i]); return o.replace(/ +/g, ' ').trim(); }
  function buildIndex(r) {
    var str = '', map = [], last = true;
    textNodes(r).forEach(function (n) {
      var t = n.textContent;
      for (var i = 0; i < t.length; i++) { var c = norm(t[i]); if (c === ' ') { if (last) continue; last = true; } else last = false; str += c; map.push({ node: n, off: i }); }
    });
    return { str: str, map: map };
  }
  function anchorAll(r) {
    orphans = [];
    claims.forEach(function (c) {
      c.status = STATUS[c.status] ? c.status : 'unchecked';
      var idx = buildIndex(r), a = normStr(c.anchor || '');
      if (!a) { orphans.push(c); return; }
      var at = idx.str.indexOf(a), occ = c.occurrence || 1;
      while (occ > 1 && at >= 0) { at = idx.str.indexOf(a, at + 1); occ--; }
      if (at < 0) { orphans.push(c); return; }
      c._pos = at;
      var segs = [], cur = null;
      for (var i = at; i < at + a.length; i++) { var m = idx.map[i]; if (!cur || cur.node !== m.node) { cur = { node: m.node, from: m.off, to: m.off + 1 }; segs.push(cur); } else cur.to = m.off + 1; }
      segs.forEach(function (s) {
        var tail = s.node.splitText(s.to), mid = s.node.splitText(s.from);
        var mark = document.createElement('mark'); mark.setAttribute('data-fc', c.id); mark.setAttribute('data-tone', st(c).tone); mark.tabIndex = 0;
        s.node.parentNode.insertBefore(mark, tail); mark.appendChild(mid);
      });
    });
  }
  function paint() {
    document.querySelectorAll('mark[data-fc]').forEach(function (m) {
      var c = byId[m.getAttribute('data-fc')]; if (!c) return;
      m.setAttribute('data-quiet', (filter !== 'all' && !isProblem(c)) ? '1' : '0');
      m.setAttribute('data-decided', decided(c) ? '1' : '0');
      m.setAttribute('data-dismissed', decided(c) === 'dismiss' ? '1' : '0');
      m.setAttribute('data-queued', decided(c) === 'apply' ? '1' : '0');
      m.setAttribute('data-sel', selId === c.id ? '1' : '0');
    });
  }
  function ordered() { return claims.slice().sort(function (a, b) { return (a._pos == null ? 1e9 : a._pos) - (b._pos == null ? 1e9 : b._pos); }); }
  function queueFor(f) { return ordered().filter(function (c) { return f === 'all' ? true : isProblem(c) && decided(c) !== 'dismiss'; }); }
  function navList() {
    var has = function (l) { return l.some(function (c) { return c.id === selId; }); };
    var l = queueFor(filter); if (selId && !has(l)) l = queueFor('issues'); if (selId && !has(l)) l = queueFor('all'); return l;
  }

  // ---- top bar -----------------------------------------------------------------
  var top = document.createElement('div'); top.id = 'fc-top';
  var side = document.createElement('div'); side.id = 'fc-side';
  var copied = '';
  function issues() { return claims.filter(isProblem); }
  function renderTop() {
    var iss = issues(), done = iss.filter(decided).length, nd = Object.keys(decisions).length;
    var host = ''; try { host = new URL(docKey).host; } catch (e) {}
    var linkLabel = /docs\.google/.test(host) ? 'Google Doc' : (host || '');
    var title = (embedded && embedded.title) || document.title || '';
    var h = '<div class="brand"><span class="eyebrow">Fact check</span><span class="title">' + esc(title) + '</span>';
    if (/^https?:/.test(docKey)) h += '<a href="' + esc(docKey) + '" target="_blank" rel="noopener">' + esc(linkLabel) + ' ↗</a>';
    if (orphans.length) h += '<span style="font-size:12px;color:#b3261e" title="' + esc(orphans.map(function (c) { return c.id + ': ' + c.anchor; }).join('\n')) + '">' + orphans.length + ' orphaned anchor' + (orphans.length > 1 ? 's' : '') + '</span>';
    h += '</div><div class="grow"></div>';
    h += '<div class="progress"><span>' + (iss.length ? done + ' of ' + iss.length + ' issues decided' : claims.length + ' claims') + '</span><div class="track"><div class="fill" style="width:' + (iss.length ? Math.round(done / iss.length * 100) : 0) + '%"></div></div></div>';
    h += '<button class="kbdlink" data-act="shortcuts" title="Keyboard shortcuts (?)">Keyboard shortcuts <kbd>?</kbd></button>';
    h += '<div class="actions"><button data-act="table" title="See every claim as a table">View claim table</button>';
    h += '<button class="send" data-act="send" title="Copy your queued edits and decisions as a block to paste to the agent"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"></path><path d="M22 2L15 22L11 13L2 9L22 2z"></path></svg>' + (copied === 'send' ? 'Copied — paste to the agent' : 'Send edits to agent' + (nd ? ' (' + nd + ')' : '')) + '</button>';
    if (!embedded) h += '<button data-act="off">Hide</button>';
    h += '</div>';
    top.innerHTML = h;
  }
  top.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var a = b.getAttribute('data-act');
    if (a === 'table') { view = 'table'; selId = null; renderSide(); paint(); }
    if (a === 'shortcuts') showShortcuts();
    if (a === 'send') copy('send');
    if (a === 'off') { q.delete('factcheck'); q.delete('fc'); q.delete('only'); location.search = q.toString(); }
  });
  function copy(kind) {
    var text;
    if (kind === 'table') {
      text = '| # | Status | Claim | Sources | Note |\n|---|---|---|---|---|\n' + claims.map(function (c, i) {
        return '| ' + (i + 1) + ' | ' + c.status + ' | ' + (c.claim || c.anchor).replace(/\|/g, '\\|') + ' | ' + (c.sources || []).map(function (s) { return s.url ? '[' + (s.key || 'src') + '](' + s.url + ')' : (s.key || ''); }).join(', ') + ' | ' + (c.note || '').replace(/\|/g, '\\|') + ' |';
      }).join('\n');
    } else {
      var out = { doc: docKey, decisions: {} };
      Object.keys(decisions).forEach(function (id) { var c = byId[id], d = decisions[id]; if (!c) return; out.decisions[id] = { d: d.d || null, anchor: c.anchor, replacement: d.replacement, note: d.note || '' }; });
      text = 'FACTCHECK DECISIONS\n```json\n' + JSON.stringify(out, null, 1) + '\n```';
    }
    var done = function (ok) {
      copied = kind; renderTop(); if (kind === 'table') renderSide();
      setTimeout(function () { copied = ''; renderTop(); if (view === 'table') renderSide(); }, 1600);
      if (kind !== 'table') showSendModal(text, ok);
    };
    var settled = false, finish = function (ok) { if (!settled) { settled = true; done(ok); } };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { finish(true); }, function () { finish(false); });
      setTimeout(function () { finish(false); }, 1500);  // clipboard blocked or waiting on a permission prompt
    } else finish(false);
  }
  var modal = null;
  function showSendModal(text, copiedOk) {
    closeModal();
    var n = Object.keys(decisions), queued = n.filter(function (id) { return decisions[id].d === 'apply'; }).length, dismissed = n.filter(function (id) { return decisions[id].d === 'dismiss'; }).length, noted = n.filter(function (id) { return decisions[id].note; }).length;
    var target = /docs\.google/.test(docKey) ? 'the Google Doc' : 'the source document';
    var what = [];
    if (queued) what.push(queued + ' queued edit' + (queued > 1 ? 's' : ''));
    if (dismissed) what.push(dismissed + ' dismissal' + (dismissed > 1 ? 's' : ''));
    if (noted) what.push(noted + ' note' + (noted > 1 ? 's' : ''));
    modal = document.createElement('div'); modal.id = 'fc-modal';
    var h = '<div class="box" role="dialog" aria-modal="true" aria-labelledby="fc-modal-title">';
    h += '<h2 id="fc-modal-title"><span class="ok">' + (copiedOk ? '✓' : '!') + '</span>' + (copiedOk ? 'Copied to your clipboard' : 'Copy this block by hand') + '</h2>';
    if (!n.length) h += '<p>You have not decided anything yet, so the block is empty. Queue an edit or dismiss an issue first.</p>';
    else h += '<p>' + esc(what.join(', ')) + ' ' + (copiedOk ? 'are on your clipboard as instructions for the fact-checking agent.' : 'are in the box below.') + '</p>';
    if (!copiedOk) h += '<textarea readonly>' + esc(text) + '</textarea>';
    h += '<p>Nothing has changed in ' + target + ' yet. To apply the edits:</p><ol><li>Go back to your chat with the fact-checking agent.</li><li>Paste the block and send it.</li><li>The agent shows you the edits it will make to ' + target + ', then applies them as suggestions when you confirm.</li></ol>';
    h += '<div class="row"><button class="btn" data-act="closemodal">OK, got it <kbd class="enter">↵</kbd></button></div></div>';
    modal.innerHTML = h;
    document.body.appendChild(modal);
    if (!copiedOk) { var ta = modal.querySelector('textarea'); ta.focus(); ta.select(); } else modal.querySelector('button').focus();
  }
  function showShortcuts() {
    closeModal();
    var mac = /Mac|iPhone|iPad/.test(navigator.platform), mod = mac ? '⌘' : 'Ctrl', alt = mac ? '⌥' : 'Alt';
    modal = document.createElement('div'); modal.id = 'fc-modal';
    var row = function (keys, what) { return '<tr><td>' + keys + '</td><td>' + what + '</td></tr>'; };
    var h = '<div class="box" role="dialog" aria-modal="true"><h2>Keyboard shortcuts</h2><table>';
    h += '<tr><th colspan="2">Anywhere</th></tr>';
    h += row('<kbd>J</kbd> or <kbd>↓</kbd>', 'Next issue') + row('<kbd>K</kbd> or <kbd>↑</kbd>', 'Previous issue') + row('<kbd>1</kbd>', 'Queue the edit (or update a queued edit)') + row('<kbd>2</kbd>', 'Dismiss the issue');
    h += '<tr><th colspan="2">While typing in a text box</th></tr>';
    h += row('<kbd>' + alt + '</kbd> + <kbd>J</kbd> / <kbd>K</kbd>', 'Next / previous issue, keeping your place in the box') + row('<kbd>' + alt + '</kbd> + <kbd>1</kbd> / <kbd>2</kbd>', 'Queue / dismiss') + row('<kbd>' + mod + '</kbd> + <kbd>↵</kbd>', 'Queue the edit');
    h += '<tr><th colspan="2">Elsewhere</th></tr>' + row('<kbd>?</kbd>', 'Show this list') + row('<kbd>↵</kbd> or <kbd>Esc</kbd>', 'Close a dialog');
    h += '</table><div class="row"><button class="btn" data-act="closemodal">OK <kbd class="enter">↵</kbd></button></div></div>';
    modal.innerHTML = h; document.body.appendChild(modal); modal.querySelector('button').focus();
  }
  function showExcerpt(cid, si) {
    var c = byId[cid], x = c && (c.sources || [])[si]; if (!x || !x.excerpt) return;
    closeModal();
    var fname = String(x.verified_against).split(' ')[0];
    var full = embedded.sources && embedded.sources[fname];
    var ex = x.excerpt, a = x.excerpt_start || 0, b = a + (x.excerpt_len || 0);
    if (full) {
      // Locate the excerpt's quote inside the full text so the whole file is shown, scrolled to it.
      var probe = ex.slice(a, b), i = full.indexOf(probe);
      if (i < 0) { i = full.indexOf(ex); if (i >= 0) i += a; }
      if (i >= 0) { ex = full; a = i; b = i + probe.length; }
    }
    modal = document.createElement('div'); modal.id = 'fc-modal';
    var h = '<div class="box wide" role="dialog" aria-modal="true"><h2>' + esc(x.key || fname) + ' <span class="sub">' + esc(fname) + (x.locator ? ' · ' + esc(x.locator) : '') + '</span></h2>';
    h += '<div class="excerpt">' + esc(ex.slice(0, a)) + '<mark>' + esc(ex.slice(a, b)) + '</mark>' + esc(ex.slice(b)) + '</div>';
    h += '<div class="row"><button class="btn" data-act="closemodal">Close <kbd class="enter">↵</kbd></button>' + (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">Open the original ↗</a>' : '') + '<span class="faint">' + (full ? 'Full saved text, ' + Math.round(full.length / 1000) + 'k characters' : 'Passage from the saved text') + '</span></div></div>';
    modal.innerHTML = h; document.body.appendChild(modal);
    var mk = modal.querySelector('.excerpt mark'); if (mk) mk.scrollIntoView({ block: 'center' });
    modal.querySelector('button').focus();
  }
  function closeModal() { if (modal) { modal.remove(); modal = null; } }
  document.addEventListener('click', function (e) {
    if (!modal) return;
    if (e.target.closest('[data-act="closemodal"]') || e.target === modal) closeModal();
  });

  // ---- sidebar -------------------------------------------------------------------
  function renderSide() {
    var wide = document.body.classList.contains('fc-wide');
    if (view === 'table') { side.classList.remove('fc-split'); document.body.classList.remove('fc-detail'); side.innerHTML = renderTable(); return; }
    if (view === 'detail' && byId[selId]) {
      var d = renderDetail(byId[selId]);
      side.classList.toggle('fc-split', wide); document.body.classList.toggle('fc-detail', wide);
      side.innerHTML = wide ? '<div class="col card">' + d.nav + d.card + '</div><div class="col evidence">' + d.body + '</div>' : d.nav + d.card + d.body;
      return;
    }
    side.classList.remove('fc-split'); document.body.classList.remove('fc-detail');
    view = 'list'; side.innerHTML = renderList();
  }
  function renderList() {
    var iss = issues(), open = iss.filter(function (c) { return decided(c) !== 'dismiss'; }).length;
    var h = '<div class="hd"><div class="seg">';
    [['issues', 'Issues', open], ['all', 'All claims', claims.length]].forEach(function (f) {
      h += '<button data-filter="' + f[0] + '"' + (filter === f[0] ? ' class="on"' : '') + '>' + f[1] + ' · ' + f[2] + '</button>';
    });
    h += '</div>';
    if (!tipSeen()) h += '<div class="tip"><span><kbd>J</kbd> and <kbd>K</kbd> move between issues, <kbd>1</kbd> queues the edit, <kbd>2</kbd> dismisses. Press <kbd>?</kbd> for all shortcuts.</span><button class="x" data-act="tipdone" title="Got it">×</button></div>';
    h += '</div>';
    h += '<div class="scroll">';
    var list = queueFor(filter);
    if (!list.length) h += '<div class="empty">' + (filter === 'issues' ? (iss.length ? 'Every issue is handled. Send your edits to the agent.' : 'No issues found in this document.') : 'Nothing to show.') + '</div>';
    list.forEach(function (c) {
      var s = st(c), d = decided(c), prob = isProblem(c), queued = d === 'apply', rec = decisions[c.id] || {};
      h += '<button class="item' + (queued ? ' queued' : '') + (c.id === selId ? ' sel' : '') + '" data-id="' + esc(c.id) + '" style="border-left-color:' + (queued ? '#2e7d4f' : prob ? s.color : 'transparent') + ';background:' + (queued ? '#eef7f0' : prob ? s.row : 'transparent') + '">';
      h += '<div class="row"><span class="tag" style="color:' + s.color + ';background:' + (prob ? s.pill : 'transparent') + '">' + esc(s.label) + '</span>';
      h += queued ? '<span class="qd">✓ Edit queued</span>' : (d ? '<span class="dec">' + (DECIDED[d] || '') + '</span>' : '');
      h += '</div><div class="snip">“' + esc(c.anchor) + '”</div>';
      if (queued) h += '<div class="snip new">→ ' + esc(rec.replacement || suggested(c)) + '</div>';
      h += '</button>';
    });
    h += '</div>';
    return h;
  }
  function renderTable() {
    var h = '<div class="nav"><button class="back" data-act="back">← <span>Back</span></button><span style="font-weight:600">Claim table</span><span class="pos"></span><button class="btn" data-act="copytable" style="font-size:12px;padding:5px 10px;font-weight:400">' + (copied === 'table' ? 'Copied' : 'Copy as Markdown') + '</button></div>';
    h += '<div class="scroll"><table><thead><tr><th style="padding-left:14px">#</th><th>Status</th><th>Claim</th></tr></thead><tbody>';
    ordered().forEach(function (c, i) {
      var s = st(c), keys = (c.sources || []).map(function (x) { return x.key || x.url || ''; }).filter(function (k, j, a) { return k && a.indexOf(k) === j; }).join(', ');
      h += '<tr class="r" data-id="' + esc(c.id) + '"><td class="n">' + (i + 1) + '</td><td class="s" style="color:' + s.color + '">' + esc(s.label) + '</td><td>' + esc(c.claim || c.anchor) + '<div class="srcs">' + esc(keys) + '</div></td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }
  function applyButton(rec) {
    var dirty = rec.d === 'apply' && draft != null && draft !== rec.replacement;
    if (dirty) return '<button class="btn primary" data-d="apply" title="The queued edit still has the previous wording">Update queued edit · unsaved changes</button>';
    if (rec.d === 'apply') return '<button class="btn on queued" data-d="apply" title="Unqueue this edit"><span class="a">✓ Edit queued</span><span class="b">Unqueue</span></button>';
    return '<button class="btn primary" data-d="apply">Queue edit</button>';
  }
  function renderDetail(c) {
    var s = st(c), rec = decisions[c.id] || {}, sug = suggested(c);
    var srcs = dedupe(c.sources || []), shown = more ? srcs : srcs.slice(0, 2);
    var navl = navList(), pos = navl.findIndex(function (x) { return x.id === c.id; });
    var hasSug = !!(sug || rec.d === 'apply' || rec.replacement || forceEdit);
    var replacement = draft != null ? draft : (rec.replacement != null ? rec.replacement : sug);
    var nav = '<div class="nav"><button class="back" data-act="back">← <span>' + ({ issues: 'Issues', all: 'All claims' })[filter] + '</span></button>';
    var h = '';
    nav += '<span class="pos">' + (pos >= 0 ? (pos + 1) + ' of ' + navl.length : '') + '</span><button class="step" data-act="prev" title="Previous issue (K or ↑)">‹</button><button class="step" data-act="next" title="Next issue (J or ↓)">›</button></div>';
    // decision card
    h += '<div class="cardwrap"><div class="card">';
    h += '<div class="meta"><span class="pill" style="background:' + (s.pill || '#e9e6de') + ';color:' + s.color + '">' + esc(s.label) + '</span><span class="kind">' + esc(KIND[c.kind] || c.kind || '') + '</span><span class="cid">' + esc(c.id) + '</span></div>';
    h += '<div class="note">' + esc(noteBody(c) || (isProblem(c) ? 'No explanation recorded.' : 'Supported by the source below.')) + '</div>';
    var dismissBtn = '<button class="btn' + (rec.d === 'dismiss' ? ' on grey' : '') + '" data-d="dismiss" title="Not a problem; leave the text as it is">' + (rec.d === 'dismiss' ? '— Dismissed' : 'Dismiss') + '</button>';
    if (hasSug) {
      h += '<div class="edit"><div class="lbl">Current</div><div class="old">' + esc(c.anchor) + '</div><div class="lbl">New wording</div><textarea data-f="replacement" placeholder="Type the replacement text">' + esc(replacement) + '</textarea>';
      h += '<div class="acts">' + applyButton(rec) + dismissBtn + '</div></div>';
    } else {
      h += '<div class="acts">' + (isProblem(c) ? '<button class="btn primary" data-act="writefix">Write a fix</button>' : '') + dismissBtn + '</div>';
    }
    h += '<div class="notewrap"><textarea class="usernote" data-f="note" rows="1" placeholder="Add a note for the agent…">' + esc(rec.note || '') + '</textarea><div class="savedhint">Note saved</div></div>';
    h += '</div></div>';
    var card = h; h = '';
    // evidence
    h += '<div class="body"><section><div class="lbl">In the document</div><div class="anchor">“' + esc(c.anchor) + '”</div>' + (c.claim ? '<div class="claim">' + esc(c.claim) + '</div>' : '') + '</section>';
    h += '<section><div class="lbl">' + (srcs.length > 1 ? 'What the sources say' : 'What the source says') + '</div>';
    if (!srcs.length) h += '<div class="nosrc">No source recorded for this claim.</div>';
    shown.forEach(function (x) {
      var href = x.url ? x.url + (x.no_fragment ? '' : textFragment(x.quote)) : '';
      h += '<div class="src"><div class="h"><b>' + esc(x.key || x.url || 'Source') + '</b><span class="loc">' + esc(x.locator || '') + '</span>' + (href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener">Open ↗</a>' : '') + '</div>';
      if (x.quote) h += '<div class="q">' + esc(x.quote) + '</div>';
      if (x.verified_against) {
        var va = String(x.verified_against), fname = va.split(' ')[0];
        if (x.excerpt) h += '<div class="fine">matched in <a href="#" data-act="excerpt" data-cid="' + esc(c.id) + '" data-si="' + (c.sources || []).indexOf(x) + '" title="Show the passage in the saved source text">' + esc(va) + '</a></div>';
        else if (/^https?:/.test(fname)) h += '<div class="fine">matched in <a href="' + esc(fname) + '" target="_blank" rel="noopener">' + esc(va) + '</a></div>';
        else h += '<div class="fine">matched in ' + esc(va) + '</div>';
      }
      h += '</div>';
    });
    if (srcs.length > 2) h += '<button class="more" data-act="more">' + (more ? 'Show fewer' : 'Show ' + (srcs.length - 2) + ' more source' + (srcs.length - 2 > 1 ? 's' : '')) + '</button>';
    if (c.checked_by && c.checked_by.length) h += '<div class="fine" style="margin-top:8px">Checked by ' + esc(c.checked_by.join(', ')) + '</div>';
    h += '</section></div>';
    return { nav: nav, card: card, body: h };
  }

  function update(id, fn) {
    var c = byId[id], rec = Object.assign({}, decisions[id] || {});
    fn(rec);
    if (rec.replacement == null) rec.replacement = suggested(c);
    if (!rec.d && !rec.note && rec.replacement === suggested(c)) delete decisions[id]; else decisions[id] = rec;
    save();
  }
  function decide(d) {
    if (!selId) return;
    var rec = decisions[selId] || {};
    if (d === 'apply' && rec.d === 'apply' && draft != null && draft !== rec.replacement) {
      var v = draft; draft = null;
      update(selId, function (r) { r.replacement = v; r.d = 'apply'; });
    } else {
      draft = null;
      update(selId, function (r) { if (r.d === d) delete r.d; else r.d = d; });
    }
    refresh();
  }
  function autosize(ta, maxLines) {
    if (!ta) return;
    var lh = parseFloat(getComputedStyle(ta).lineHeight) || 20, pad = ta.offsetHeight - ta.clientHeight;
    ta.style.height = 'auto';
    var max = maxLines * lh + (parseFloat(getComputedStyle(ta).paddingTop) || 0) + (parseFloat(getComputedStyle(ta).paddingBottom) || 0) + pad;
    ta.style.height = Math.min(ta.scrollHeight + pad, max) + 'px';
    ta.style.overflowY = ta.scrollHeight + pad > max ? 'auto' : 'hidden';
  }
  function sizeAll() { autosize(side.querySelector('[data-f="replacement"]'), 5); autosize(side.querySelector('[data-f="note"]'), 10); }
  function refresh() { renderTop(); renderSide(); paint(); sizeAll(); }
  function select(id, scroll) {
    selId = id; view = 'detail'; more = false; forceEdit = false; draft = null;
    refresh();
    if (scroll) scrollTo(id);
    var ta = side.querySelector('[data-f="replacement"]');
    if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }
  function scrollTo(id) {
    var m = document.querySelector('mark[data-fc="' + id + '"]'); if (!m) return;
    var r = m.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top - Math.max(120, innerHeight * 0.3), behavior: 'smooth' });
    m.setAttribute('data-pulse', '1'); setTimeout(function () { m.removeAttribute('data-pulse'); }, 1300);
  }
  function step(dir) {
    var l = view === 'detail' ? navList() : queueFor(filter); if (!l.length) return;
    var i = l.findIndex(function (c) { return c.id === selId; });
    var n = i < 0 ? (dir > 0 ? 0 : l.length - 1) : Math.min(l.length - 1, Math.max(0, i + dir));
    select(l[n].id, true);
  }
  function back() { view = 'list'; selId = null; refresh(); }

  side.addEventListener('click', function (e) {
    var ex = e.target.closest('a[data-act="excerpt"]');
    if (ex) { e.preventDefault(); showExcerpt(ex.getAttribute('data-cid'), +ex.getAttribute('data-si')); return; }
    var b = e.target.closest('button,tr.r'); if (!b) return;
    if (b.hasAttribute('data-filter')) { filter = b.getAttribute('data-filter'); renderSide(); paint(); return; }
    if (b.classList.contains('item') || b.classList.contains('r')) { select(b.getAttribute('data-id'), true); return; }
    if (b.hasAttribute('data-d')) { decide(b.getAttribute('data-d')); return; }
    var a = b.getAttribute('data-act');
    if (a === 'back') back();
    if (a === 'prev') step(-1);
    if (a === 'next') step(1);
    if (a === 'more') { more = !more; renderSide(); sizeAll(); }
    if (a === 'writefix') { forceEdit = true; renderSide(); sizeAll(); side.querySelector('[data-f="replacement"]').focus(); }
    if (a === 'copytable') copy('table');
    if (a === 'shortcuts') showShortcuts();
    if (a === 'tipdone') { markTip(); renderSide(); }
    if (a === 'excerpt') { e.preventDefault(); showExcerpt(b.getAttribute('data-cid'), +b.getAttribute('data-si')); }
  });
  side.addEventListener('input', function (e) {
    var f = e.target.getAttribute('data-f'); if (!f || !selId) return;
    var v = e.target.value, rec = decisions[selId] || {};
    autosize(e.target, f === 'note' ? 10 : 5);
    if (f === 'note') {
      var hint = side.querySelector('.savedhint'); if (hint) { hint.classList.add('show'); clearTimeout(hint._t); hint._t = setTimeout(function () { hint.classList.remove('show'); }, 1500); }
    }
    if (f === 'replacement' && rec.d === 'apply') {
      draft = v;
      var b = side.querySelector('[data-d="apply"]'); if (b) b.outerHTML = applyButton(rec);
      return;
    }
    update(selId, function (r) { r[f] = v; });
    // Light refresh: keep focus in the textarea, update labels only.
    renderTop(); paint();
  });
  document.addEventListener('click', function (e) {
    var m = e.target.closest && e.target.closest('mark[data-fc]');
    if (m && m.getAttribute('data-quiet') !== '1') { e.preventDefault(); e.stopPropagation(); select(m.getAttribute('data-fc'), false); return; }
    if (view === 'detail' && !e.target.closest('#fc-side,#fc-top,#fc-modal,a,button')) back();
  }, true);
  document.addEventListener('keydown', function (e) {
    if (modal) { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); closeModal(); } return; }
    var typing = /TEXTAREA|INPUT/.test(e.target.tagName);
    if (typing && (e.metaKey || e.ctrlKey) && e.key === 'Enter' && view === 'detail') { e.preventDefault(); decide('apply'); return; }
    if (!typing && e.key === '?') { e.preventDefault(); showShortcuts(); return; }
    if (typing && !e.altKey) return;
    if (e.metaKey || e.ctrlKey) return;
    var k = e.code === 'KeyJ' ? 'j' : e.code === 'KeyK' ? 'k' : e.code === 'Digit1' ? '1' : e.code === 'Digit2' ? '2' : e.key;
    if (k === 'j' || k === 'ArrowDown') { e.preventDefault(); markTip(); step(1); }
    if (k === 'k' || k === 'ArrowUp') { e.preventDefault(); markTip(); step(-1); }
    if (view === 'detail' && (k === '1' || k === '2')) { e.preventDefault(); decide(k === '1' ? 'apply' : 'dismiss'); }
  });
  function onResize() {
    var wide = innerWidth >= 1500;
    document.body.classList.toggle('fc-narrow', innerWidth < 860);
    var was = document.body.classList.contains('fc-wide');
    document.body.classList.toggle('fc-wide', wide);
    if (was !== wide && claims.length) renderSide();
  }
  window.addEventListener('resize', onResize);

  // ---- boot ---------------------------------------------------------------------
  function boot(data) {
    claims = Array.isArray(data) ? data : (data.claims || []);
    claims.forEach(function (c) { byId[c.id] = c; });
    document.body.classList.add('fc-active'); onResize();
    document.body.appendChild(top); document.body.appendChild(side);
    anchorAll(root());
    var legendHost = document.getElementById('document');
    if (legendHost) {
      var lg = document.createElement('div'); lg.id = 'fc-legend';
      lg.innerHTML = '<span><i style="background:#fad6d1;box-shadow:inset 0 -2px #d9564b"></i>Unsupported or contradicted</span><span><i style="background:#fbe9bf;box-shadow:inset 0 -2px #dda634"></i>Supported with caveat</span><span><i style="background:#dff0e3;box-shadow:inset 0 -2px #5aa876"></i>Supported</span><span><i style="height:0;border-bottom:2px solid #2e7d4f;vertical-align:3px"></i>Edit queued ✎</span>';
      legendHost.parentNode.insertBefore(lg, legendHost.nextSibling);
    }
    refresh();
  }
  function start(data) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(data); }); else boot(data); }
  start(embedded);
})();
