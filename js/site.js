// 検索サジェスト（型番の前方一致・部分一致）と GA4
(function () {
  var me = document.currentScript;
  var ga4 = me && me.getAttribute('data-ga4');
  if (ga4) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ga4);
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a.btn.amazon');
      if (!a) return;
      window.gtag('event', 'store_click', { store: 'amazon', link_text: (a.textContent || '').trim().slice(0, 60), page_path: location.pathname });
    });
  }

  var index = null;
  function norm(s) { return String(s || '').toUpperCase().replace(/[\s　]+/g, '').replace(/[‐‑‒–—−ー]/g, '-'); }
  function load(cb) {
    if (index) return cb(index);
    fetch('/kaegoro-site/search-index.json').then(function (r) { return r.json(); }).then(function (d) { index = d; cb(d); }).catch(function () { cb([]); });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function search(d, q) {
    q = norm(q); if (!q) return [];
    var qd = q.replace(/-/g, '');
    var hits = [];
    for (var i = 0; i < d.length; i++) {
      var m = norm(d[i].m), md = m.replace(/-/g, '');
      var score = m === q || md === qd ? 0 : m.indexOf(q) === 0 || md.indexOf(qd) === 0 ? 1 : md.indexOf(qd) >= 0 ? 2 : -1;
      if (score >= 0) hits.push([score, d[i]]);
    }
    // 同点なら「入力に近い（短い）型番」を先に。NA-LX127 と打って NA-LX113A が先に来ないように
    hits.sort(function (a, b) { return a[0] - b[0] || a[1].m.length - b[1].m.length || a[1].m.localeCompare(b[1].m); });
    return hits.slice(0, 12).map(function (h) { return h[1]; });
  }

  document.querySelectorAll('form.search').forEach(function (form) {
    var input = form.querySelector('input[type=search]');
    var ul = form.querySelector('ul.suggest');
    if (!input || !ul) return;
    var sel = -1;
    function render(list) {
      sel = -1;
      if (!list.length) { ul.hidden = true; ul.innerHTML = ''; return; }
      ul.innerHTML = list.map(function (x) { return '<li><a href="' + esc(x.u) + '"><span>' + esc(x.m) + '</span><span class="cat">' + esc(x.k + ' ' + x.c) + '</span></a></li>'; }).join('');
      ul.hidden = false;
    }
    input.addEventListener('input', function () {
      var q = input.value;
      if (!q.trim()) return render([]);
      load(function (d) { render(search(d, q)); });
    });
    input.addEventListener('keydown', function (e) {
      var items = ul.querySelectorAll('a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (a, i) { a.classList.toggle('sel', i === sel); });
      } else if (e.key === 'Enter') {
        if (sel >= 0 && items[sel]) { e.preventDefault(); location.href = items[sel].getAttribute('href'); return; }
        // 完全一致があれば直行
        load(function (d) {
          var r = search(d, input.value);
          if (r.length && norm(r[0].m) === norm(input.value)) { e.preventDefault(); location.href = r[0].u; }
        });
      } else if (e.key === 'Escape') { render([]); }
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) render([]); });
  });

  // /search/ ページ: クエリを取って結果を出す
  var box = document.getElementById('search-results');
  if (box) {
    var q = new URLSearchParams(location.search).get('q') || '';
    var qEl = document.getElementById('search-q');
    if (qEl) qEl.textContent = q;
    load(function (d) {
      var r = search(d, q);
      if (!q.trim()) { box.innerHTML = '<p class="muted">型番を入力してください。</p>'; return; }
      if (!r.length) { box.innerHTML = '<p>「' + esc(q) + '」に一致する機種は見つかりませんでした。型番は本体の前面・側面・背面のラベルに「KC-」「KI-」「FU-」などから始まる英数字で書かれています。ハイフンや色記号（-W など）を除いて試してください。</p>'; return; }
      box.innerHTML = '<ul class="result-list">' + r.map(function (x) { return '<li><a href="' + esc(x.u) + '">' + esc(x.m) + '</a> <span class="muted small">' + esc(x.k + ' ' + x.c) + '</span></li>'; }).join('') + '</ul>';
    });
  }
})();
