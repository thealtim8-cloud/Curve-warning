/* Curve Guide auth + premium adapter
 *
 * Firebase web config is set below. Auth uses the compat SDK loaded from gstatic
 * (firebase-app, firebase-auth, firebase-firestore) — see index.html FIREBASE_SDK.
 *
 * Premium payments stay simulated until Paystack. The Firestore `premium` field is
 * read-only for clients (see firestore.rules); only Cloud Functions / Admin SDK
 * should set it. Preview can still simulate Premium via localStorage.
 *
 * Paystack later: set PAYSTACK_PUBLIC_KEY + serverless verify, then replace
 * simulatePremiumUpgrade().
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

  var PAYSTACK_PUBLIC_KEY = null;

  var AUTH_KEY = 'curveGuide.previewAuth';
  var PLAN_KEY = 'curveGuide.previewPlan';
  var GATE_KEY = 'curveGuide.previewGate';
  var CURRENCY_KEY = 'curveGuide.previewCurrency';
  var PROFILE_KEY = 'curveGuide.profile';
  var FAV_KEY = 'curveGuide.favourites';
  var PENDING_REDIRECT = 'curveGuide.authRedirect';

  var listeners = [];
  var fb = { app: null, auth: null, db: null, ready: false, firestoreOk: false, lastFsError: null };
  var serverPremium = null; // from Firestore read-only field when available

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

  function plan() {
    if (serverPremium === true) return 'premium';
    var p = loadJson(PLAN_KEY, 'free');
    return p === 'premium' ? 'premium' : 'free';
  }

  function isPremium() { return plan() === 'premium'; }
  function gatingOn() { return loadJson(GATE_KEY, false) === true; }
  function setGating(on) { saveJson(GATE_KEY, !!on); emit(); }
  function currency() { return loadJson(CURRENCY_KEY, 'NGN') === 'USD' ? 'USD' : 'NGN'; }
  function setCurrency(c) { saveJson(CURRENCY_KEY, c === 'USD' ? 'USD' : 'NGN'); emit(); }

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
      serverPremium: serverPremium
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

      // Complete redirect sign-in if pending (mobile Google)
      return fb.auth.getRedirectResult().then(function (result) {
        try { localStorage.removeItem(PENDING_REDIRECT); } catch (e) {}
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
          if (user) {
            cacheUser(mapUser(user));
            pullUserCloud(user.uid).finally(function () { emit(); });
          } else {
            cacheUser(null);
            serverPremium = null;
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
      if (typeof data.premium === 'boolean') serverPremium = data.premium;
      if (data.profile && typeof data.profile === 'object') {
        try {
          var local = loadJson(PROFILE_KEY, {});
          var merged = Object.assign({}, local, data.profile);
          saveJson(PROFILE_KEY, merged);
          if (window.__cgPremiumUI && window.__cgPremiumUI.applyCarMarker) window.__cgPremiumUI.applyCarMarker();
          if (window.__cgPremiumUI && window.__cgPremiumUI.applyTheme) window.__cgPremiumUI.applyTheme();
        } catch (e) {}
      }
      if (data.favourites && typeof data.favourites === 'object') {
        saveJson(FAV_KEY, data.favourites);
        document.dispatchEvent(new CustomEvent('cg:favs-changed'));
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
    var favs = loadJson(FAV_KEY, {});
    // Never send `premium` from the client — rules reject changes to it.
    var payload = {
      displayName: u.displayName || '',
      email: u.email || '',
      photoURL: u.photoURL || null,
      profile: profile,
      favourites: favs,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
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
    if (isMobileLike()) {
      try { localStorage.setItem(PENDING_REDIRECT, '1'); } catch (e) {}
      return fb.auth.signInWithRedirect(provider);
    }
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
      // Popup blocked / unsupported → redirect
      if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user' ||
          err.code === 'auth/cancelled-popup-request' || /popup/i.test(err.message || ''))) {
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
        serverPremium = null;
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
      serverPremium = null;
      emit();
    });
  }

  function simulatePremiumUpgrade(planId) {
    if (PAYSTACK_PUBLIC_KEY) {
      return Promise.reject(new Error('Paystack key set but checkout not implemented yet'));
    }
    if (!currentUser()) {
      return localFakeSignIn('preview', 'Apex Preview', 'apex.preview@curveguide.local').then(function () {
        saveJson(PLAN_KEY, 'premium');
        try { localStorage.setItem('curveGuide.previewPlanId', planId || 'monthly'); } catch (e) {}
        emit();
        return { preview: true, plan: 'premium', planId: planId || 'monthly' };
      });
    }
    saveJson(PLAN_KEY, 'premium');
    try { localStorage.setItem('curveGuide.previewPlanId', planId || 'monthly'); } catch (e) {}
    emit();
    return Promise.resolve({ preview: true, plan: 'premium', planId: planId || 'monthly' });
  }

  function setPlanLocal(planName) {
    saveJson(PLAN_KEY, planName === 'premium' ? 'premium' : 'free');
    emit();
  }

  function requiresPremium() {
    if (!gatingOn()) return false;
    if (isPremium()) return false;
    return true;
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
      serverPremium = null;
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
      serverPremium = null;
      try {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(PLAN_KEY);
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

  // Boot
  var boot = initFirebase();

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
    simulatePremiumUpgrade: simulatePremiumUpgrade,
    setPlanLocal: setPlanLocal,
    requiresPremium: requiresPremium,
    syncNow: syncNow,
    pullUserCloud: function () {
      var u = fb.auth && fb.auth.currentUser;
      return u ? pullUserCloud(u.uid) : Promise.resolve(null);
    },
    saveProfileLocalAndCloud: saveProfileLocalAndCloud,
    saveFavouritesLocalAndCloud: saveFavouritesLocalAndCloud,
    getFirebase: function () { return fb; },
    deleteAccount: deleteAccount,
    tryWritePremiumField: tryWritePremiumField
  };
})(typeof window !== 'undefined' ? window : this);
