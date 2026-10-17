/* Curve Guide Apex / Auth / Profile UI (7.1)
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

  // 7.2.5 app colour themes. Safety colours (danger red, bend/warning orange, emergency) never change.
  var ACCENTS = {
    green: { label: 'Curve Green', sw: '#20c477' },
    blue: { label: 'Ocean Blue', sw: '#3b8cff' },
    purple: { label: 'Royal Purple', sw: '#9b6bff' },
    orange: { label: 'Sunset Orange', sw: '#ff8a3d' },
    pink: { label: 'Rose Pink', sw: '#ff5fa2' },
    gold: { label: 'Gold', sw: '#f2c230' },
    red: { label: 'Cherry Red', sw: '#e5484d' }
  };

  function $(id) { return document.getElementById(id); }
  function auth() { return window.__cgAuth || null; }

  function defaultProfile() {
    return {
      carIcon: 'sedan',
      carColor: '#20c477',
      car: { make: '', model: '', year: '', colour: '', plate: '' },
      theme: 'dark', // dark | light | auto
      accent: 'green', // 7.2.5 app colour (free): see ACCENTS
      sosContacts: [], // 8.0: [{name, phone}] up to 5
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
        theme: /^(dark|light|auto)$/.test(o.theme) ? o.theme : 'dark',
        accent: ACCENTS[o.accent] ? o.accent : 'green',
        sosContacts: Array.isArray(o.sosContacts) ? o.sosContacts.filter(function (c) { return c && c.phone; }).slice(0, 5) : []
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
    if (partial.accent != null && ACCENTS[partial.accent]) cur.accent = partial.accent;
    if (Array.isArray(partial.sosContacts)) cur.sosContacts = partial.sosContacts.slice(0, 5);
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
    var acc = ACCENTS[p.accent] ? p.accent : 'green';
    if (document.body.getAttribute('data-accent') !== acc) {
      if (acc === 'green') document.body.removeAttribute('data-accent');
      else document.body.setAttribute('data-accent', acc);
      try {
        var tc = document.querySelector('meta[name="theme-color"]');
        if (tc && mode !== 'light') tc.setAttribute('content', '#0d1114');
      } catch (e) {}
      document.dispatchEvent(new CustomEvent('cg:accent-changed', { detail: { accent: acc } }));
    }
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

  /* 7.2.5 micro-animations helpers */
  function reducedMotion() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function stagger(el) {
    if (!el || reducedMotion()) return;
    el.classList.remove('cg-stagger'); void el.offsetWidth; el.classList.add('cg-stagger');
    clearTimeout(el._cgStag); el._cgStag = setTimeout(function () { el.classList.remove('cg-stagger'); }, 650);
  }
  function openOverlay(id) {
    var el = $(id);
    if (!el) return;
    if (el._cgCloseT) { clearTimeout(el._cgCloseT); el._cgCloseT = null; }
    el.classList.remove('cg-closing');
    var wasOpen = el.classList.contains('open');
    el.hidden = false;
    el.classList.add('open');
    document.body.classList.add('cg-overlay-open');
    if (!wasOpen && el.classList.contains('cg-overlay')) stagger(el.querySelector('.cg-sheet'));
  }
  function closeOverlay(id) {
    var el = $(id);
    if (!el) return;
    var wasOpen = el.classList.contains('open');
    el.classList.remove('open');
    el.hidden = true; // state changes at once; the fade-out below is visual only (pointer-events off)
    if (wasOpen && !reducedMotion()) {
      el.classList.add('cg-closing');
      clearTimeout(el._cgCloseT);
      el._cgCloseT = setTimeout(function () { el.classList.remove('cg-closing'); el._cgCloseT = null; }, 180);
    }
    if (!document.querySelector('.cg-overlay.open')) document.body.classList.remove('cg-overlay-open');
  }
  function closeAllOverlays() {
    ['authModal', 'premiumScreen', 'profileScreen', 'accountMenu'].forEach(closeOverlay);
  }

  function celebrateApex(label) {
    try {
      var driving = typeof window.__cgIsDriving === 'function' && window.__cgIsDriving();
      var t = document.createElement('div');
      t.className = 'cg-toast'; t.setAttribute('role', 'status');
      t.textContent = '✨ ' + (label || 'Apex') + ' is active';
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 2700);
      if (driving || reducedMotion()) return; // never distract while driving
      var box = document.createElement('div');
      box.className = 'cg-confetti'; box.setAttribute('aria-hidden', 'true');
      var cs = getComputedStyle(document.body);
      var cols = [cs.getPropertyValue('--acc').trim() || '#20c477', cs.getPropertyValue('--acc-hi').trim() || '#27d083', '#f2c230', '#ffffff', cs.getPropertyValue('--acc-text').trim() || '#9be3bf'];
      for (var i = 0; i < 36; i++) {
        var c = document.createElement('i');
        var ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 260;
        c.style.setProperty('--x', Math.round(Math.cos(ang) * dist) + 'px');
        c.style.setProperty('--y', Math.round(Math.sin(ang) * dist * 0.8 + 90) + 'px');
        c.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
        c.style.setProperty('--d', (0.75 + Math.random() * 0.35).toFixed(2) + 's');
        c.style.background = cols[i % cols.length];
        if (i % 3 === 0) { c.style.borderRadius = '50%'; c.style.width = c.style.height = '7px'; }
        box.appendChild(c);
      }
      document.body.appendChild(box);
      setTimeout(function () { box.remove(); }, 1300);
    } catch (e) {}
  }
  // Celebrate once per plan/expiry per account (new payment, renewal, or a granted plan).
  var CELEBRATED_KEY = 'curveGuide.apexCelebrated';
  function maybeCelebrate(snap) {
    if (!snap || !snap.premium || !snap.user || snap.serverPremium !== true) return;
    var info = snap.serverPremiumInfo || {};
    var key = snap.user.uid + '|' + (info.plan || '') + '|' + (info.expiresAt || '');
    var seen = null;
    try { seen = localStorage.getItem(CELEBRATED_KEY); } catch (e) {}
    if (seen === key) return;
    try { localStorage.setItem(CELEBRATED_KEY, key); } catch (e) {}
    celebrateApex((apexInfo(snap) || {}).label);
  }

  // 7.2.5: one place that describes the user's Apex plan (creator / monthly / yearly).
  function apexInfo(snap) {
    snap = snap || (auth() && auth().snapshot()) || {};
    if (!snap.premium) return null;
    var info = snap.serverPremiumInfo || {};
    var plan = String(info.plan || '').toLowerCase();
    var ms = toMs(info.expiresAt);
    var never = plan === 'creator' || (!isNaN(ms) && new Date(ms).getUTCFullYear() >= 2090) || (info.active === true && !info.expiresAt);
    var name = plan === 'creator' ? 'Creator' : plan === 'yearly' ? 'Yearly' : plan === 'monthly' ? 'Monthly' : (plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : '');
    var until = never ? 'never expires' : (!isNaN(ms) ? 'Active until ' + new Date(ms).toLocaleDateString() : '');
    return {
      plan: plan, name: name, never: never, until: until, test: !!info.test, creator: plan === 'creator',
      label: 'Apex' + (name ? ' — ' + name : '') + (never ? ' (never expires)' : ''),
      line: 'Apex' + (name ? ' — ' + name : '') + (never ? ' (never expires)' : (until ? ' · ' + until : ''))
    };
  }
  function toMs(v) {
    try {
      return v && typeof v.toMillis === 'function' ? v.toMillis() : (typeof v === 'number' ? v : (v ? Date.parse(v) : NaN));
    } catch (e) { return NaN; }
  }

  function badgeHtml(snap) {
    if (!snap.signedIn) return '<span class="plan-badge free">Guest</span>';
    if (snap.premium) { var ai = apexInfo(snap); return '<span class="plan-badge premium">' + escapeHtml(ai && ai.creator ? 'Apex · Creator' : 'Apex') + '</span>'; }
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
    // Only touch the button's inner HTML when it really changes. Rewriting it during a tap
    // detached the tapped <span>, so the "click outside closes the menu" handler closed the
    // menu instantly (7.2.4 fix: account button "shows nothing" on iPad/iPhone).
    function setBtnHtml(html) { if (btn.getAttribute('data-html') !== html) { btn.innerHTML = html; btn.setAttribute('data-html', html); } }
    if (snap.signedIn && snap.user) {
      btn.classList.add('signed-in');
      setBtnHtml('<span class="account-avatar" aria-hidden="true">' + initials(snap.user) + '</span>');
      btn.title = snap.user.displayName || snap.user.email || 'Account';
      btn.setAttribute('aria-label', 'Account menu');
    } else {
      btn.classList.remove('signed-in');
      setBtnHtml('<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>');
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
            ? '<button type="button" class="btn" data-acct="premium">✨ ' + escapeHtml((apexInfo(snap) || {}).line || 'Apex') + '</button>'
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
    if (!bar) return; // removed in production 7.1
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
    if (note) note.hidden = true;
    var sn = auth() && auth().snapshot();
    if (sn && sn.redirectFailed && !sn.signedIn) {
      setStatusMsg($('authMsg'), 'Google sign-in didn\'t finish last time. Tap Continue with Google again (a Google window opens), or use email and password.', 'warn');
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
    var gt = $('premiumGateTip'); if (gt) gt.hidden = true;
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
        ['Yello.ng: Agege bread (medium) ₦700, checked Oct 2026', 'https://yello.ng/product/agege-bread-medium/'],
        ['FRSC 2025 report (Punch)', 'https://punchng.com/frsc-records-10446-crashes-5289-deaths-in-2025/'],
        ['FRSC Dec 2025 (BusinessDay)', 'https://businessday.ng/transport/article/speeding-remains-nigerias-deadliest-road-habit-frsc/'],
        ['US FHWA, horizontal curve safety', 'https://highways.dot.gov/safety/rwd/keep-vehicles-road/horizontal-curve-safety']
      ],
      lines: [
        ['🍞', 'Apex costs <strong>₦450 a month</strong> (about ₦15 a day), less than one medium Agege bread.', 1],
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
    var data = WHY_APEX[cur === 'USD' && auth() && auth().snapshot().usdEnabled ? 'USD' : 'NGN'];
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

  // Hide every pay call-to-action for Apex users and show their plan instead.
  function setApexMode(snap) {
    var sheet = $('premiumScreen');
    if (!sheet) return false;
    var ai = apexInfo(snap);
    sheet.classList.toggle('is-apex', !!ai);
    var box = $('premiumActiveBox');
    if (box) {
      box.hidden = !ai;
      if (ai) {
        box.innerHTML = '<strong>✅ You\'re on ' + escapeHtml(ai.label) + '</strong>' +
          (ai.never ? '' : (ai.until ? '<br><span class="small">' + escapeHtml(ai.until) + '. One-time payment, nothing renews automatically.</span>' : '')) +
          (ai.test ? ' <span class="plan-badge free">Paystack test payment</span>' : '') +
          '<br><span class="small">Everything in Apex is unlocked: spoken voice navigation, bends-ahead list with safe-speed tips, favourites and danger reports synced across your phones, and smart Niyi.</span>';
      }
    }
    var title = $('premiumTitle');
    if (title) title.textContent = ai ? 'Your Apex plan' : 'Curve Guide Apex';
    return !!ai;
  }

  function renderPremium() {
    var snap = auth() && auth().snapshot();
    if (setApexMode(snap)) {
      var st = $('premiumStatusLine');
      if (st) st.textContent = (apexInfo(snap) || {}).line || 'You are on Apex.';
      return;
    }
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
        : snap.pendingPayment
          ? 'Payment received (reference ' + snap.pendingPayment.reference + '). Activating Apex…'
          : snap.signedIn
            ? 'You are on the Free plan.'
            : 'Sign in first to buy Apex, so it is saved to your account.';
    }
  }

  /* ---------- Apex checkout (Paystack) ---------- */
  var SUPPORT_HTML = 'WhatsApp <a class="contact" href="https://wa.me/2348053529802" target="_blank" rel="noopener">+234 805 352 9802</a> or email ' +
    '<a class="contact" href="mailto:info@adeniyiltd.com">info@adeniyiltd.com</a>';
  function activationFailedHtml(ref, err) {
    return '<strong>Payment received, but Apex could not be activated yet.</strong>' +
      (err ? ' (' + escapeHtml(String(err).slice(0, 120)) + ')' : '') +
      '<br>Please <strong>don\'t pay again</strong>. Your Paystack reference is <code>' + escapeHtml(ref) + '</code>. ' +
      'We\'ll retry automatically next time you open Curve Guide, or tap <button type="button" class="btn sm" id="retryActivateBtn">Try again</button>' +
      '<br>Still stuck? Send the reference to ' + SUPPORT_HTML + '.';
  }
  function bindRetryButton(ref) {
    var rb = $('retryActivateBtn');
    if (!rb) return;
    rb.onclick = function () {
      rb.disabled = true;
      payMsg('Checking your payment with Paystack… Reference: <code>' + escapeHtml(ref) + '</code>', 'good');
      auth().verifyPayment(ref).then(function (v) {
        if (v && v.ok) {
          payMsg('<strong>Apex is active! 🎉</strong>' + (v.expiresAt ? ' Active until ' + escapeHtml(new Date(v.expiresAt).toLocaleDateString()) : ''), 'good');
        } else {
          payMsg(activationFailedHtml(ref, v && v.error), 'warn');
          bindRetryButton(ref);
        }
        syncAccountButton(auth().snapshot());
        renderPremium();
      }).catch(function (e) {
        payMsg(activationFailedHtml(ref, e && e.message), 'warn');
        bindRetryButton(ref);
      });
    };
  }
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
    payMsg('Opening Paystack secure checkout' + (snap.paystackTestMode ? ' (test mode)' : '') + '…');
    a.startApexCheckout(plan, {
      onOpen: function () {
        payMsg('Paystack secure checkout is open' + (snap.paystackTestMode ? ' (test mode)' : '') + '.');
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
      } else {
        payMsg(activationFailedHtml(res.reference, v.error), 'warn');
        bindRetryButton(res.reference);
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
          '<br>Please pay in <strong>NGN</strong> instead.';
      } else {
        text = '<strong>Payment could not start.</strong> ' + text + '<br>You were not charged. Please try again, or contact ' + SUPPORT_HTML + '.';
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
    bindSos(); renderSos();
    var car = p.car || {};
    setupCarPickers(car);
    ['make', 'model', 'year', 'colour', 'plate'].forEach(function (f) {
      var inp = $('carField_' + f);
      if (inp) inp.value = car[f] || '';
    });
    fillModels(car.make || '');

    // favs
    var favList = $('profileFavList');
    if (favList) {
      var favs = loadFavsObj();
      favList.innerHTML = '';
      var keys = Object.keys(favs);
      if (!keys.length) {
        favList.innerHTML = '<p class="small">No saved places yet. Save Home / School / Work from the map destination card.</p>';
      }
      var syncNote = document.createElement('p');
      syncNote.className = 'small';
      syncNote.style.marginTop = '6px';
      syncNote.innerHTML = (snap && snap.premium)
        ? '☁️ Apex: your favourites and danger reports sync across your phones when you sign in.'
        : '📱 Saved on this phone. <button type="button" class="btn sm" id="profileSyncUpgrade">Sync across phones with Apex</button>';
      favList.appendChild(syncNote);
      var su = $('profileSyncUpgrade');
      if (su) su.onclick = function () { apexPrompt('cloud sync'); };
      if (!keys.length) {
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
    var accBox = $('accentOpts');
    if (accBox) {
      accBox.innerHTML = '';
      Object.keys(ACCENTS).forEach(function (k) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'accent-opt' + (p.accent === k ? ' active' : '');
        b.setAttribute('data-accent-opt', k);
        b.setAttribute('aria-pressed', p.accent === k ? 'true' : 'false');
        b.innerHTML = '<span class="sw" style="background:' + ACCENTS[k].sw + '"></span>' + escapeHtml(ACCENTS[k].label);
        b.onclick = function () {
          saveProfile({ accent: k });
          applyTheme();
          renderProfile('appearance');
        };
        accBox.appendChild(b);
      });
    }
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
      var pai = apexInfo(snap);
      planLine.innerHTML = pai
        ? ('<strong>' + escapeHtml(pai.line) + '</strong>' +
            (pai.test ? ' <span class="plan-badge free">Paystack test payment</span>' : '') +
            (pai.never ? '<br><span class="small">All Apex features are unlocked on this account.</span>'
              : '<br><span class="small">One-time payment: it won\'t renew or charge you again automatically.</span>'))
        : (snap.pendingPayment
            ? '<strong>Free</strong> · payment <code>' + escapeHtml(snap.pendingPayment.reference) + '</code> is being activated. If Apex doesn\'t appear soon, contact ' + SUPPORT_HTML + '.'
            : '<strong>Free</strong> · <button type="button" class="btn primary sm" id="profilePlanUpgrade">Upgrade to Apex</button>');
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

  /* ---------- 7.2.5 Car make / model / year pickers ----------
     Bundled list (vehicles.js) works offline; online, models are topped up from the free NHTSA vPIC API
     (US government public-domain data) and cached on this phone for 30 days. Free text always allowed. */
  var OTHER = 'Other — type it';
  var VPIC_CACHE_KEY = 'curveGuide.vpicModels';
  function vehicles() { return window.CG_VEHICLES || {}; }
  function findMake(name) {
    var v = vehicles(), n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    for (var k in v) { if (k.toLowerCase() === n || k.toLowerCase().replace(/\s*\(.*\)$/, '') === n) return k; }
    return null;
  }
  function setOptions(dl, list) {
    if (!dl) return;
    dl.innerHTML = '';
    list.forEach(function (x) { var o = document.createElement('option'); o.value = x; dl.appendChild(o); });
  }
  var carPickersBound = false;
  function setupCarPickers(car) {
    var v = vehicles();
    var makes = Object.keys(v).sort(function (a, b) { return a.localeCompare(b); });
    setOptions($('carMakeList'), makes.concat([OTHER]));
    var ys = $('carField_year');
    if (ys) {
      var next = new Date().getFullYear() + 1, html = '<option value="">Year</option>';
      for (var y = next; y >= 1980; y--) html += '<option value="' + y + '">' + y + '</option>';
      html += '<option value="Before 1980">Before 1980</option>';
      var cy = String(car.year || '').trim();
      if (cy && !/^(19[89]\d|20\d\d|Before 1980)$/.test(cy)) html += '<option value="' + escapeHtml(cy) + '">' + escapeHtml(cy) + '</option>'; // keep older saved text
      ys.innerHTML = html;
    }
    if (carPickersBound) return;
    carPickersBound = true;
    var mk = $('carField_make'), md = $('carField_model');
    if (mk) mk.addEventListener('input', function () {
      if (mk.value === OTHER) { mk.value = ''; mk.placeholder = 'Type the make'; return; }
      var known = findMake(mk.value);
      if (known && known !== mk.value && mk.value.toLowerCase() === known.toLowerCase()) mk.value = known;
      fillModels(mk.value);
    });
    if (md) md.addEventListener('input', function () {
      if (md.value === OTHER) { md.value = ''; md.placeholder = 'Type the model'; }
    });
  }
  function readVpicCache() { try { return JSON.parse(localStorage.getItem(VPIC_CACHE_KEY) || '{}') || {}; } catch (e) { return {}; } }
  var modelTimer = null, modelReq = 0;
  function fillModels(makeName) {
    var dl = $('carModelList');
    if (!dl) return;
    var known = findMake(makeName);
    var base = known ? vehicles()[known].models.slice() : [];
    var key = String(known || makeName || '').trim().toLowerCase().replace(/\s*\(.*\)$/, '');
    var cache = readVpicCache(), hit = cache[key];
    function show(extra) {
      var seen = {}, list = [];
      base.concat(extra || []).forEach(function (m) {
        var t = String(m || '').trim(); var k = t.toLowerCase();
        if (t && !seen[k]) { seen[k] = 1; list.push(t); }
      });
      list.sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
      setOptions(dl, list.concat([OTHER]));
    }
    show(hit && hit.list);
    clearTimeout(modelTimer);
    if (!key || key.length < 2 || (hit && Date.now() - hit.t < 30 * 864e5) || navigator.onLine === false) return;
    if (!known && key.length < 3) return;
    var my = ++modelReq;
    modelTimer = setTimeout(function () {
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var to = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);
      var q = key.replace(/ motorcycles?$| buses$/, '');
      fetch('https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/' + encodeURIComponent(q) + '?format=json', { signal: ctl ? ctl.signal : undefined })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          clearTimeout(to);
          if (!d || !Array.isArray(d.Results)) return;
          var list = d.Results.map(function (x) { return x.Model_Name; }).filter(Boolean).slice(0, 300);
          var c = readVpicCache(); c[key] = { t: Date.now(), list: list };
          var ks = Object.keys(c); if (ks.length > 40) ks.sort(function (a, b) { return c[a].t - c[b].t; }).slice(0, ks.length - 40).forEach(function (k) { delete c[k]; });
          try { localStorage.setItem(VPIC_CACHE_KEY, JSON.stringify(c)); } catch (e) {}
          if (my === modelReq) show(list);
        }).catch(function () { clearTimeout(to); });
    }, 450);
  }

  /* ---------- 8.0 SOS emergency contacts ---------- */
  // Nigerian numbers: 0803 123 4567 / 803 123 4567 / 234803... -> +2348031234567. Other countries: +<8-15 digits>.
  function normalizePhone(raw) {
    var s = String(raw || '').trim();
    var plus = /^\+/.test(s) || /^00/.test(s);
    var d = s.replace(/\D/g, '');
    if (/^00/.test(s)) d = d.slice(2);
    if (!plus) {
      if (/^0[789]\d{9}$/.test(d) || /^0[1-9]\d{7,9}$/.test(d)) d = '234' + d.slice(1);
      else if (/^[789]\d{9}$/.test(d)) d = '234' + d;
      else if (!/^234\d{10}$/.test(d)) return null;
    }
    if (/^234/.test(d)) { if (!/^234[1-9]\d{7,9}$/.test(d)) return null; }
    else if (!/^[1-9]\d{7,14}$/.test(d)) return null;
    return '+' + d;
  }
  function prettyPhone(e164) {
    var m = String(e164).match(/^\+234(\d{3})(\d{3})(\d{4})$/);
    return m ? '+234 ' + m[1] + ' ' + m[2] + ' ' + m[3] : e164;
  }
  function renderSos() {
    var box = $('sosContactList');
    if (!box) return;
    var list = loadProfile().sosContacts || [];
    box.innerHTML = list.length ? '' : '<p class="small">No emergency contacts yet.</p>';
    list.forEach(function (c, i) {
      var row = document.createElement('div');
      row.className = 'sos-item';
      row.innerHTML = '<div><strong>' + escapeHtml(c.name || 'Contact') + '</strong><span class="small">' + escapeHtml(prettyPhone(c.phone)) + '</span></div>' +
        '<button type="button" class="btn sm danger-outline" aria-label="Remove ' + escapeHtml(c.name || 'contact') + '">Remove</button>';
      row.querySelector('button').onclick = function () {
        var l = (loadProfile().sosContacts || []).slice(); l.splice(i, 1);
        saveProfile({ sosContacts: l }); renderSos(); document.dispatchEvent(new CustomEvent('cg:sos-changed'));
      };
      box.appendChild(row);
    });
    var add = $('sosAddRow'), ab = $('sosAddBtn');
    if (add) add.hidden = list.length >= 5;
    if (ab) { ab.hidden = list.length >= 5; }
  }
  function bindSos() {
    var ab = $('sosAddBtn');
    if (!ab || ab._bound) return;
    ab._bound = true;
    ab.onclick = function () {
      var nm = ($('sosName').value || '').trim().slice(0, 40), ph = normalizePhone($('sosPhone').value);
      var msg = $('sosMsg');
      if (!nm) { setStatusMsg(msg, 'Please enter a name.', 'warn'); return; }
      if (!ph) { setStatusMsg(msg, 'That phone number doesn\'t look right. Use e.g. 0803 123 4567, or +44 7700 900123 for other countries.', 'warn'); return; }
      var l = (loadProfile().sosContacts || []).slice();
      if (l.some(function (c) { return c.phone === ph; })) { setStatusMsg(msg, 'That number is already saved.', 'warn'); return; }
      if (l.length >= 5) { setStatusMsg(msg, 'You can save up to 5 contacts.', 'warn'); return; }
      l.push({ name: nm, phone: ph });
      saveProfile({ sosContacts: l });
      $('sosName').value = ''; $('sosPhone').value = '';
      setStatusMsg(msg, 'Saved ' + nm + ' (' + prettyPhone(ph) + ').', 'good');
      renderSos(); document.dispatchEvent(new CustomEvent('cg:sos-changed'));
    };
  }

  var FEATURE_TIPS = {
    'voice navigation': 'Spoken turn-by-turn directions are part of Apex. Navigation with the on-screen banner stays free.',
    'bend alerts': 'The list of bends ahead, suggested safe speeds and spoken bend warnings are part of Apex. The basic on-screen curve alert stays free for everyone.',
    'niyi': 'You\'ve used today\'s free Niyi messages. Apex gives you unlimited smart Niyi.',
    'cloud sync': 'Saving favourites and danger reports across all your phones is part of Apex. They still save on this phone for free.'
  };
  function apexPrompt(featureId, customMsg) {
    var sn = auth() && auth().snapshot();
    if (sn && sn.premium) {
      // Apex already: no pay screen. (A stale "locked" button can still be on screen for a moment.)
      showPremium();
      var t2 = $('premiumGateTip');
      if (t2) { t2.hidden = false; t2.className = 'auth-msg good'; t2.textContent = '✅ This is included in your Apex plan, so it\'s unlocked.'; }
      document.dispatchEvent(new CustomEvent('cg:premium-changed', { detail: sn }));
      return;
    }
    showPremium();
    var tip = $('premiumGateTip');
    if (tip) {
      tip.hidden = false;
      tip.className = 'auth-msg';
      tip.textContent = '✨ Upgrade to Apex: ' + (customMsg || FEATURE_TIPS[featureId] || 'this is an Apex feature.');
    }
  }
  function gateOrRun(featureId, fn) {
    var A = auth();
    if (A && A.requiresPremium(featureId)) { apexPrompt(featureId); return; }
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
          apexPrompt(el.getAttribute('data-pro-feature'));
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
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(menu) >= 0 || (btn && path.indexOf(btn) >= 0)) return;
      if (menu.contains(e.target) || (btn && btn.contains(e.target))) return;
      if (e.target && e.target.isConnected === false) return; // element was re-rendered mid-tap
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
          m.textContent = 'Saved.';
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
        var body = encodeURIComponent('Category: ' + cat + '\n\n' + msg + '\n\n— Sent from Curve Guide 8.0');
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
      var lastPrem = null;
      auth().onChange(function (snap) {
        snap = (auth() && auth().snapshot()) || snap;
        syncAccountButton(snap);
        var key = String(!!snap.premium) + '|' + JSON.stringify((apexInfo(snap) || {}).line || '');
        if (key !== lastPrem) {
          lastPrem = key;
          var ps = $('premiumScreen'), pr = $('profileScreen');
          if (ps && ps.classList.contains('open')) renderPremium();
          if (pr && pr.classList.contains('open')) renderProfile();
          document.dispatchEvent(new CustomEvent('cg:premium-changed', { detail: snap }));
          maybeCelebrate(snap);
        }
      });
      syncAccountButton(auth().snapshot());
    }

    bindProGates();

    // Ripple on tap (accent colour). Passive and never blocks the click.
    document.addEventListener('pointerdown', function (e) {
      if (reducedMotion()) return;
      var b = e.target && e.target.closest && e.target.closest('.btn,.niyi-chip,.niyi-action,.accent-opt,.niyi-send,.niyi-header-btn,.icon-btn');
      if (!b || b.disabled || b.closest('.nav-banner,.emerg-sheet,.emerg-fab')) return;
      try {
        if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
        var r = b.getBoundingClientRect();
        var wrap = document.createElement('span'); wrap.className = 'cg-ripple-wrap';
        var dot = document.createElement('span'); dot.className = 'cg-ripple';
        dot.style.left = (e.clientX - r.left) + 'px'; dot.style.top = (e.clientY - r.top) + 'px';
        dot.style.setProperty('--cg-rs', String(Math.ceil(Math.max(r.width, r.height) / 6)));
        wrap.appendChild(dot); b.appendChild(wrap);
        setTimeout(function () { wrap.remove(); }, 360);
      } catch (err) {}
    }, { passive: true });

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
      apexPrompt: apexPrompt,
      apexInfo: apexInfo,
      celebrateApex: celebrateApex,
      normalizePhone: normalizePhone,
      ACCENTS: ACCENTS,
      CAR_ICONS: CAR_ICONS
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
