/* Curve Guide 8.0: ambient backgrounds (original SVG/CSS art, accent-coloured, low opacity).
   Only on non-map surfaces: welcome screen, sheet backdrops and the header strip.
   Never on the map, nav banner, SOS sheet or alerts. Paused while the tab is hidden and while
   driving/navigating. prefers-reduced-motion -> static (global CSS rule stops all animation). */
(function () {
  'use strict';
  var STYLES = ['waves', 'trees', 'road', 'city', 'stars', 'bokeh', 'glow', 'off'];
  var LABELS = { waves: 'Waves', trees: 'Trees & hills', road: 'Road lines', city: 'City skyline', stars: 'Night sky', bokeh: 'Bokeh', glow: 'Glow', off: 'Off' };
  // Deterministic pseudo-random so the art is the same every load.
  function rnd(seed) { var s = seed; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function wave(y, amp, n) {
    // one seamless wave band 0..1200 wide (two periods of 600) so translateX(-50%) loops.
    var d = 'M0 ' + y, w = 1200 / n;
    for (var i = 0; i < n; i++) {
      var x = i * w;
      d += ' C ' + (x + w * 0.25) + ' ' + (y - amp) + ', ' + (x + w * 0.75) + ' ' + (y + amp) + ', ' + (x + w) + ' ' + y;
    }
    return d + ' L1200 200 L0 200 Z';
  }
  function svg(vb, inner, par) {
    return '<svg viewBox="' + vb + '" preserveAspectRatio="' + (par || 'none') + '" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }
  function band(cls, inner, vb, par) { return '<div class="amb-band ' + cls + '">' + svg(vb || '0 0 1200 200', inner, par) + '</div>'; }
  function hills(seed, base, amp) {
    var r = rnd(seed), d = 'M0 200 L0 ' + base, x = 0;
    while (x < 1200) { var nx = Math.min(1200, x + 150 + r() * 120); d += ' Q ' + ((x + nx) / 2) + ' ' + (base - amp * (0.4 + r() * 0.6)) + ', ' + nx + ' ' + base; x = nx; }
    return d + ' L1200 200 Z';
  }
  function trees(seed, base, count, h) {
    var r = rnd(seed), out = '';
    for (var i = 0; i < count; i++) {
      var x = (i + r() * 0.6) * (600 / count), s = h * (0.6 + r() * 0.6);
      for (var k = 0; k < 2; k++) { // repeat each 600px so the band loops
        var X = x + k * 600;
        out += '<path d="M' + X + ' ' + base + ' l' + (s * 0.32) + ' 0 l-' + (s * 0.32) + ' -' + s + ' l-' + (s * 0.32) + ' ' + s + ' Z"/>' +
          '<rect x="' + (X - 1.5) + '" y="' + base + '" width="3" height="' + (s * 0.18) + '"/>';
      }
    }
    return out;
  }
  function skyline(seed) {
    var r = rnd(seed), out = '', x = 0, win = '';
    while (x < 600) {
      var w = 18 + r() * 34, h = 30 + r() * 80;
      for (var k = 0; k < 2; k++) {
        var X = x + k * 600;
        out += '<rect x="' + X + '" y="' + (200 - h) + '" width="' + (w - 3) + '" height="' + h + '"/>';
        if (r() > 0.55) win += '<rect class="amb-win" style="animation-delay:' + (r() * 6).toFixed(1) + 's" x="' + (X + 5) + '" y="' + (200 - h + 8) + '" width="4" height="5"/>';
      }
      x += w;
    }
    // A tall tower with a spire and a cable-stayed bridge (Lagos-style waterfront), drawn freehand.
    var tower = '', bridge = '';
    for (var k2 = 0; k2 < 2; k2++) {
      var o = k2 * 600;
      tower += '<rect x="' + (o + 300) + '" y="62" width="26" height="138"/><rect x="' + (o + 311) + '" y="38" width="4" height="26"/>';
      bridge += '<rect x="' + (o + 470) + '" y="120" width="4" height="80"/>';
      for (var c = 0; c < 6; c++) bridge += '<line x1="' + (o + 472) + '" y1="' + (124 + c * 4) + '" x2="' + (o + 400 + c * 6) + '" y2="186"/><line x1="' + (o + 472) + '" y1="' + (124 + c * 4) + '" x2="' + (o + 544 - c * 6) + '" y2="186"/>';
      bridge += '<rect x="' + (o + 392) + '" y="186" width="160" height="3"/>';
    }
    return '<g class="amb-fill">' + out + tower + '</g><g class="amb-stroke">' + bridge + '</g><g class="amb-wins">' + win + '</g>';
  }
  function dots(seed, n, cls, maxR) {
    var r = rnd(seed), out = '';
    for (var i = 0; i < n; i++) {
      out += '<span class="' + cls + '" style="left:' + (r() * 100).toFixed(1) + '%;top:' + (r() * 100).toFixed(1) + '%;--d:' + (r() * 6).toFixed(1) + 's;--s:' + (1 + r() * maxR).toFixed(1) + 'px;--t:' + (6 + r() * 8).toFixed(1) + 's"></span>';
    }
    return out;
  }
  function art(style) {
    switch (style) {
      case 'waves':
        return band('amb-w1', '<path d="' + wave(120, 26, 2) + '"/>') + band('amb-w2', '<path d="' + wave(140, 18, 4) + '"/>') + band('amb-w3', '<path d="' + wave(160, 12, 2) + '"/>');
      case 'trees':
        return band('amb-h1', '<path d="' + hills(7, 150, 70) + '"/>') +
          band('amb-h2', '<path d="' + hills(11, 175, 45) + '"/>' + trees(5, 178, 9, 38));
      case 'road':
        var lines = '';
        [60, 110, 160].forEach(function (y, i) { lines += '<line class="amb-dash" x1="0" y1="' + y + '" x2="1200" y2="' + y + '" style="stroke-dasharray:' + (40 - i * 8) + ' ' + (40 - i * 8) + '"/>'; });
        return band('amb-r1', '<rect class="amb-lane" x="0" y="40" width="1200" height="140"/>' + lines);
      case 'city':
        return band('amb-c1', skyline(3), '0 0 1200 200', 'xMidYMax slice');
      case 'stars':
        return '<div class="amb-field">' + dots(17, 46, 'amb-star', 1.6) + '</div><div class="amb-moon"></div>';
      case 'bokeh':
        return '<div class="amb-field">' + dots(23, 12, 'amb-bok', 60) + '</div>';
      case 'glow':
        return '<div class="amb-glow g1"></div><div class="amb-glow g2"></div>';
    }
    return '';
  }
  var current = null;
  function targets() {
    var list = [];
    var w = document.getElementById('welcome'); if (w) list.push(w);
    document.querySelectorAll('.cg-overlay').forEach(function (o) { list.push(o); });
    var h = document.querySelector('body > .app header, body header'); if (h) list.push(h);
    return list;
  }
  function apply(style) {
    style = STYLES.indexOf(style) >= 0 ? style : 'waves';
    if (style === current) return;
    current = style;
    document.body.setAttribute('data-ambient', style);
    targets().forEach(function (t) {
      var old = t.querySelector(':scope > .cg-ambient'); if (old) old.remove();
      if (style === 'off') return;
      var d = document.createElement('div');
      d.className = 'cg-ambient amb-' + style + (t.tagName === 'HEADER' ? ' amb-header' : '');
      d.setAttribute('aria-hidden', 'true');
      d.innerHTML = art(style);
      t.insertBefore(d, t.firstChild);
    });
  }
  function driving() {
    try { return !!(window.__cgIsDriving && window.__cgIsDriving()) || !!document.querySelector('.nav-banner.open'); } catch (e) { return false; }
  }
  function syncPause() {
    document.body.classList.toggle('amb-paused', document.hidden || driving());
  }
  document.addEventListener('visibilitychange', syncPause);
  setInterval(syncPause, 2000);
  function init() {
    var p = {};
    try { p = (window.__cgPremiumUI && window.__cgPremiumUI.loadProfile()) || {}; } catch (e) {}
    apply(p.bg || 'waves'); syncPause();
  }
  window.__cgAmbient = { apply: apply, styles: STYLES, labels: LABELS, art: art, syncPause: syncPause, current: function () { return current; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
