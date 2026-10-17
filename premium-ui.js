/* Curve Guide Apex / Auth / Profile UI (preview)
 * Local-only until Firebase + Paystack are wired (see auth.js).
 * Profile fields: curveGuide.profile — comment markers show where cloud sync goes.
 */
(function () {
  'use strict';
  var PROFILE_KEY = 'curveGuide.profile';
  /* Firebase sync later: read/write PROFILE_KEY from Firestore under users/{uid}/profile */

  var CAR_ICONS = {
    sedan: '<svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M10 30l3-10c1-3 3-5 7-5h8c4 0 6 2 7 5l3 10v6a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1H16v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-6zm6.5-3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm15 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM16 18h16l-1.2-3.5c-.4-1.2-1.5-2-2.8-2H20c-1.3 0-2.4.8-2.8 2L16 18z"/></svg>',
    suv: '<svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M8 30l2-11c1-4 4-7 9-7h10c5 0 8 3 9 7l2 11v7a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1H14v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-7zm7-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm18 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM15 16h18l-.8-2.2C31.6 12.2 30.2 11 28.5 11h-9c-1.7 0-3.1 1.2-3.7 2.8L15 16z"/></svg>',
    bus: '<svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M12 8h24a4 4 0 0 1 4 4v22a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1H14v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V12a4 4 0 0 1 4-4zm2 6h20v8H14v-8zm3 16a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm14 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>',
    bike: '<svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M14 34a6 6 0 1 1 0-12 6 6 0 0 1 0 12zm20 0a6 6 0 1 1 0-12 6 6 0 0 1 0 12zM14 28h8l4-10h6l-3 7h5l3-7h3l-5 12H26l-4 6h-4l3-6h-7v-2z"/></svg>',
    arrow: '<svg viewBox="0 0 48 48" width="26" height="30" aria-hidden="true"><path fill="currentColor" d="M24 4l16 28h-10v12h-12V32H8L24 4z"/></svg>'
  };

  function $(id) { return document.getElementById(id); }
  function auth() { return window.__cgAuth || null; }

  function defaultProfile() {
    return {
      carIcon: 'sedan',
      carColor: '#20c477',
      car: { make: '', model: '', year: '', colour: '', plate: '' },
      theme: 'dark', // dark | light | auto
      // favourites stay in curveGuide.favourites; profile may mirror labels later
    };
  }

  function loadProfile() {
    try {
      var raw = localStorage.getItem(PROFILE_KEY);
      var o = raw ? JSON.parse(raw) : null;
      if (!o || typeof o !== 'object') return defaultProfile();
      var d = defaultProfile();
      return {
        carIcon: CAR_ICONS[o.carIcon] ? o.carIcon : d.carIcon,
        carColor: o.carColor || d.carColor,
        car: Object.assign({}, d.car, o.car || {}),
        theme: /^(dark|light|auto)$/.test(o.theme) ? o.theme : 'dark'
      };
    } catch (e) {
      return defaultProfile();
    }
  }

  function saveProfile(partial) {
    var cur = loadProfile();
    if (partial.carIcon != null) cur.carIcon = CAR_ICONS[partial.carIcon] ? partial.carIcon : cur.carIcon;
    if (partial.carColor != null) cur.carColor = partial.carColor;
    if (partial.theme != null && /^(dark|light|auto)$/.test(partial.theme)) cur.theme = partial.theme;
    if (partial.car) cur.car = Object.assign({}, cur.car, partial.car);
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(cur));
    } catch (e) {}
    /* Firestore sync (users/{uid}.profile) — falls back silently if Firestore unavailable */
    try {
      if (window.__cgAuth && window.__cgAuth.saveProfileLocalAndCloud) {
        window.__cgAuth.saveProfileLocalAndCloud(cur);
      }
    } catch (e2) {}
    return cur;
  };

  function applyTheme() {
    var p = loadProfile();
    var mode = p.theme;
    if (mode === 'auto') {
      mode = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.body.classList.toggle('theme-light', mode === 'light');
    document.documentElement.style.colorScheme = mode === 'light' ? 'light' : 'dark';
  }

  function applyCarMarker() {
    var el = document.querySelector('.car-marker');
    if (!el) return;
    var p = loadProfile();
    var svg = CAR_ICONS[p.carIcon] || CAR_ICONS.sedan;
    el.classList.add('car-marker--svg');
    el.style.color = p.carColor || '#20c477';
    el.innerHTML = svg;
    el.setAttribute('data-car-icon', p.carIcon);
  }

  function openOverlay(id) {
    var el = $(id);
    if (!el) return;
    el.hidden = false;
    el.classList.add('open');
    document.body.classList.add('cg-overlay-open');
  }
  function closeOverlay(id) {
    var el = $(id);
    if (!el) return;
    el.classList.remove('open');
    el.hidden = true;
    if (!document.querySelector('.cg-overlay.open')) document.body.classList.remove('cg-overlay-open');
  }
  function closeAllOverlays() {
    ['authModal', 'premiumScreen', 'profileScreen', 'accountMenu'].forEach(closeOverlay);
  }

  function badgeHtml(snap) {
    if (!snap.signedIn) return '<span class="plan-badge free">Guest</span>';
    if (snap.premium) return '<span class="plan-badge premium">Apex</span>';
    return '<span class="plan-badge free">Free</span>';
  }

  function initials(user) {
    if (!user) return '?';
    var n = (user.displayName || user.email || 'U').trim();
    var parts = n.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }

  function syncAccountButton(snap) {
    var btn = $('accountBtn');
    var menu = $('accountMenu');
    if (!btn) return;
    snap = snap || (auth() && auth().snapshot()) || { signedIn: false, premium: false };
    if (snap.signedIn && snap.user) {
      btn.classList.add('signed-in');
      btn.innerHTML = '<span class="account-avatar" aria-hidden="true">' + initials(snap.user) + '</span>';
      btn.title = snap.user.displayName || snap.user.email || 'Account';
      btn.setAttribute('aria-label', 'Account menu');
    } else {
      btn.classList.remove('signed-in');
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>';
      btn.title = 'Sign in';
      btn.setAttribute('aria-label', 'Sign in');
    }
    if (menu) {
      var body = $('accountMenuBody');
      if (body && snap.signedIn && snap.user) {
        body.innerHTML =
          '<div class="acct-head"><div class="account-avatar lg">' + initials(snap.user) + '</div><div><strong>' +
          escapeHtml(snap.user.displayName || 'Driver') + '</strong><div class="small">' + escapeHtml(snap.user.email || '') +
          '</div>' + badgeHtml(snap) + '</div></div>' +
          '<button type="button" class="btn" data-acct="profile">Profile &amp; settings</button>' +
          (snap.premium
            ? '<button type="button" class="btn" data-acct="premium">Manage plan</button>'
            : '<button type="button" class="btn primary" data-acct="upgrade">Upgrade to Apex</button>') +
          '<button type="button" class="btn" data-acct="signout">Sign out</button>';
      }
    }
    syncProBadges(snap);
    syncPreviewBar(snap);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function syncProBadges(snap) {
    snap = snap || (auth() && auth().snapshot()) || {};
    var gate = !!(auth() && auth().gatingOn());
    document.querySelectorAll('[data-pro-feature]').forEach(function (el) {
      var badge = el.querySelector('.pro-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'pro-badge';
        badge.textContent = 'APEX';
        el.appendChild(badge);
      }
      badge.hidden = !gate;
      el.classList.toggle('pro-gated', gate && !snap.premium);
    });
  }

  function syncPreviewBar(snap) {
    var bar = $('previewGateBar');
    if (!bar) return;
    snap = snap || (auth() && auth().snapshot()) || {};
    var note = $('previewAuthNote');
    if (note) {
      var snap2 = auth() && auth().snapshot();
      if (snap2 && snap2.firebaseReady) {
        note.textContent = snap2.firestoreOk
          ? 'Firebase Auth on · Firestore ok · Paystack TEST' + (snap2.verifyReady ? ' · server verify on' : ' · server verify not deployed')
          : ('Firebase Auth on · Firestore offline' + (snap2.lastFsError ? ': ' + String(snap2.lastFsError).slice(0, 60) : '') + ' · using local');
      } else {
        note.textContent = 'Auth SDK not ready · local preview';
      }
    }
    var gateToggle = $('previewGateToggle');
    if (gateToggle) gateToggle.checked = !!(auth() && auth().gatingOn());
    var planToggle = $('previewPlanToggle');
    if (planToggle) planToggle.checked = !!snap.premium;
    bar.hidden = false;
  }

  function showAuth(mode) {
    closeOverlay('accountMenu');
    openOverlay('authModal');
    setAuthMode(mode || 'signin');
    var note = $('authPreviewNote');
    if (note) {
      var snap2 = auth() && auth().snapshot();
      if (snap2 && snap2.firebaseReady) {
        note.textContent = snap2.firestoreOk
          ? 'Firebase Auth on · Firestore ok · Paystack TEST' + (snap2.verifyReady ? ' · server verify on' : ' · server verify not deployed')
          : ('Firebase Auth on · Firestore offline' + (snap2.lastFsError ? ': ' + String(snap2.lastFsError).slice(0, 60) : '') + ' · using local');
      } else {
        note.textContent = 'Auth SDK not ready · local preview';
      }
    }
  }

  function setAuthMode(mode) {
    var signin = $('authSignInPane');
    var create = $('authCreatePane');
    var forgot = $('authForgotPane');
    if (signin) signin.hidden = mode !== 'signin';
    if (create) create.hidden = mode !== 'create';
    if (forgot) forgot.hidden = mode !== 'forgot';
    var title = $('authTitle');
    if (title) {
      title.textContent = mode === 'create' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in';
    }
  }

  function showPremium() {
    closeOverlay('accountMenu');
    openOverlay('premiumScreen');
    payMsg('');
    renderPremium();
    try { if (auth() && auth().loadPaystack) auth().loadPaystack().catch(function () {}); } catch (e) {}
  }

  function showProfile(section) {
    closeOverlay('accountMenu');
    openOverlay('profileScreen');
    renderProfile(section);
  }

  /* ---------- "Why Apex" sourced copy (NGN vs USD) ---------- */
  var WHY_APEX = {
    NGN: {
      sources: [
        ['NBS Selected Food Price Watch, May 2026', 'https://microdata.nigerianstat.gov.ng/index.php/catalog/162'],
        ['FRSC 2025 report (Punch)', 'https://punchng.com/frsc-records-10446-crashes-5289-deaths-in-2025/'],
        ['FRSC Dec 2025 (BusinessDay)', 'https://businessday.ng/transport/article/speeding-remains-nigerias-deadliest-road-habit-frsc/'],
        ['US FHWA, horizontal curve safety', 'https://highways.dot.gov/safety/rwd/keep-vehicles-road/horizontal-curve-safety']
      ],
      lines: [
        ['🍞', 'Apex costs <strong>₦15 a day</strong>, less than a quarter of a loaf of bread.', 1],
        ['🛣️', 'FRSC recorded <strong>5,289 road deaths</strong> in Nigeria in 2025. Apex gives you extra heads-ups before sharp bends.', 2],
        ['⚠️', 'In December 2025, <strong>speeding was behind 41%</strong> of identified crash causes. Apex could help you ease off before the curve.', 3],
        ['🎉', 'Go yearly: <strong>₦3,780</strong> instead of ₦5,400, about <strong>₦10 a day</strong>.', 0],
        ['↪️', 'Crash rates on bends are about <strong>3× higher</strong> than on straight road (US data). That\'s exactly where Apex speaks up.', 4]
      ]
    },
    USD: {
      sources: [
        ['Toast, Sept 2026 (US median coffee $3.79)', 'https://pos.toasttab.com/blog/data/coffee-prices'],
        ['WHO Global Status Report on Road Safety 2023', 'https://www.who.int/news/item/13-12-2023-despite-notable-progress-road-safety-remains-urgent-global-issue'],
        ['US FHWA, horizontal curve safety', 'https://highways.dot.gov/safety/rwd/keep-vehicles-road/horizontal-curve-safety']
      ],
      lines: [
        ['☕', 'A whole month of Apex costs <strong>less than one café coffee</strong>.', 1],
        ['🎉', 'A full year is <strong>$8.40</strong>, about two coffees.', 1],
        ['🌍', 'About <strong>1.19 million people</strong> die on the world\'s roads each year. Apex gives you an extra heads-up on bends.', 2],
        ['↪️', 'More than <strong>25% of fatal US crashes</strong> happen on curves, where crash rates are about 3× higher.', 3],
        ['🧒', 'Road crashes are the <strong>#1 killer of people aged 5–29</strong> worldwide.', 2]
      ]
    }
  };

  function renderWhyApex(cur) {
    var data = WHY_APEX[cur === 'USD' ? 'USD' : 'NGN'];
    var track = $('whyApexTrack');
    var src = $('whyApexSources');
    if (!track || !src) return;
    function link(n, label) {
      var s = data.sources[n - 1];
      return '<a href="' + s[1] + '" target="_blank" rel="noopener" title="' + escapeHtml(s[0]) + '">' + (label || n) + '</a>';
    }
    track.innerHTML = data.lines.map(function (l) {
      return '<div class="why-card" role="listitem"><span class="why-ico" aria-hidden="true">' + l[0] + '</span><span>' + l[1] +
        (l[2] ? '<sup>[' + link(l[2]) + ']</sup>' : '') + '</span></div>';
    }).join('');
    track.scrollLeft = 0;
    src.innerHTML = 'Sources: ' + data.sources.map(function (s, i) {
      return '[' + (i + 1) + '] ' + link(i + 1, escapeHtml(s[0]));
    }).join(' · ');
  }

  function renderPremium() {
    var snap = auth() && auth().snapshot();
    var cur = (auth() && auth().currency()) || 'NGN';
    var ngn = cur === 'NGN';
    renderWhyApex(cur);
    var monthly = $('priceMonthly');
    var yearly = $('priceYearly');
    var ystrike = $('priceYearlyStrike');
    if (monthly) monthly.textContent = ngn ? '₦450 / month' : '$1 / month';
    if (yearly) {
      if (ystrike) {
        ystrike.textContent = ngn ? '₦5,400' : '$12';
        // keep structure: strike + discounted
        yearly.innerHTML = '<span class="price-strike" id="priceYearlyStrike">' + (ngn ? '₦5,400' : '$12') + '</span> ' + (ngn ? '₦3,780 / year' : '$8.40 / year');
      } else {
        yearly.textContent = ngn ? '₦3,780 / year' : '$8.40 / year';
      }
    }
    document.querySelectorAll('[data-currency]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-currency') === cur);
    });
    var status = $('premiumStatusLine');
    if (status && snap) {
      status.textContent = snap.serverPremium === true
        ? 'You are on Apex.'
        : snap.testApex
          ? 'Apex is on for this device as a TEST (test payment ' + snap.testApex.reference + '). Server activation pending.'
          : snap.premium
            ? 'You are on Apex (preview toggle).'
            : snap.signedIn
              ? 'You are on the Free plan.'
              : 'Sign in first to buy Apex, so it is saved to your account.';
    }
  }

  /* ---------- Apex checkout (Paystack TEST mode) ---------- */
  var payBusy = false;
  function payMsg(text, kind) {
    var msg = $('paystackMsg');
    if (!msg) return;
    msg.hidden = !text;
    msg.className = 'pay-msg' + (kind ? ' ' + kind : '');
    msg.innerHTML = text || '';
  }
  function setPayButtonsDisabled(on) {
    document.querySelectorAll('[data-pay-plan]').forEach(function (x) { x.disabled = !!on; });
  }

  function startCheckout(plan, btn) {
    var a = auth();
    if (!a || payBusy) return;
    var snap = a.snapshot();
    if (!snap.signedIn || !(a.getFirebase().auth && a.getFirebase().auth.currentUser)) {
      payMsg('Please sign in first, so your Apex plan is saved to your account. Then tap <strong>Pay with Paystack</strong> again.', 'warn');
      showAuth('signin');
      return;
    }
    payBusy = true;
    setPayButtonsDisabled(true);
    var cur = a.currency();
    payMsg('Opening Paystack secure checkout' + (snap.paystackTestMode ? ' (TEST mode, no real money)' : '') + '…');
    a.startApexCheckout(plan, {
      onOpen: function () {
        payMsg('Paystack checkout is open' + (snap.paystackTestMode ? ' (TEST mode: use a Paystack test card, no real money)' : '') + '.');
      },
      onPaid: function (rec) {
        payMsg('<strong>Payment received — activating Apex…</strong><br>Reference: <code>' + escapeHtml(rec.reference) + '</code>', 'good');
      }
    }).then(function (res) {
      if (res.status === 'cancelled') {
        payMsg('Payment cancelled. You were not charged.');
        return;
      }
      var v = res.verify || {};
      var ref = escapeHtml(res.reference);
      if (v.ok) {
        payMsg('<strong>Apex is active! 🎉</strong> Plan: ' + escapeHtml(v.plan || plan) +
          (v.expiresAt ? ' · Active until ' + escapeHtml(new Date(v.expiresAt).toLocaleDateString()) : '') +
          '<br>Reference: <code>' + ref + '</code>', 'good');
      } else if (v.notConfigured) {
        payMsg('<strong>Test payment succeeded</strong> (reference <code>' + ref + '</code>).<br>' +
          'Apex activation needs the server step, which is not deployed yet. ' +
          'For this preview, Apex is switched on <strong>on this device only, as a TEST</strong>.', 'good');
      } else {
        payMsg('<strong>Payment received</strong> (reference <code>' + ref + '</code>), but we could not activate Apex yet' +
          (v.error ? ': ' + escapeHtml(String(v.error).slice(0, 120)) : '') +
          '.<br>Don\'t pay again. Keep this reference and contact info@adeniyiltd.com. Apex is on for this device as a TEST for now.', 'warn');
      }
      syncAccountButton(auth().snapshot());
      renderPremium();
    }).catch(function (err) {
      var text = escapeHtml((err && err.message) || 'Payment could not start.');
      if (err && err.code === 'not-signed-in') {
        payMsg(text, 'warn');
        showAuth('signin');
        return;
      }
      if (cur === 'USD') {
        text = '<strong>USD payments aren\'t available yet.</strong> Paystack said: ' + text +
          '<br>Please switch to <strong>NGN</strong> and try again. (USD has to be enabled on the Curve Guide Paystack account first.)';
      }
      payMsg(text, 'warn');
    }).then(function () {
      payBusy = false;
      setPayButtonsDisabled(false);
    });
  }

  function fmtDate(v) {
    try {
      var ms = v && typeof v.toMillis === 'function' ? v.toMillis() : (typeof v === 'number' ? v : Date.parse(v));
      return isNaN(ms) ? '' : new Date(ms).toLocaleDateString();
    } catch (e) { return ''; }
  }

  function loadFavsObj() {
    try {
      var raw = localStorage.getItem('curveGuide.favourites');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function saveFavsObj(o) {
    try {
      localStorage.setItem('curveGuide.favourites', JSON.stringify(o));
    } catch (e) {}
    try {
      if (window.__cgAuth && window.__cgAuth.saveFavouritesLocalAndCloud) {
        window.__cgAuth.saveFavouritesLocalAndCloud(o);
      }
    } catch (e3) {}
    document.dispatchEvent(new CustomEvent('cg:favs-changed'));
  }

  function renderProfile(focusSection) {
    var snap = auth() && auth().snapshot();
    var p = loadProfile();
    var user = snap && snap.user;
    var head = $('profileHead');
    if (head) {
      head.innerHTML =
        '<div class="account-avatar lg">' + initials(user) + '</div>' +
        '<div><h2 id="profileTitle">Profile</h2><div class="small">' +
        escapeHtml((user && user.displayName) || 'Not signed in') + '</div><div class="small">' +
        escapeHtml((user && user.email) || '') + '</div>' + badgeHtml(snap || {}) +
        (!(snap && snap.premium)
          ? ' <button type="button" class="btn primary sm" id="profileUpgradeBtn">Upgrade to Apex</button>'
          : '') +
        '</div>';
      var ub = $('profileUpgradeBtn');
      if (ub) ub.onclick = function () { showPremium(); };
    }

    // car icons
    var iconRow = $('carIconRow');
    if (iconRow) {
      iconRow.innerHTML = '';
      Object.keys(CAR_ICONS).forEach(function (key) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'car-icon-opt' + (p.carIcon === key ? ' active' : '');
        b.setAttribute('data-icon', key);
        b.style.color = p.carColor;
        b.innerHTML = CAR_ICONS[key] + '<span>' + key + '</span>';
        b.onclick = function () {
          saveProfile({ carIcon: key });
          applyCarMarker();
          renderProfile('car');
        };
        iconRow.appendChild(b);
      });
    }
    var color = $('carColorPick');
    if (color) {
      color.value = p.carColor;
      color.onchange = function () {
        saveProfile({ carColor: color.value });
        applyCarMarker();
        renderProfile('car');
      };
    }
    var car = p.car || {};
    ['make', 'model', 'year', 'colour', 'plate'].forEach(function (f) {
      var inp = $('carField_' + f);
      if (inp) inp.value = car[f] || '';
    });

    // favs
    var favList = $('profileFavList');
    if (favList) {
      var favs = loadFavsObj();
      favList.innerHTML = '';
      var keys = Object.keys(favs);
      if (!keys.length) {
        favList.innerHTML = '<p class="small">No saved places yet. Save Home / School / Work from the map destination card.</p>';
      } else {
        keys.forEach(function (k) {
          var f = favs[k];
          var row = document.createElement('div');
          row.className = 'profile-fav-row';
          row.innerHTML =
            '<div><strong>' + escapeHtml(k) + '</strong><div class="small">' +
            escapeHtml((f && f.name) || '') + '</div></div>' +
            '<button type="button" class="btn sm danger-outline" data-del-fav="' + escapeHtml(k) + '">Delete</button>';
          favList.appendChild(row);
        });
        favList.querySelectorAll('[data-del-fav]').forEach(function (btn) {
          btn.onclick = function () {
            var o = loadFavsObj();
            delete o[btn.getAttribute('data-del-fav')];
            saveFavsObj(o);
            try { if (window.__cgAuth && window.__cgAuth.saveFavouritesLocalAndCloud) window.__cgAuth.saveFavouritesLocalAndCloud(o); } catch (e) {}
            renderProfile('saved');
            try {
              if (window.__cgApi && typeof window.__cgRefreshFavs === 'function') window.__cgRefreshFavs();
            } catch (e) {}
            document.dispatchEvent(new CustomEvent('cg:favs-changed'));
          };
        });
      }
    }

    // appearance
    document.querySelectorAll('[data-theme-opt]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-theme-opt') === p.theme);
    });
    var unitsBtn = $('profileUnits');
    if (unitsBtn && window.__cgApi) {
      unitsBtn.textContent = 'Units: ' + (window.__cgApi.getUseMph() ? 'mph' : 'km/h');
    }
    var nightBtn = $('profileNight');
    if (nightBtn && window.__cgApi) {
      nightBtn.textContent = window.__cgApi.getNightMode() ? 'Night map: On' : 'Night map: Off';
      nightBtn.classList.toggle('active', !!window.__cgApi.getNightMode());
    }

    // premium section
    var planLine = $('profilePlanLine');
    if (planLine && snap) {
      planLine.innerHTML = snap.premium
        ? (snap.serverPremium === true && snap.serverPremiumInfo && snap.serverPremiumInfo.expiresAt
            ? '<strong>Apex</strong> · ' + escapeHtml(snap.serverPremiumInfo.plan || '') + ' · Active until ' + escapeHtml(fmtDate(snap.serverPremiumInfo.expiresAt)) +
              (snap.serverPremiumInfo.test ? ' <span class="plan-badge free">Paystack test payment</span>' : '') +
              '<br><span class="small">One-time payment: it won\'t renew or charge you again automatically. Pay again any time to add more time.</span>'
            : snap.testApex
              ? '<strong>Apex (TEST)</strong> · test payment <code>' + escapeHtml(snap.testApex.reference) + '</code> · server activation pending'
              : '<strong>Apex</strong> · Renewal date: <em>TBD (preview)</em>')
        : '<strong>Free</strong> · <button type="button" class="btn primary sm" id="profilePlanUpgrade">Upgrade to Apex</button>';
      var pu = $('profilePlanUpgrade');
      if (pu) pu.onclick = function () { showPremium(); };
    }
    var cancelBtn = $('profileCancelPremium');
    if (cancelBtn) {
      // Real (server) Apex is a one-time payment, so there is nothing to cancel here.
      cancelBtn.hidden = !(snap && snap.premium) || snap.serverPremium === true;
    }

    if (focusSection) {
      var sec = document.querySelector('[data-profile-section="' + focusSection + '"]');
      if (sec) sec.scrollIntoView({ block: 'start' });
    }
  }

  function gateOrRun(featureId, fn) {
    var A = auth();
    if (A && A.requiresPremium(featureId)) {
      showPremium();
      var tip = $('premiumGateTip');
      if (tip) {
        tip.hidden = false;
        tip.textContent = '“' + featureId + '” is an Apex feature in this preview demo (gating is on).';
      }
      return;
    }
    if (typeof fn === 'function') fn();
  }

  function bindProGates() {
    document.querySelectorAll('[data-pro-feature]').forEach(function (el) {
      el.addEventListener(
        'click',
        function (e) {
          var A = auth();
          if (!(A && A.requiresPremium(el.getAttribute('data-pro-feature')))) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          showPremium();
          var tip = $('premiumGateTip');
          if (tip) {
            tip.hidden = false;
            tip.textContent = 'This feature is marked APEX while preview gating is on.';
          }
        },
        true
      );
    });
  }

  function setStatusMsg(el, msg, kind) {
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
    el.className = 'auth-msg' + (kind ? ' ' + kind : '');
  }

  function bind() {
    applyTheme();
    // car marker may not exist yet — retry
    applyCarMarker();
    setTimeout(applyCarMarker, 800);
    setTimeout(applyCarMarker, 2000);

    var accountBtn = $('accountBtn');
    if (accountBtn) {
      accountBtn.addEventListener('click', function () {
        var snap = auth() && auth().snapshot();
        if (snap && snap.signedIn) {
          if ($('accountMenu') && $('accountMenu').classList.contains('open')) closeOverlay('accountMenu');
          else {
            syncAccountButton(snap);
            openOverlay('accountMenu');
          }
        } else showAuth('signin');
      });
    }

    document.addEventListener('click', function (e) {
      var menu = $('accountMenu');
      var btn = $('accountBtn');
      if (!menu || !menu.classList.contains('open')) return;
      if (menu.contains(e.target) || (btn && btn.contains(e.target))) return;
      closeOverlay('accountMenu');
    });

    var menu = $('accountMenu');
    if (menu) {
      menu.addEventListener('click', function (e) {
        var t = e.target.closest('[data-acct]');
        if (!t) return;
        var a = t.getAttribute('data-acct');
        if (a === 'profile') showProfile();
        else if (a === 'premium' || a === 'upgrade') showPremium();
        else if (a === 'signout') {
          auth().signOut().then(function () {
            closeAllOverlays();
            syncAccountButton(auth().snapshot());
          });
        }
      });
    }

    // Auth form actions
    var google = $('authGoogleBtn');
    if (google)
      google.onclick = function () {
        auth()
          .signInWithGoogle()
          .then(function () {
            closeOverlay('authModal');
            syncAccountButton(auth().snapshot());
            showProfile();
          })
          .catch(function (err) {
            setStatusMsg($('authMsg'), err.message || String(err), 'warn');
          });
      };

    var signInBtn = $('authEmailBtn');
    if (signInBtn)
      signInBtn.onclick = function () {
        auth()
          .signInWithEmail($('authEmail').value, $('authPassword').value)
          .then(function () {
            closeOverlay('authModal');
            syncAccountButton(auth().snapshot());
            showProfile();
          })
          .catch(function (err) {
            setStatusMsg($('authMsg'), err.message || String(err), 'warn');
          });
      };

    var createBtn = $('authCreateBtn');
    if (createBtn)
      createBtn.onclick = function () {
        auth()
          .createAccount($('authCreateEmail').value, $('authCreatePassword').value, $('authCreateName').value)
          .then(function () {
            closeOverlay('authModal');
            syncAccountButton(auth().snapshot());
            showProfile();
          })
          .catch(function (err) {
            setStatusMsg($('authMsg'), err.message || String(err), 'warn');
          });
      };

    var forgotBtn = $('authForgotBtn');
    if (forgotBtn)
      forgotBtn.onclick = function () {
        auth()
          .sendPasswordReset($('authForgotEmail').value)
          .then(function (r) {
            setStatusMsg($('authMsg'), (r && r.message) || 'Check your email (when Firebase is connected).', 'good');
          })
          .catch(function (err) {
            setStatusMsg($('authMsg'), err.message || String(err), 'warn');
          });
      };

    var guest = $('authGuestBtn');
    if (guest)
      guest.onclick = function () {
        auth().continueWithoutAccount().then(function () {
          closeOverlay('authModal');
          syncAccountButton(auth().snapshot());
        });
      };

    document.querySelectorAll('[data-auth-mode]').forEach(function (b) {
      b.onclick = function () {
        setAuthMode(b.getAttribute('data-auth-mode'));
        setStatusMsg($('authMsg'), '', '');
      };
    });

    document.querySelectorAll('[data-close-overlay]').forEach(function (b) {
      b.onclick = function () {
        closeOverlay(b.getAttribute('data-close-overlay'));
      };
    });

    // Apex plans
    document.querySelectorAll('[data-currency]').forEach(function (b) {
      b.onclick = function () {
        auth().setCurrency(b.getAttribute('data-currency'));
        renderPremium();
      };
    });
    document.querySelectorAll('[data-pay-plan]').forEach(function (b) {
      b.onclick = function () { startCheckout(b.getAttribute('data-pay-plan'), b); };
    });

    // Profile saves
    var saveCar = $('saveCarDetails');
    if (saveCar)
      saveCar.onclick = function () {
        saveProfile({
          car: {
            make: $('carField_make').value,
            model: $('carField_model').value,
            year: $('carField_year').value,
            colour: $('carField_colour').value,
            plate: $('carField_plate').value
          }
        });
        var m = $('carSaveMsg');
        if (m) {
          m.hidden = false;
          m.textContent = 'Saved on this device (preview).';
        }
      };

    document.querySelectorAll('[data-theme-opt]').forEach(function (b) {
      b.onclick = function () {
        saveProfile({ theme: b.getAttribute('data-theme-opt') });
        applyTheme();
        renderProfile('appearance');
      };
    });

    var profileUnits = $('profileUnits');
    if (profileUnits)
      profileUnits.onclick = function () {
        if (!window.__cgApi) return;
        window.__cgApi.setUnitsMph(!window.__cgApi.getUseMph());
        renderProfile('appearance');
      };
    var profileNight = $('profileNight');
    if (profileNight)
      profileNight.onclick = function () {
        if (!window.__cgApi) return;
        window.__cgApi.setNightMode(!window.__cgApi.getNightMode());
        renderProfile('appearance');
      };

    var cancelPrem = $('profileCancelPremium');
    if (cancelPrem)
      cancelPrem.onclick = function () {
        if (!confirm('Turn off Apex on this device? (Preview / TEST only. This does not refund or cancel anything on Paystack.)')) return;
        auth().setPlanLocal('free');
        syncAccountButton(auth().snapshot());
        renderProfile('premium');
      };

    var feedback = $('sendFeedbackBtn');
    if (feedback)
      feedback.onclick = function () {
        var cat = ($('feedbackCat') && $('feedbackCat').value) || 'General';
        var msg = ($('feedbackMsg') && $('feedbackMsg').value) || '';
        if (!msg.trim()) {
          alert('Please enter a message.');
          return;
        }
        var sub = encodeURIComponent('Curve Guide feedback — ' + cat);
        var body = encodeURIComponent('Category: ' + cat + '\n\n' + msg + '\n\n— Sent from Curve Guide preview');
        window.location.href = 'mailto:info@adeniyiltd.com?subject=' + sub + '&body=' + body;
      };

    var clearData = $('clearLocalDataBtn');
    if (clearData)
      clearData.onclick = function () {
        if (!confirm('Clear local Curve Guide data on this device? You will stay on this page.')) return;
        try {
          Object.keys(localStorage).forEach(function (k) {
            if (k.indexOf('curveGuide') === 0) localStorage.removeItem(k);
          });
        } catch (e) {}
        location.reload();
      };

    var signOutProfile = $('profileSignOut');
    if (signOutProfile)
      signOutProfile.onclick = function () {
        auth().signOut().then(function () {
          closeAllOverlays();
          syncAccountButton(auth().snapshot());
        });
      };

    var delAcc = $('deleteAccountBtn');
    if (delAcc)
      delAcc.onclick = function () {
        if (!confirm('Delete your Curve Guide account? This cannot be undone.')) return;
        var typed = prompt('Type DELETE to confirm');
        if (typed !== 'DELETE') {
          alert('Cancelled — you must type DELETE.');
          return;
        }
        var A = auth();
        var fin = function () {
          closeAllOverlays();
          syncAccountButton(A.snapshot());
          alert('Account deleted.');
        };
        if (A && A.deleteAccount) {
          A.deleteAccount().then(fin).catch(function (err) {
            var msg = (err && err.message) || String(err);
            if (err && err.code === 'auth/requires-recent-login') {
              alert('For security, sign in again, then delete the account. (' + msg + ')');
              return;
            }
            alert('Could not delete account: ' + msg);
          });
        } else {
          A.signOut().then(fin);
        }
      };

    // Preview bar
    var gateToggle = $('previewGateToggle');
    if (gateToggle)
      gateToggle.onchange = function () {
        auth().setGating(gateToggle.checked);
        syncAccountButton(auth().snapshot());
      };
    var planToggle = $('previewPlanToggle');
    if (planToggle)
      planToggle.onchange = function () {
        auth().setPlanLocal(planToggle.checked ? 'premium' : 'free');
        if (planToggle.checked && !auth().currentUser()) {
          auth().signInWithGoogle();
        }
        syncAccountButton(auth().snapshot());
      };

    // Fav refresh hook used by main app if present
    document.addEventListener('cg:favs-changed', function () {
      try {
        var row = document.getElementById('favRow');
        if (row && window.__cgApi) {
          // trigger re-render by calling internal if exposed
        }
      } catch (e) {}
    });

    if (auth()) {
      auth().onChange(function (snap) {
        syncAccountButton(snap);
      });
      syncAccountButton(auth().snapshot());
    }

    bindProGates();

    // Expose for Niyi / tests
    window.__cgPremiumUI = {
      showAuth: showAuth,
      showPremium: showPremium,
      showProfile: showProfile,
      applyCarMarker: applyCarMarker,
      applyTheme: applyTheme,
      loadProfile: loadProfile,
      saveProfile: saveProfile,
      gateOrRun: gateOrRun,
      CAR_ICONS: CAR_ICONS
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
