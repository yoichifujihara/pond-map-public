/* GitHub Pages 実URL 動作確認用（content script / isolated world） */
(function () {
  'use strict';

  var diag = { errors: [], csp: [], rejections: [] };
  window.addEventListener('error', function (e) {
    diag.errors.push((e.message || String(e.type)) + ' @' + (e.filename || '') + ':' + (e.lineno || 0));
  }, true);
  window.addEventListener('unhandledrejection', function (e) { diag.rejections.push(String(e.reason)); });
  window.addEventListener('securitypolicyviolation', function (e) {
    diag.csp.push(e.violatedDirective + ' <- ' + e.blockedURI);
  }, true);

  function $(i) { return document.getElementById(i); }
  function st() { return $('status') ? $('status').textContent : '(no #status)'; }
  function btns() { return $('result-list') ? $('result-list').querySelectorAll('button') : []; }
  function pop() {
    var p = document.querySelector('.leaflet-popup-content');
    return p ? p.textContent.replace(/\s+/g, ' ').trim() : '(none)';
  }
  function linkInfo() {
    return Array.prototype.map.call(
      document.querySelectorAll('.leaflet-popup-content .pond-links-list a'),
      function (a) {
        return { text: a.textContent, href: a.href, target: a.getAttribute('target'),
                 rel: a.getAttribute('rel'), refpol: a.getAttribute('referrerpolicy') };
      });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function emit(obj) {
    var pre = document.createElement('pre');
    pre.id = 'livetest-out';
    pre.textContent = JSON.stringify(obj, null, 1);
    document.body.appendChild(pre);
  }

  (async function () {
    try {
      for (var w = 0; w < 400 && !document.body; w++) { await wait(50); }
      for (var i = 0; i < 400 && st().indexOf('全 ') !== 0; i++) { await wait(100); }

      var out = {};
      out.pageUrl = location.href;
      out.protocol = location.protocol;
      out.title = document.title;
      out.lang = document.documentElement.lang;
      out.charset = document.characterSet;
      out.status0 = st();
      out.cityOptions = $('city-select').options.length;
      out.cityList = Array.prototype.map.call($('city-select').options, function (o) { return o.value; });
      out.resolvedCss = Array.prototype.map.call(document.querySelectorAll('link[rel=stylesheet]'), function (l) { return l.href; });
      out.resolvedJs = Array.prototype.map.call(document.querySelectorAll('script[src]'), function (s) { return s.src; });
      out.tiles = document.querySelectorAll('img.leaflet-tile').length;
      out.nonHttpsTiles = Array.prototype.filter.call(document.querySelectorAll('img.leaflet-tile'), function (t) { return t.src.indexOf('https://') !== 0; }).length;
      out.canvas = document.querySelectorAll('#map canvas').length;
      out.iframes = document.querySelectorAll('iframe').length;

      var sel = $('city-select');
      sel.value = '珠洲市';
      sel.dispatchEvent(new Event('change'));
      await wait(900);
      out.cityFilter = st();

      $('name-input').value = '大池';
      $('search-button').click();
      await wait(900);
      out.nameSearch = st();
      out.candidates = btns().length;
      out.firstCandidate = btns().length ? btns()[0].textContent.replace(/\s+/g, ' ').trim() : '(none)';

      if (btns().length) { btns()[0].click(); }
      await wait(1200);
      out.popup1 = pop();
      out.links1 = linkInfo();

      $('clear-button').click();
      await wait(1200);
      out.cleared = { status: st(), city: $('city-select').value, name: $('name-input').value,
                      resultsHidden: $('results').hidden, popups: document.querySelectorAll('.leaflet-popup').length };

      $('name-input').value = '水尻no.1';
      $('search-button').click();
      await wait(1200);
      out.normalize = st();
      out.popup2 = pop();
      out.links2 = linkInfo();

      $('clear-button').click();
      $('name-input').value = 'zzzzzz';
      $('search-button').click();
      await wait(900);
      out.zeroHit = st();
      out.zeroHidden = $('results').hidden;
      $('clear-button').click();
      await wait(600);
      out.afterFinalClear = st();

      var hosts = {};
      Array.prototype.forEach.call(document.querySelectorAll('img'), function (im) {
        var s = im.src || '';
        var k = s.indexOf('data:') === 0 ? 'data:' : s.split('/').slice(0, 3).join('/');
        hosts[k] = (hosts[k] || 0) + 1;
      });
      out.imgHosts = hosts;

      var res = performance.getEntriesByType('resource');
      var byOrigin = {}, paths = [];
      res.forEach(function (r) {
        var o;
        try { o = new URL(r.name).origin; } catch (e) { o = '(?)'; }
        byOrigin[o] = (byOrigin[o] || 0) + 1;
        if (o === location.origin) { paths.push(new URL(r.name).pathname); }
      });
      out.networkByOrigin = byOrigin;
      out.sameOriginPaths = paths.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
      out.totalRequests = res.length;
      out.suspicious = res.map(function (r) { return r.name; }).filter(function (n) {
        return /google\.com\/maps|disaportal|maps\.gsi\.go\.jp|unpkg|jsdelivr|cdnjs|google-analytics|googletagmanager|doubleclick|fonts\.googleapis|fonts\.gstatic/.test(n);
      });

      out.docScrollWidth = document.documentElement.scrollWidth;
      out.docClientWidth = document.documentElement.clientWidth;
      out.hOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      out.diag = diag;

      emit(out);
    } catch (err) {
      emit({ FATAL: String(err), stack: String(err && err.stack), diag: diag });
    }
  }());
}());
