/* Nearby drivers. Opt-in only. Shares a rough position, speed, and heading. No name. */
(function () {
  var BASE = '0123456789bcdefghjkmnpqrstuvwxyz';
  var on = false, timer = null, unsub = null, markers = {}, areaNow = '', denied = false;
  function $(id) { return document.getElementById(id); }
  function encode(lat, lng, prec) {
    var idx = 0, bit = 0, even = true, hash = '', latR = [-90, 90], lngR = [-180, 180];
    while (hash.length < prec) {
      var mid;
      if (even) { mid = (lngR[0] + lngR[1]) / 2; if (lng >= mid) { idx = idx * 2 + 1; lngR[0] = mid; } else { idx *= 2; lngR[1] = mid; } }
      else { mid = (latR[0] + latR[1]) / 2; if (lat >= mid) { idx = idx * 2 + 1; latR[0] = mid; } else { idx *= 2; latR[1] = mid; } }
      even = !even;
      if (++bit === 5) { hash += BASE.charAt(idx); bit = 0; idx = 0; }
    }
    return hash;
  }
  function db() {
    try { if (typeof firebase === 'undefined' || !firebase.apps.length) return null; return firebase.firestore(); } catch (e) { return null; }
  }
  function uid() {
    try { var u = firebase.auth && firebase.auth().currentUser; return u && u.uid; } catch (e) { return null; }
  }
  function clearMarkers() {
    Object.keys(markers).forEach(function (k) { try { markers[k].remove(); } catch (e) {} });
    markers = {};
  }
  function paint(docs, me) {
    var map = window.__cgApi && window.__cgApi.getMap && window.__cgApi.getMap();
    if (!map || !window.maplibregl) return;
    var seen = {}, now = Date.now();
    docs.forEach(function (d) {
      if (d.id === me) return;
      var v = d.data() || {};
      if (now - (v.at || 0) > 20000) return;
      if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) return;
      seen[d.id] = 1;
      var kmh = Math.max(0, Math.round((v.speed || 0) * 3.6));
      var el;
      if (!markers[d.id]) {
        el = document.createElement('div');
        el.className = 'hive-car';
        el.innerHTML = '<i></i><b></b>';
        markers[d.id] = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'viewport' }).setLngLat([v.lng, v.lat]).addTo(map);
      } else {
        el = markers[d.id].getElement();
        markers[d.id].setLngLat([v.lng, v.lat]);
      }
      el.style.setProperty('--h', (Number(v.heading) || 0) + 'deg');
      el.querySelector('b').textContent = kmh + ' km/h';
      el.title = 'Another Curve Guide driver, ' + kmh + ' km/h. No name is shared.';
    });
    Object.keys(markers).forEach(function (k) { if (!seen[k]) { markers[k].remove(); delete markers[k]; } });
  }
  function tick() {
    var id = uid(), store = db(), fix = window.__cgApi && window.__cgApi.getFix && window.__cgApi.getFix();
    if (!on || !id || !store || !fix || !fix.coords) return null;
    var lat = fix.coords.latitude, lng = fix.coords.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    var area = encode(lat, lng, 6);
    var speed = window.__cgApi.getSpeedMs ? (window.__cgApi.getSpeedMs() || 0) : 0;
    var heading = Number.isFinite(fix.coords.heading) && fix.coords.heading >= 0 ? fix.coords.heading : 0;
    store.collection('live').doc(id).set({ lat: lat, lng: lng, speed: speed, heading: heading, area: area, at: Date.now() }).catch(function () {
      if (!denied) {
        denied = true;
        var b = $('hiveBtn');
        if (b) b.title = 'Nearby sharing is saved in the app, but Firebase still has to allow the live list.';
      }
    });
    return area;
  }
  function listen(area) {
    var id = uid(), store = db();
    if (!id || !store || !area || (area === areaNow && unsub)) return;
    areaNow = area;
    if (unsub) { unsub(); unsub = null; }
    unsub = store.collection('live').where('area', '==', area).onSnapshot(function (snap) { paint(snap.docs, id); }, function () {});
  }
  function setOn(next) {
    var b = $('hiveBtn');
    if (next && !uid()) {
      if (window.__cgPremiumUI && window.__cgPremiumUI.showAuth) window.__cgPremiumUI.showAuth('signin');
      return;
    }
    on = !!next;
    if (b) {
      b.textContent = 'Nearby drivers: ' + (on ? 'On' : 'Off');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('active', on);
    }
    if (timer) clearInterval(timer);
    if (!on) {
      if (unsub) { unsub(); unsub = null; }
      areaNow = '';
      clearMarkers();
      var id = uid(), store = db();
      if (id && store) store.collection('live').doc(id).delete().catch(function () {});
      return;
    }
    var area = tick();
    if (area) listen(area);
    timer = setInterval(function () { var a = tick(); if (a) listen(a); }, 4000);
  }
  function boot() {
    var b = $('hiveBtn');
    if (!b) return;
    b.title = 'Share speed and direction with other Curve Guide drivers within about a kilometre. No name. Off by default.';
    b.addEventListener('click', function () { setOn(!on); });
    window.addEventListener('pagehide', function () { if (on) setOn(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
