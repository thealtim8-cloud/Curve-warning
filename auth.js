/* Curve Guide auth + premium adapter
 *
 * Firebase web config is set below. Auth uses the compat SDK loaded from gstatic
 * (firebase-app, firebase-auth, firebase-firestore) — see index.html FIREBASE_SDK.
 *
 * Apex payments use Paystack Inline (Popup) v2 with the LIVE public key.
 * The Firestore `premium` field is read-only for clients (see firestore.rules);
 * only the server step (server/verify-payment, Cloudflare Worker) may set it,
 * after verifying the reference with Paystack using the SECRET key.
 * Apex is NEVER granted locally: if verification fails the user sees the
 * reference + support contacts, and the app retries verification later.
 */
(function (global) {
  'use strict';

  var FIREBASE_CONFIG = {
    apiKey: 'AIzaSyB12vQGzJUNOJOKaJsyS8RXrzUGVJxQX_A',
    authDomain: 'curve-guide.firebaseapp.com',
    projectId: 'curve-guide',
    storageBucket: 'curve-guide.firebasestorage.app',
    messagingSenderId: '1099297608035',
    appId: '1:1099297608035:web:fa94d11d397564f5e18356',
    measurementId: 'G-GP56ZC45WC'
  };

  // Public LIVE key — safe to commit (public keys are meant for the browser).
  // Never put a secret key (sk_...) in this file. Test key for local testing:
  // pk_test_94e4ea814054a2a166783d3982176f703f516c07
  var PAYSTACK_PUBLIC_KEY = 'pk_live_ed38d5ade620e3c8c042020934d608662a112f97';
  // USD is not enabled on the Paystack merchant account yet, so only NGN is offered.
  var USD_ENABLED = false;
  var PAYSTACK_INLINE_SRC = 'https://js.paystack.co/v2/inline.js';
  // Server verification endpoint (Cloudflare Worker, server/verify-payment).
  // Empty = server step not deployed. If the Worker's secrets are missing it answers
  // 503 notConfigured and the app shows an error (never a local grant).
  var VERIFY_URL = 'https://curveguide-verify.thealtim8.workers.dev/verify';
  // Smart Niyi (Cloudflare Workers AI behind the same Worker; no AI key in the browser).
  var NIYI_URL = 'https://curveguide-verify.thealtim8.workers.dev/niyi';

  // Prices in the smallest unit (kobo / cents). Must match server/verify-payment PRICES.
  var APEX_PRICES = {
    NGN: { monthly: 45000, yearly: 378000 },
    USD: { monthly: 100, yearly: 840 }
  };
  var TEST_REF_KEY = 'curveGuide.testApexPayment'; // legacy preview flag, always cleared
  var PENDING_KEY = 'curveGuide.pendingApexPayment'; // paid but not yet verified -> retry

  var AUTH_KEY = 'curveGuide.previewAuth';
  var PLAN_KEY = 'curveGuide.previewPlan';
  var GATE_KEY = 'curveGuide.previewGate';
  var CURRENCY_KEY = 'curveGuide.previewCurrency';
  var PROFILE_KEY = 'curveGuide.profile';
  var FAV_KEY = 'curveGuide.favourites';
  var HAZARD_KEY = 'curveGuide.hazards';
  var PENDING_REDIRECT = 'curveGuide.authRedirect';

  var listeners = [];
  var fb = { app: null, auth: null, db: null, ready: false, firestoreOk: false, lastFsError: null,
    authResolved: false, redirectFailed: false };
  var serverPremium = null; // from Firestore read-only field when available
  var serverPremiumInfo = null; // { active, plan, expiresAt, reference, ... } set by server

  // `premium` may be a boolean (older docs) or a map written by the server:
  // { active: true, plan: 'monthly'|'yearly', expiresAt: Timestamp, reference, currency, amount }
  function parseServerPremium(v) {
    if (typeof v === 'boolean') return v;
    if (!v || typeof v !== 'object') return null;
    if (v.active !== true) return false;
    var exp = v.expiresAt;
    var ms = exp && typeof exp.toMillis === 'function' ? exp.toMillis()
      : (typeof exp === 'number' ? exp : (exp ? Date.parse(exp) : NaN));
    if (!isNaN(ms) && ms < Date.now()) return false;
    return true;
  }

  /* 7.2.5: remember the last server Apex state for this user, so Apex shows instantly on reload
     instead of "Free / pay" until Firestore answers. Display only: it is re-checked against Firestore
     on every load, and the Worker always checks Firestore itself (Niyi limits, payments). */
  var PREMIUM_CACHE_KEY = 'curveGuide.premiumCache';
  function plainPremium(v) {
    if (typeof v === 'boolean') return { active: v };
    if (!v || typeof v !== 'object') return null;
    var exp = v.expiresAt;
    var ms = exp && typeof exp.toMillis === 'function' ? exp.toMillis() : (typeof exp === 'number' ? exp : (exp ? Date.parse(exp) : null));
    return { active: v.active === true, plan: v.plan ? String(v.plan) : '', expiresAt: (ms == null || isNaN(ms)) ? null : ms,
      test: v.test === true, currency: v.currency || '' };
  }
  function setServerPremium(uid, raw) {
    var before = JSON.stringify([serverPremium, plainPremium(serverPremiumInfo)]);
    serverPremium = parseServerPremium(raw);
    serverPremiumInfo = plainPremium(raw);
    try {
      if (uid && serverPremiumInfo) localStorage.setItem(PREMIUM_CACHE_KEY, JSON.stringify({ uid: uid, premium: serverPremiumInfo }));
      else localStorage.removeItem(PREMIUM_CACHE_KEY);
    } catch (e) {}
    return before !== JSON.stringify([serverPremium, serverPremiumInfo]);
  }
  function clearPremium() {
    serverPremium = null;
    serverPremiumInfo = null;
    try { localStorage.removeItem(PREMIUM_CACHE_KEY); } catch (e) {}
    if (fb.unsubUserDoc) { try { fb.unsubUserDoc(); } catch (e) {} fb.unsubUserDoc = null; }
  }
  function restoreCachedPremium() {
    try {
      var c = JSON.parse(localStorage.getItem(PREMIUM_CACHE_KEY) || 'null');
      var u = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
      if (c && u && c.uid === u.uid && c.premium) {
        serverPremium = parseServerPremium(c.premium);
        serverPremiumInfo = c.premium;
      }
    } catch (e) {}
  }
  // Live updates: if Apex is granted/renewed while the app is open, show it without a reload.
  function watchUserDoc(uid) {
    if (!fb.db || !uid || typeof userDoc(uid).onSnapshot !== 'function') return;
    if (fb.unsubUserDoc && fb.watchUid === uid) return;
    if (fb.unsubUserDoc) { try { fb.unsubUserDoc(); } catch (e) {} }
    fb.watchUid = uid;
    fb.unsubUserDoc = userDoc(uid).onSnapshot(function (snap) {
      if (!snap.exists) return;
      var d = snap.data() || {};
      if (setServerPremium(uid, d.premium)) emit();
    }, function (err) { console.warn('[Curve Guide] live plan updates off', err && err.code); });
  }

  function loadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function saveJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  function isMobileLike() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '') ||
      (window.matchMedia && matchMedia('(max-width:759px)').matches);
  }

  function emit() {
    var snap = snapshot();
    listeners.forEach(function (fn) {
      try { fn(snap); } catch (e) {}
    });
  }

  function onChange(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (x) { return x !== fn; });
    };
  }

  function mapUser(u) {
    if (!u) return null;
    return {
      uid: u.uid,
      displayName: u.displayName || (u.email && u.email.split('@')[0]) || 'Driver',
      email: u.email || '',
      photoURL: u.photoURL || null,
      provider: (u.providerData && u.providerData[0] && u.providerData[0].providerId) || 'firebase'
    };
  }

  function cacheUser(u) {
    if (u) saveJson(AUTH_KEY, u);
    else try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
  }

  function currentUser() {
    if (fb.auth && fb.auth.currentUser) return mapUser(fb.auth.currentUser);
    return loadJson(AUTH_KEY, null);
  }

  function testApexPayment() { return null; } // local test grants removed in 7.1
  function pendingApexPayment() {
    var p = loadJson(PENDING_KEY, null);
    var u = currentUser();
    return p && u && p.uid === u.uid ? p : null;
  }

  // Apex comes ONLY from the server-written Firestore field.
  function plan() {
    return serverPremium === true ? 'premium' : 'free';
  }

  function isPremium() { return plan() === 'premium'; }
  // 7.2: Apex locks are always on. Apex = server-written premium (active + expiresAt in future).
  function gatingOn() { return true; }
  function setGating() { emit(); }
  function currency() { return USD_ENABLED && loadJson(CURRENCY_KEY, 'NGN') === 'USD' ? 'USD' : 'NGN'; }
  function setCurrency(c) { saveJson(CURRENCY_KEY, USD_ENABLED && c === 'USD' ? 'USD' : 'NGN'); emit(); }

  function snapshot() {
    return {
      preview: !fb.ready,
      user: currentUser(),
      signedIn: !!currentUser(),
      plan: plan(),
      premium: isPremium(),
      gating: gatingOn(),
      currency: currency(),
      firebaseReady: fb.ready,
      firestoreOk: fb.firestoreOk,
      lastFsError: fb.lastFsError,
      paystackReady: !!PAYSTACK_PUBLIC_KEY,
      paystackTestMode: /^pk_test_/.test(PAYSTACK_PUBLIC_KEY || ''),
      verifyReady: !!VERIFY_URL,
      serverPremium: serverPremium,
      serverPremiumInfo: serverPremiumInfo,
      testApex: null,
      authResolved: fb.authResolved || !FIREBASE_CONFIG,
      redirectFailed: fb.redirectFailed,
      usdEnabled: USD_ENABLED,
      pendingPayment: pendingApexPayment()
    };
  }

  function initFirebase() {
    if (!FIREBASE_CONFIG) return Promise.resolve(false);
    if (typeof firebase === 'undefined') {
      console.warn('[Curve Guide] Firebase SDK not loaded — auth stays local.');
      return Promise.resolve(false);
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      fb.app = firebase.app();
      fb.auth = firebase.auth();
      try {
        fb.db = firebase.firestore();
        fb.firestoreOk = true;
      } catch (e) {
        fb.db = null;
        fb.firestoreOk = false;
        fb.lastFsError = String(e && e.message || e);
      }
      fb.ready = true;

      // Keep the session on this device (IndexedDB/localStorage), not just this tab.
      var persist = Promise.resolve();
      try { persist = fb.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {}); } catch (e) {}
      var hadPendingRedirect = false;
      try { hadPendingRedirect = localStorage.getItem(PENDING_REDIRECT) === '1'; } catch (e) {}
      // Complete redirect sign-in if one was started (fallback path only since 7.2.3)
      return persist.then(function () { return fb.auth.getRedirectResult(); }).then(function (result) {
        try { localStorage.removeItem(PENDING_REDIRECT); } catch (e) {}
        if (hadPendingRedirect && !(result && result.user) && !fb.auth.currentUser) {
          // Typical on iPhone/iPad (Safari & Chrome use WebKit storage partitioning):
          // the redirect came back but the result was lost. Tell the user instead of looping.
          fb.redirectFailed = true;
        }
        if (result && result.user) {
          cacheUser(mapUser(result.user));
          return pullUserCloud(result.user.uid).then(function () { emit(); return true; });
        }
        return true;
      }).catch(function (err) {
        console.warn('[Curve Guide] redirect result', err);
        return true;
      }).then(function () {
        fb.auth.onAuthStateChanged(function (user) {
          fb.authResolved = true;
          if (user) {
            fb.redirectFailed = false;
            cacheUser(mapUser(user));
            if (fb.watchUid && fb.watchUid !== user.uid) clearPremium();
            pullUserCloud(user.uid).finally(function () { emit(); });
          } else {
            cacheUser(null);
            clearPremium();
            emit();
          }
        });
        return true;
      });
    } catch (e) {
      console.warn('[Curve Guide] Firebase init failed', e);
      fb.ready = false;
      fb.lastFsError = String(e && e.message || e);
      return Promise.resolve(false);
    }
  }

  function userDoc(uid) {
    return fb.db.collection('users').doc(uid);
  }

  function pullUserCloud(uid) {
    if (!fb.db || !uid) return Promise.resolve(null);
    return userDoc(uid).get().then(function (snap) {
      fb.firestoreOk = true;
      fb.lastFsError = null;
      if (!snap.exists) {
        // seed profile from local on first login
        return pushUserCloud(uid, { seed: true });
      }
      var data = snap.data() || {};
      setServerPremium(uid, data.premium);
      watchUserDoc(uid);
      if (data.profile && typeof data.profile === 'object') {
        try {
          var local = loadJson(PROFILE_KEY, {});
          var merged = Object.assign({}, local, data.profile);
          saveJson(PROFILE_KEY, merged);
          if (window.__cgPremiumUI && window.__cgPremiumUI.applyCarMarker) window.__cgPremiumUI.applyCarMarker();
          if (window.__cgPremiumUI && window.__cgPremiumUI.applyTheme) window.__cgPremiumUI.applyTheme();
        } catch (e) {}
      }
      // Cloud sync of favourites + danger reports is an Apex feature.
      // Free users keep everything on this phone (local still works).
      if (serverPremium === true) {
        var changed = false;
        if (data.favourites && typeof data.favourites === 'object') {
          var localF = loadJson(FAV_KEY, {}) || {};
          var mergedF = Object.assign({}, localF, data.favourites);
          var cust = [].concat(localF.custom || [], data.favourites.custom || []);
          var seen = {};
          mergedF.custom = cust.filter(function (c) {
            var k = c && c.name + '|' + (c.coord || []).join(',');
            if (!c || seen[k]) return false; seen[k] = true; return true;
          }).slice(-8);
          if (!mergedF.custom.length) delete mergedF.custom;
          saveJson(FAV_KEY, mergedF);
          changed = true;
        }
        if (Array.isArray(data.hazards)) {
          var localH = loadJson(HAZARD_KEY, []) || [];
          var byKey = {};
          localH.concat(data.hazards).forEach(function (h) {
            if (h && h.coord) byKey[(h.at || 0) + '|' + h.coord.join(',')] = h;
          });
          var mergedH = Object.keys(byKey).map(function (k) { return byKey[k]; })
            .sort(function (a, b) { return (a.at || 0) - (b.at || 0); }).slice(-100);
          saveJson(HAZARD_KEY, mergedH);
          changed = true;
        }
        if (changed) {
          document.dispatchEvent(new CustomEvent('cg:favs-changed'));
          document.dispatchEvent(new CustomEvent('cg:hazards-changed'));
        }
        // upload anything that only existed on this phone
        pushUserCloud(uid);
      }
      return data;
    }).catch(function (err) {
      fb.firestoreOk = false;
      fb.lastFsError = (err && err.message) || String(err);
      console.warn('[Curve Guide] Firestore read failed — using localStorage.', err);
      return null;
    });
  }

  function pushUserCloud(uid, opts) {
    opts = opts || {};
    if (!fb.db || !uid) return Promise.resolve(null);
    var u = currentUser() || {};
    var profile = loadJson(PROFILE_KEY, {});
    // Never send `premium` from the client — rules reject changes to it.
    var payload = {
      displayName: u.displayName || '',
      email: u.email || '',
      photoURL: u.photoURL || null,
      profile: profile,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    // Favourites + danger reports sync across phones only for Apex.
    if (isPremium()) {
      payload.favourites = loadJson(FAV_KEY, {}) || {};
      payload.hazards = (loadJson(HAZARD_KEY, []) || []).slice(-100);
    }
    var ref = userDoc(uid);
    return ref.set(payload, { merge: true }).then(function () {
      fb.firestoreOk = true;
      fb.lastFsError = null;
      return payload;
    }).catch(function (err) {
      fb.firestoreOk = false;
      fb.lastFsError = (err && err.message) || String(err);
      console.warn('[Curve Guide] Firestore write failed — kept local only.', err);
      return null;
    });
  }

  function syncNow() {
    var u = fb.auth && fb.auth.currentUser;
    if (!u) return Promise.resolve(null);
    return pushUserCloud(u.uid);
  }

  function googleProvider() {
    var p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    return p;
  }

  function signInWithGoogle() {
    if (!fb.ready || !fb.auth) {
      return localFakeSignIn('google', 'Google Preview', 'google.preview@curveguide.local');
    }
    var provider = googleProvider();
    fb.redirectFailed = false;
    // 7.2.3: always use a pop-up first, opened directly from the tap.
    // signInWithRedirect with authDomain *.firebaseapp.com loses the result on iOS/iPadOS
    // (Safari and Chrome both use WebKit, which partitions third-party storage), which sent
    // users straight back to the sign-in screen. Redirect is only a fallback now.
    return fb.auth.signInWithPopup(provider).then(function (cred) {
      cacheUser(mapUser(cred.user));
      return pullUserCloud(cred.user.uid).then(function () {
        emit();
        return mapUser(cred.user);
      });
    }).catch(function (err) {
      if (err && /configuration-not-found|operation-not-allowed|admin-restricted/i.test(String(err.code||'')+' '+String(err.message||''))) {
        console.warn('[Curve Guide] Google auth not enabled yet — local preview account.', err);
        return localFakeSignIn('google', 'Google Preview', 'google.preview@curveguide.local');
      }
      var code = (err && err.code) || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') {
        return Promise.reject(Object.assign(new Error('The Google window was closed before sign-in finished. Tap Continue with Google to try again.'), { code: code }));
      }
      // Pop-up blocked or not supported (e.g. some in-app browsers) → fall back to redirect.
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try { localStorage.setItem(PENDING_REDIRECT, '1'); } catch (e) {}
        return fb.auth.signInWithRedirect(provider);
      }
      return Promise.reject(err);
    });
  }

  function signInWithEmail(email, password) {
    email = String(email || '').trim();
    if (!email || !password) return Promise.reject(new Error('Enter email and password'));
    if (!fb.ready || !fb.auth) {
      return localFakeSignIn('email', email.split('@')[0] || 'Driver', email);
    }
    return fb.auth.signInWithEmailAndPassword(email, password).then(function (cred) {
      cacheUser(mapUser(cred.user));
      return pullUserCloud(cred.user.uid).then(function () {
        emit();
        return mapUser(cred.user);
      });
    }).catch(function (err) {
      if (err && /configuration-not-found|operation-not-allowed|admin-restricted/i.test(String(err.code||'')+' '+String(err.message||''))) {
        console.warn('[Curve Guide] Email auth not enabled yet — local preview account.', err);
        return localFakeSignIn('email', email.split('@')[0] || 'Driver', email);
      }
      return Promise.reject(err);
    });
  }

  function createAccount(email, password, name) {
    email = String(email || '').trim();
    if (!email || !password) return Promise.reject(new Error('Enter email and password'));
    if (password.length < 6) return Promise.reject(new Error('Password must be at least 6 characters'));
    if (!fb.ready || !fb.auth) {
      return localFakeSignIn('email', (name && String(name).trim()) || email.split('@')[0] || 'New driver', email);
    }
    return fb.auth.createUserWithEmailAndPassword(email, password).then(function (cred) {
      var p = Promise.resolve();
      if (name && cred.user) {
        p = cred.user.updateProfile({ displayName: String(name).trim() });
      }
      return p.then(function () {
        cacheUser(mapUser(cred.user));
        return pushUserCloud(cred.user.uid).then(function () {
          emit();
          return mapUser(cred.user);
        });
      });
    }).catch(function (err) {
      if (err && /configuration-not-found|operation-not-allowed|admin-restricted/i.test(String(err.code||'')+' '+String(err.message||''))) {
        console.warn('[Curve Guide] Email auth not enabled yet — local preview account.', err);
        return localFakeSignIn('email', (name && String(name).trim()) || email.split('@')[0] || 'New driver', email);
      }
      return Promise.reject(err);
    });
  }

  function sendPasswordReset(email) {
    email = String(email || '').trim();
    if (!email) return Promise.reject(new Error('Enter your email'));
    if (!fb.ready || !fb.auth) {
      return Promise.resolve({ preview: true, message: 'Firebase Auth not ready — no reset email sent.' });
    }
    return fb.auth.sendPasswordResetEmail(email).then(function () {
      return { message: 'Password reset email sent if that address is registered.' };
    });
  }

  function localFakeSignIn(provider, displayName, email) {
    var u = {
      uid: 'local-' + Date.now().toString(36),
      displayName: displayName,
      email: email,
      provider: provider,
      photoURL: null
    };
    cacheUser(u);
    if (!loadJson(PLAN_KEY, null)) saveJson(PLAN_KEY, 'free');
    emit();
    return Promise.resolve(u);
  }

  function continueWithoutAccount() {
    if (fb.auth && fb.auth.currentUser) {
      return fb.auth.signOut().then(function () {
        cacheUser(null);
        clearPremium();
        emit();
        return null;
      });
    }
    cacheUser(null);
    emit();
    return Promise.resolve(null);
  }

  function signOut() {
    var p = (fb.auth) ? fb.auth.signOut() : Promise.resolve();
    return p.catch(function () {}).then(function () {
      cacheUser(null);
      clearPremium();
      emit();
    });
  }

  /* ---------- Paystack Inline (Popup) checkout ---------- */
  var paystackLoading = null;
  function loadPaystack() {
    if (typeof global.PaystackPop === 'function') return Promise.resolve(global.PaystackPop);
    if (paystackLoading) return paystackLoading;
    paystackLoading = new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = PAYSTACK_INLINE_SRC;
      sc.async = true;
      sc.onload = function () {
        if (typeof global.PaystackPop === 'function') resolve(global.PaystackPop);
        else { paystackLoading = null; reject(new Error('Paystack loaded but PaystackPop is missing')); }
      };
      sc.onerror = function () {
        paystackLoading = null;
        sc.remove();
        reject(new Error('Could not load Paystack. Check your internet connection and try again.'));
      };
      document.head.appendChild(sc);
    });
    return paystackLoading;
  }

  function apexAmount(planId, cur) {
    var table = APEX_PRICES[cur === 'USD' ? 'USD' : 'NGN'];
    return table[planId === 'yearly' ? 'yearly' : 'monthly'];
  }

  function makeReference(uid, planId) {
    var rand = Math.random().toString(36).slice(2, 8);
    // Paystack allows only alphanumerics, '-', '.', '='
    return ('CG-' + String(uid || 'guest').replace(/[^A-Za-z0-9]/g, '').slice(0, 10) + '-' +
      (planId === 'yearly' ? 'Y' : 'M') + '-' + Date.now().toString(36) + '-' + rand);
  }

  function getIdToken() {
    try {
      if (fb.auth && fb.auth.currentUser) return fb.auth.currentUser.getIdToken();
    } catch (e) {}
    return Promise.resolve(null);
  }

  // Ask the server to verify the reference with Paystack and set users/{uid}.premium.
  function verifyPayment(reference) {
    if (!VERIFY_URL) return Promise.resolve({ ok: false, notConfigured: true, reference: reference });
    return getIdToken().then(function (token) {
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      var url = VERIFY_URL.replace(/\/+$/, '');
      if (!/\/verify$/.test(url)) url += '/verify';
      return fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ reference: reference })
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        body = body || {};
        body.httpStatus = res.status;
        if (!res.ok) body.ok = false;
        return body;
      });
    }).then(function (body) {
      if (body.ok) {
        try { localStorage.removeItem(PENDING_KEY); } catch (e) {}
        var u = fb.auth && fb.auth.currentUser;
        return (u ? pullUserCloud(u.uid) : Promise.resolve()).then(function () { emit(); return body; });
      }
      return body;
    });
  }

  /**
   * Opens the Paystack popup for Apex.
   * hooks: { onOpen(), onPaid(transaction), onCancel(), onError(err) }
   * Resolves { status: 'paid'|'cancelled', reference, verify }.
   */
  function startApexCheckout(planId, hooks) {
    hooks = hooks || {};
    planId = planId === 'yearly' ? 'yearly' : 'monthly';
    var user = currentUser();
    if (!user || !user.email || !(fb.auth && fb.auth.currentUser)) {
      var e1 = new Error('Please sign in first so your Apex plan is saved to your account.');
      e1.code = 'not-signed-in';
      return Promise.reject(e1);
    }
    var cur = currency();
    var amount = apexAmount(planId, cur);
    var reference = makeReference(user.uid, planId);
    return loadPaystack().then(function (PaystackPop) {
      return new Promise(function (resolve, reject) {
        var settled = false;
        function fail(err) {
          if (settled) return;
          settled = true;
          var msg = (err && err.message) || String(err || 'Payment could not start');
          var e2 = new Error(msg);
          e2.code = 'paystack-error';
          e2.currency = cur;
          if (cur === 'USD') e2.usdHint = true;
          reject(e2);
        }
        var popup;
        try {
          popup = new PaystackPop();
          popup.newTransaction({
            key: PAYSTACK_PUBLIC_KEY,
            email: user.email,
            amount: amount,
            currency: cur,
            reference: reference,
            metadata: {
              uid: user.uid,
              plan: planId,
              product: 'apex',
              app: 'curve-guide',
              custom_fields: [
                { display_name: 'Plan', variable_name: 'plan', value: 'Apex ' + planId },
                { display_name: 'User ID', variable_name: 'uid', value: user.uid }
              ]
            },
            onLoad: function () { if (hooks.onOpen) try { hooks.onOpen(); } catch (e) {} },
            onSuccess: function (transaction) {
              if (settled) return;
              settled = true;
              var ref = (transaction && (transaction.reference || transaction.trxref)) || reference;
              var record = { reference: ref, plan: planId, currency: cur, amount: amount, uid: user.uid, at: Date.now() };
              // Remember the reference so activation can be retried; this does NOT grant Apex.
              saveJson(PENDING_KEY, record);
              if (hooks.onPaid) try { hooks.onPaid(record); } catch (e) {}
              verifyPayment(ref).then(function (v) {
                emit();
                resolve({ status: 'paid', reference: ref, record: record, verify: v });
              }).catch(function (err) {
                emit();
                resolve({ status: 'paid', reference: ref, record: record, verify: { ok: false, error: String(err && err.message || err) } });
              });
            },
            onCancel: function () {
              if (settled) return;
              settled = true;
              if (hooks.onCancel) try { hooks.onCancel(); } catch (e) {}
              resolve({ status: 'cancelled', reference: reference });
            },
            onError: function (err) { fail(err); }
          });
        } catch (err) {
          fail(err);
        }
      });
    });
  }

  function clearTestApex() {
    try { localStorage.removeItem(TEST_REF_KEY); } catch (e) {}
    emit();
  }

  // Retry activation for a payment that succeeded but was not verified yet.
  var retrying = false;
  function retryPendingPayment() {
    var p = pendingApexPayment();
    if (!p || retrying || !(fb.auth && fb.auth.currentUser)) return Promise.resolve(null);
    retrying = true;
    return verifyPayment(p.reference).catch(function () { return null; }).then(function (v) {
      retrying = false;
      emit();
      return v;
    });
  }

  function setPlanLocal(planName) {
    // Kept for compatibility; has no effect on Apex any more (server-only).
    try { localStorage.removeItem(PLAN_KEY); } catch (e) {}
    if (planName !== 'premium') { try { localStorage.removeItem(TEST_REF_KEY); } catch (e) {} }
    emit();
  }

  function requiresPremium() {
    return !isPremium();
  }

  // Smart Niyi: ask the Worker (Workers AI). Needs sign-in; the server also
  // enforces the daily limit (free) and checks Apex from Firestore itself.
  function niyiChat(messages, context) {
    if (!NIYI_URL) return Promise.reject(new Error('Niyi AI not configured'));
    if (!(fb.auth && fb.auth.currentUser)) return Promise.reject(Object.assign(new Error('signin'), { code: 'signin' }));
    return getIdToken().then(function (token) {
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var to = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : null;
      return fetch(NIYI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ messages: messages, context: context || {} }),
        signal: ctl ? ctl.signal : undefined
      }).then(function (res) {
        if (to) clearTimeout(to);
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok || !body.ok) {
            var e = new Error(body.error || ('Niyi server ' + res.status));
            e.status = res.status; e.code = body.code || ''; e.body = body;
            throw e;
          }
          return body;
        });
      });
    });
  }

  function saveProfileLocalAndCloud(profileObj) {
    saveJson(PROFILE_KEY, profileObj);
    return syncNow();
  }

  function saveFavouritesLocalAndCloud(favs) {
    saveJson(FAV_KEY, favs);
    document.dispatchEvent(new CustomEvent('cg:favs-changed'));
    return syncNow();
  }


  function deleteAccount() {
    if (!fb.auth || !fb.auth.currentUser) {
      cacheUser(null);
      clearPremium();
      try { localStorage.removeItem(AUTH_KEY); localStorage.removeItem(PROFILE_KEY); } catch (e) {}
      emit();
      return Promise.resolve({ localOnly: true });
    }
    var user = fb.auth.currentUser;
    var uid = user.uid;
    var wipeFs = Promise.resolve();
    if (fb.db) {
      wipeFs = userDoc(uid).delete().catch(function (err) {
        // If doc missing, continue; otherwise surface
        if (err && err.code === 'not-found') return;
        console.warn('[Curve Guide] Firestore delete', err);
        // still attempt auth delete
      });
    }
    return wipeFs.then(function () {
      return user.delete();
    }).then(function () {
      cacheUser(null);
      clearPremium();
      try {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(PLAN_KEY);
        localStorage.removeItem(TEST_REF_KEY);
        // keep profile optional wipe
        localStorage.removeItem(PROFILE_KEY);
      } catch (e) {}
      emit();
      return { deleted: true, uid: uid };
    });
  }

  function tryWritePremiumField() {
    // Test helper: attempt an illegal client write of `premium` (must fail rules).
    if (!fb.auth || !fb.auth.currentUser || !fb.db) {
      return Promise.reject(new Error('Not signed in or Firestore unavailable'));
    }
    var uid = fb.auth.currentUser.uid;
    return userDoc(uid).set({ premium: true }, { merge: true }).then(function () {
      return { ok: true, unexpected: true };
    }).catch(function (err) {
      return { ok: false, code: err && err.code, message: (err && err.message) || String(err) };
    });
  }

  // Boot: remove legacy preview-only local Apex switches (Apex is server-only now).
  try { localStorage.removeItem(TEST_REF_KEY); localStorage.removeItem(PLAN_KEY); } catch (e) {}
  restoreCachedPremium();
  var boot = initFirebase();
  // After sign-in is known, retry any paid-but-unverified Apex payment.
  var autoRetried = {}; // at most one automatic retry per reference per page load
  onChange(function (snap) {
    var p = snap.signedIn && snap.firebaseReady && snap.pendingPayment;
    if (p && !retrying && !autoRetried[p.reference]) {
      autoRetried[p.reference] = true;
      setTimeout(retryPendingPayment, 1500);
    }
  });

  global.__cgAuth = {
    FIREBASE_CONFIG: FIREBASE_CONFIG,
    PAYSTACK_PUBLIC_KEY: PAYSTACK_PUBLIC_KEY,
    ready: boot,
    isPreview: function () { return !fb.ready; },
    snapshot: snapshot,
    onChange: onChange,
    currentUser: currentUser,
    plan: plan,
    isPremium: isPremium,
    gatingOn: gatingOn,
    setGating: setGating,
    currency: currency,
    setCurrency: setCurrency,
    signInWithGoogle: signInWithGoogle,
    signInWithEmail: signInWithEmail,
    createAccount: createAccount,
    sendPasswordReset: sendPasswordReset,
    continueWithoutAccount: continueWithoutAccount,
    signOut: signOut,
    VERIFY_URL: VERIFY_URL,
    APEX_PRICES: APEX_PRICES,
    loadPaystack: loadPaystack,
    startApexCheckout: startApexCheckout,
    verifyPayment: verifyPayment,
    testApexPayment: testApexPayment,
    pendingApexPayment: pendingApexPayment,
    retryPendingPayment: retryPendingPayment,
    clearTestApex: clearTestApex,
    setPlanLocal: setPlanLocal,
    requiresPremium: requiresPremium,
    syncNow: syncNow,
    pullUserCloud: function () {
      var u = fb.auth && fb.auth.currentUser;
      return u ? pullUserCloud(u.uid) : Promise.resolve(null);
    },
    saveProfileLocalAndCloud: saveProfileLocalAndCloud,
    saveFavouritesLocalAndCloud: saveFavouritesLocalAndCloud,
    NIYI_URL: NIYI_URL,
    niyiChat: niyiChat,
    isSignedIn: function () { return !!(fb.auth && fb.auth.currentUser); },
    getFirebase: function () { return fb; },
    deleteAccount: deleteAccount,
    tryWritePremiumField: tryWritePremiumField
  };
})(typeof window !== 'undefined' ? window : this);
