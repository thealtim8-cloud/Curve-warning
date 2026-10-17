# Curve Guide — Apex payment verification (server step)

**What this does:** When someone pays for Apex in the app, Paystack gives the app a
*reference* (like a receipt number). The app cannot be trusted to say "I paid", so it sends
the reference here. This small server:

1. asks Paystack (using your **secret key**) whether that payment really succeeded,
2. checks the amount and currency match the Apex price (₦450 / ₦3,780 / $1 / $8.40),
3. writes `premium` on `users/{uid}` in Firestore (plan, expiry date, reference),
   using a Firebase **service account** — the only thing allowed to write `premium`.

It also has a **webhook** (`/webhook`) so Paystack can tell it about payments directly,
even if the user closed the app before it finished.

It runs on **Cloudflare Workers – Free plan** (100,000 requests/day, no card needed).
It does **not** need the Firebase Blaze plan.

> Never paste your secret key or service-account file into chat, GitHub, or any code file.
> They go only into Cloudflare's **Secrets** box.

---

## Steps (works from an iPad, in Safari)

### 1. Create a free Cloudflare account
Go to <https://dash.cloudflare.com/sign-up> and sign up (email + password, verify the email).

### 2. Create the Worker
1. In the Cloudflare dashboard open **Workers & Pages → Create → Create Worker**
   (pick the "Hello World" starter).
2. Name it `curveguide-verify` and tap **Deploy**.
3. Tap **Edit code**. Delete everything in `worker.js`, paste the whole of
   [`src/worker.js`](src/worker.js) from this folder, and tap **Deploy**.
4. Copy your Worker's address. It looks like
   `https://curveguide-verify.<your-name>.workers.dev`.

### 3. Add the settings (Settings → Variables and Secrets)
Add these as **Text** (plain variables):

| Name | Value |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `curve-guide` |
| `ALLOWED_ORIGINS` | `https://curveguide.name.ng,https://thealtim8-cloud.github.io,http://localhost:8080` |
| `ALLOW_TEST_PAYMENTS` | `true` (change to `false` when you go live) |
| `REQUIRE_ID_TOKEN` | `true` |

Add these as **Secret** (encrypted):

| Name | Where to get it |
| --- | --- |
| `PAYSTACK_SECRET_KEY` | Paystack → Settings → **API Keys & Webhooks** → **Test Secret Key** (`sk_test_…`). Copy it and paste it straight into Cloudflare. |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase console → ⚙️ **Project settings → Service accounts → Generate new private key**. A `.json` file downloads. Open it (Files app), select all, copy, and paste the **whole** text into Cloudflare. Then delete the file from your Downloads. |

Tap **Deploy** / **Save** after adding them.

### 4. Check it works
Open `https://curveguide-verify.<your-name>.workers.dev/health` in Safari. You should see
`"paystackKey":"test"` and `"serviceAccount":"set"`.

### 5. Tell Paystack about the webhook
Paystack → Settings → **API Keys & Webhooks** → **Test Webhook URL**:
`https://curveguide-verify.<your-name>.workers.dev/webhook` → **Save**.

### 6. Connect the app
Send the Worker address (not any key!) to your developer/assistant. It goes into
`auth.js` as `VERIFY_URL`, then a test payment will switch Apex on for real in Firestore.

---

## Going live later
1. In Cloudflare, replace `PAYSTACK_SECRET_KEY` with the **Live Secret Key** (`sk_live_…`)
   and set `ALLOW_TEST_PAYMENTS` to `false`.
2. In Paystack, set the **Live Webhook URL** to the same `/webhook` address.
3. In `auth.js`, swap the public key to the **Live Public Key** (`pk_live_…`).

## USD
Paystack only accepts USD if USD is enabled on your Paystack account (you may have to ask
Paystack support). Until then, USD checkouts show an error in the app and ask the user to
pay in NGN.

## How the data looks
`users/{uid}.premium`:
```json
{ "active": true, "plan": "monthly", "expiresAt": "2026-11-17T10:00:00Z",
  "reference": "CG-…", "currency": "NGN", "amount": 45000, "test": true }
```
`payments/{reference}` keeps one record per payment, so a reference can never be used twice.
Both are blocked for the app by `firestore.rules`; only this server writes them.

## For developers
* `npm test` — offline test with Paystack/Google/Firestore mocked (`node test/worker.test.mjs`).
* `npx wrangler deploy` — deploy from a computer (needs Node 22+), then
  `npx wrangler secret put PAYSTACK_SECRET_KEY` and `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT`.
* Routes: `POST /verify {reference}` (Bearer Firebase ID token), `POST /webhook`, `GET /health`.
