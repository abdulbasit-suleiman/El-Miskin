# El-Miskin QR Verification

Single-use QR product authentication for manufacturers.

- **Public:** `/verify/[code]` (scan → genuine / already used / invalid) and `/login`.
- **Private (manufacturer login required):** dashboard, products, batches, QR generation, analytics, account & team management.
- Codes are crypto-random: `PREFIX-XXXXXXXXXXXXXXXX` (96 bits of entropy).
- Deployed on **Vercel** (Next.js 14 App Router + Firebase Firestore/Auth).
- **Live:** https://el-miskin.vercel.app (Vercel project `el-miskin`, connected to the GitHub repo).

---

## 1. Required environment variables

Create `.env.local` for local development, and paste the same values into
**Vercel → Project → Settings → Environment Variables** (Production + Preview).

| Variable | Public? | Where to get it |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | yes | Firebase console → Project settings → General → Your apps → Web app |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | yes | same place |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | yes | same place |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | yes | same place |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | yes | same place |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | yes | same place |
| `NEXT_PUBLIC_APP_URL` | yes | `http://localhost:3000` locally; your production URL (`https://xxx.vercel.app`) on Vercel |
| `FIREBASE_ADMIN_PROJECT_ID` | no | Firebase console → Project settings → Service accounts → Generate new private key (JSON) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | no | same JSON (`client_email`) |
| `FIREBASE_ADMIN_PRIVATE_KEY` | no | same JSON (`private_key`) — keep the `\n` sequences on one line |
| `CRON_SECRET` | no | any long random string you invent. Vercel sends it as `Authorization: Bearer <value>` to the daily purge job |

`NEXT_PUBLIC_*` values are baked in at **build time** — after changing them,
redeploy. `NEXT_PUBLIC_APP_URL` determines what each QR code encodes
(`{APP_URL}/verify/{code}`), so set it to the production URL **before**
generating codes that will be printed.

A template with every variable is in `.env.example`.

---

## 2. Firebase setup (one-time)

1. **Enable Authentication** → Sign-in method → **Email/Password** → Enable.
2. **Create a Firestore database** (production mode).
3. **Publish the security rules:** Firestore → Rules → replace everything with
   the contents of [`firestore.rules`](firestore.rules) → **Publish**.

The rules only allow the dashboard to *read* the signed-in account's own data.
Every write (products, batches, codes, accounts) happens server-side in the API
routes through the Admin SDK and is validated there.

**No composite indexes are required.** All client queries use a single equality
filter and sort in the browser (see §6).

---

## 3. Create the first manufacturer (owner) account

Public signup is intentionally disabled. Provision owners from a terminal:

```bash
npm install
npm run create-owner -- owner@yourbrand.com "StrongPassword123" "Brand Name"
```

Log in at `/login`. From **Account** the owner can:
- edit their name, email and password,
- add **sub-admins** (role `admin`) who can create products/batches and see
  analytics but cannot delete the owner or manage other members,
- deactivate a sub-admin (their Firebase Auth user is disabled and existing
  sessions are revoked).

---

## 4. Local development

```bash
npm run dev          # http://localhost:3000
npm run seed:dev     # dev-only: owner + "Milo" product + 10 codes (terminal only)
```

`seed:dev` creates `dev@elmiskin.local` / `dev-password-123` and prints the
generated `/verify/...` URLs. It is a CLI script — there is **no** seed button
in the app.

---

## 5. How the product flow works

1. **Overview → Create product** (or *Products → New product*).
2. Enter the product name and code prefix (e.g. `Milo` / `ML`).
3. **Confirm screen** shows both values and an example code before anything is
   saved.
4. On the product page, generate a batch (1–1000 codes). The API writes the
   batch + codes with the Admin SDK, then **reads the count back** to verify the
   save; the UI reports `Saved N codes to the database`.
5. Download **CSV** (code list) or **ZIP** (one PNG per code, 512px, plus CSV).
6. Scanning a code (first time → genuine; again → already used; unknown →
   invalid) updates live stats and the weekly chart.
7. **Product settings** lets you rename the product or change the prefix;
   changing the prefix shows a warning that already-printed codes keep their
   old prefix.
8. **Search** (top of every dashboard page) looks only inside your own account.
   Type an exact code to see its status, first scan time and scan count, or
   type a batch name, a batch id or a product name. Results are grouped into
   Codes, Batches and Products, and an empty result shows a clear "No results
   found" panel.
9. Clicking a batch opens its detail page: stats for the batch, its codes with
   QR thumbnails, and the CSV / ZIP exports.
10. **Product settings → Delete this product** asks for three typed checks (the
    product name, then `DELETE <name>`, then a random confirmation code) plus a
    final browser confirmation. Confirming does **not** erase anything right
    away: the product is marked with `deletionScheduledAt` and `purgeAt`
    (`now + 48 hours`), so every code, batch and scan log stays intact for
    48 hours.
11. While a product waits, it is hidden from search and from the product lists,
    and renaming it or generating more codes is blocked. Its detail page, batch
    page and settings page show an amber **Scheduled for deletion** banner with
    the exact purge time.
12. **Products → Pending deletion (N)** lists everything waiting. Each row shows
    the remaining hours plus two actions:
    - **Restore** clears the schedule and the product is active again,
    - **Delete now** skips the rest of the grace period after you retype the
      product name, and erases the product tree immediately.
13. When the 48 hours are over the product tree is removed permanently. Two
    things trigger this: the daily cron job (`vercel.json` → 03:00 UTC,
    `GET /api/cron/purge-products`) and any load of `/api/products/pending`,
    which purges expired rows first so a product cannot linger by accident.
    There is no undo after the purge.

---

## 6. Performance notes

- Dashboard lists fetch at most 100 products / 100 batches and sort client-side
  (no `orderBy` combos → no index setup).
- Batch codes load 24 at a time with a "Load more" button.
- QR thumbnails are lazy-loaded; ZIP export shows a "Building ZIP…" state.
- The verify page is server-rendered with zero client JavaScript.
- Search runs on Firestore equality filters plus single-field range queries on
  the code document id and on `batches.nameLower`. Both are indexed
  automatically, so **no composite index has to be deployed**, and no
  collection is downloaded just to filter it in the browser.
- The purge job queries `products.purgeAt <= now`, a single-field range that
  Firestore indexes on its own. It runs in batches of 50 products per call.

---

## 7. Deploy to Vercel

**Current status:** deployed at <https://el-miskin.vercel.app> (project
`el-miskin` on team `erekerecancel-9972s-projects`). All 11 variables from §1
are set for the **Production** environment, and the repo is connected to
GitHub — pushing to the default branch redeploys automatically.

Steps to reproduce from scratch:

1. Push this repo to GitHub (or run `vercel` in this folder).
2. In Vercel: **Add New → Project → Import** the repository.
3. Framework preset: **Next.js** (defaults are fine; no build tweaks needed).
4. Add every environment variable from §1 (including
   `NEXT_PUBLIC_APP_URL=https://<your-app>.vercel.app`). Values that start with
   a dash (the service-account private key) must be pasted into the dashboard —
   `vercel env add --value` treats them as flags.
5. **Deploy.**
6. In Firebase → Authentication → Settings → **Authorized domains**, add your
   Vercel domain (`el-miskin.vercel.app` is already listed).
7. Publish the Firestore rules (§2) **before** handing the app to users — the
   dashboard's live lists read Firestore directly from the browser.
8. Log in on the deployed URL and generate a test batch.
9. `vercel.json` registers a daily cron (`0 3 * * *`) that hits
   `/api/cron/purge-products`, so expired grace periods are cleared even if
   nobody opens the dashboard. Set `CRON_SECRET` first: Vercel sends it as
   `Authorization: Bearer <value>` and the route rejects anything else.

Serverless notes: ZIP/CSV exports are generated **fully in memory** (no temp
files), so they work on Vercel. The ZIP route sets `maxDuration = 60` for large
batches (available on Pro; Hobby allows 10 s — a 20-code ZIP takes ~2 s
in production).

CLI deployment (what was used here):

```bash
vercel link --project el-miskin
# set env vars in the dashboard, then:
vercel deploy --prod
```

---

## 8. API surface (all private routes require a Firebase ID token)

| Route | Who | Purpose |
| --- | --- | --- |
| `GET /api/account` | any member | own profile + role |
| `PATCH /api/account` | any member | update name / sync email |
| `GET/POST /api/account/sub-admins` | owner | list / create sub-admins |
| `PATCH /api/account/sub-admins/[uid]` | owner | activate / deactivate |
| `POST /api/products` | any member | create product |
| `PATCH /api/products/[id]` | any member | rename / change prefix |
| `DELETE /api/products/[id]` | any member | schedule deletion in 48 hours (`confirmName` must match the product name) |
| `POST /api/products/[id]/restore` | any member | cancel a scheduled deletion |
| `POST /api/products/[id]/purge` | any member | delete the product tree immediately (`confirmName` required) |
| `GET /api/products/pending` | any member | products waiting for purge, expired ones removed first |
| `GET/POST /api/cron/purge-products` | `CRON_SECRET` bearer or any member | purge everything past `purgeAt` |
| `GET /api/search?q=…` | any member | codes, batches and products of the caller's account |
| `GET /api/batches/[id]` | any member | batch details plus status counts |
| `POST /api/generate-codes` | any member | create batch + verify save |
| `GET /api/download/csv` | any member | batch CSV |
| `GET /api/download/zip` | any member | batch ZIP of QR PNGs + CSV |
| `GET /api/qr?code=…` | public | single QR PNG (the URL inside it is public anyway) |
| `GET /verify/[code]` | public | scan result page (rate limited: 10 / 10 s / IP) |

A deactivated sub-admin is rejected by every endpoint (`403`) and their Firebase
Auth user is disabled by the owner's action.

---

## 9. Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | local dev server |
| `npm run build` / `npm start` | production build / serve |
| `npm run create-owner -- <email> <password> ["Name"]` | provision an owner account |
| `npm run seed:dev` | dev-only sample product + codes |

> Rotate the service-account key periodically (Firebase console → Service
> accounts → delete old keys, generate a new one, update the env vars) and
> redeploy.
