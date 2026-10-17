// Offline test: mocks Paystack, Google OAuth and Firestore. Run: node test/worker.test.mjs
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHmac } from 'node:crypto';
import worker from '../src/worker.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = { client_email: 'test@curve-guide.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
const env = {
  PAYSTACK_SECRET_KEY: 'sk_test_dummy_for_unit_test_only',
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify(SA),
  FIREBASE_PROJECT_ID: 'curve-guide',
  ALLOWED_ORIGINS: 'https://curveguide.name.ng',
  ALLOW_TEST_PAYMENTS: 'true',
  REQUIRE_ID_TOKEN: 'false'
};

const txs = {
  'CG-good-M': { status: 'success', domain: 'test', amount: 45000, currency: 'NGN', reference: 'CG-good-M', paid_at: '2026-10-17T10:00:00.000Z', metadata: { uid: 'user123abc', plan: 'monthly' } },
  'CG-good-Y-USD': { status: 'success', domain: 'test', amount: 840, currency: 'USD', reference: 'CG-good-Y-USD', paid_at: '2026-10-17T10:00:00.000Z', metadata: { uid: 'user123abc', plan: 'yearly' } },
  'CG-cheap': { status: 'success', domain: 'test', amount: 100, currency: 'NGN', reference: 'CG-cheap', metadata: { uid: 'user123abc', plan: 'yearly' } },
  'CG-failed': { status: 'failed', domain: 'test', amount: 45000, currency: 'NGN', reference: 'CG-failed', metadata: { uid: 'user123abc', plan: 'monthly' } }
};
const store = {}; // path -> fields
let commits = 0;

globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith('https://api.paystack.co/transaction/verify/')) {
    assert.equal(init.headers.Authorization, 'Bearer ' + env.PAYSTACK_SECRET_KEY);
    const ref = decodeURIComponent(url.split('/').pop());
    return txs[ref] ? J({ status: true, data: txs[ref] }) : J({ status: false, message: 'Transaction reference not found' }, 400);
  }
  if (url === 'https://oauth2.googleapis.com/token') {
    assert.match(String(init.body), /assertion=[\w-]+\.[\w-]+\.[\w-]+/);
    return J({ access_token: 'ya29.fake', expires_in: 3600 });
  }
  const base = 'https://firestore.googleapis.com/v1/projects/curve-guide/databases/(default)/documents';
  if (url === base + ':commit') {
    commits++;
    const body = JSON.parse(init.body);
    for (const w of body.writes) {
      const path = w.update.name.split('/documents/')[1];
      if (w.currentDocument && w.currentDocument.exists === false && store[path]) return J({ error: { status: 'ALREADY_EXISTS' } }, 409);
    }
    for (const w of body.writes) {
      const path = w.update.name.split('/documents/')[1];
      store[path] = Object.assign({}, store[path] || {}, w.update.fields);
    }
    return J({ writeResults: [] });
  }
  if (url.startsWith(base + '/')) {
    const path = url.slice(base.length + 1);
    return store[path] ? J({ name: path, fields: store[path] }) : J({ error: {} }, 404);
  }
  throw new Error('unexpected fetch ' + url);
};

const call = (path, body, headers = {}) => worker.fetch(new Request('https://w.example' + path, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Origin: 'https://curveguide.name.ng' }, headers),
  body: typeof body === 'string' ? body : JSON.stringify(body)
}), env);

let r = await call('/verify', { reference: 'CG-good-M' });
let b = await r.json();
assert.equal(r.status, 200, JSON.stringify(b));
assert.equal(b.ok, true);
assert.equal(b.plan, 'monthly');
assert.equal(b.expiresAt, '2026-11-17T10:00:00.000Z');
assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://curveguide.name.ng');
const prem = store['users/user123abc'].premium.mapValue.fields;
assert.equal(prem.active.booleanValue, true);
assert.equal(prem.reference.stringValue, 'CG-good-M');
console.log('✓ monthly NGN verified, premium set, expires', b.expiresAt);

r = await call('/verify', { reference: 'CG-good-M' }); b = await r.json();
assert.equal(b.alreadyProcessed, true); assert.equal(commits, 1);
console.log('✓ same reference twice is idempotent (no double extension)');

r = await call('/verify', { reference: 'CG-good-Y-USD' }); b = await r.json();
assert.equal(b.ok, true); assert.equal(b.expiresAt, '2027-11-17T10:00:00.000Z');
console.log('✓ yearly USD stacks on top of the active month ->', b.expiresAt);

r = await call('/verify', { reference: 'CG-cheap' }); b = await r.json();
assert.equal(r.status, 400); assert.match(b.error, /Amount/);
console.log('✓ wrong amount rejected:', b.error);

r = await call('/verify', { reference: 'CG-failed' }); b = await r.json();
assert.equal(r.status, 400); console.log('✓ failed payment rejected:', b.error);

r = await call('/verify', { reference: 'CG-missing' }); b = await r.json();
assert.equal(r.status, 400); console.log('✓ unknown reference rejected:', b.error);

r = await call('/verify', { reference: 'CG-good-M' }, { Authorization: 'Bearer not.a.jwt' }); b = await r.json();
assert.equal(r.status, 401); console.log('✓ bad Firebase token rejected:', b.error);

// Webhook
txs['CG-hook'] = { status: 'success', domain: 'test', amount: 378000, currency: 'NGN', reference: 'CG-hook', paid_at: '2026-10-17T10:00:00.000Z', metadata: { uid: 'otheruser99', plan: 'yearly' } };
const ev = JSON.stringify({ event: 'charge.success', data: { reference: 'CG-hook' } });
r = await call('/webhook', ev, { 'x-paystack-signature': 'deadbeef' });
assert.equal(r.status, 401); console.log('✓ webhook with bad signature rejected');
const sig = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(ev).digest('hex');
r = await call('/webhook', ev, { 'x-paystack-signature': sig });
assert.equal(r.status, 200); assert.equal(store['users/otheruser99'].premium.mapValue.fields.plan.stringValue, 'yearly');
console.log('✓ signed charge.success webhook grants Apex');

env.ALLOW_TEST_PAYMENTS = 'false';
txs['CG-t2'] = Object.assign({}, txs['CG-good-M'], { reference: 'CG-t2' });
r = await call('/verify', { reference: 'CG-t2' }); assert.equal(r.status, 400);
console.log('✓ test payments refused when ALLOW_TEST_PAYMENTS=false');
console.log('\nAll worker tests passed.');
