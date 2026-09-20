# INE Product Price Tracker — simplified JavaScript database version

React/Vite frontend · Express backend · Playwright scraper · Supabase-hosted PostgreSQL.

**Core:** product search and tracking, price + stock history, per-attempt scrape logs, retries, headed demonstration, and external triggering every **2 hours**.
**Exactly two optional bonus categories:** in-app price-drop/back-in-stock alerts, and a multi-product dashboard. No GitHub Actions, configurable frequency, email alerts or page-structure change detection.

## Quick start

Use Node.js 22+.

1. Create a **new Supabase project**. Run `supabase/schema.sql` in its SQL Editor. The schema uses ordinary SQL tables, indexes and constraints; **there is no PL/pgSQL function or `.rpc()` call**. If you have already applied the older schema to an existing Supabase project, these same table definitions can be reused, but the old unused function remains until you drop it explicitly. Do not drop populated tables.
2. Copy `backend/.env.example` to `backend/.env`. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and a long random `CRON_SECRET`. Keep the service-role key **only on the backend**; never put it in the frontend or Git.
3. In `backend`: `npm ci && npx playwright install chromium && npm run dev`.
4. Copy `frontend/.env.example` to `frontend/.env`. In `frontend`: `npm ci && npm run dev`. Visit the local Vite URL.
5. Search by partial or full name, track a product, then inspect its price/stock history and attempt log.

## What the code does

- Product search: `GET /api/store/search?q=...` fetches the mock store's public `/api/catalog` pages (not product prices) and filters names. The catalogue reshuffles, so this may take several passes; a complete catalogue is cached for one hour. An uncached request can take multiple minutes.
- Tracking: `POST /api/products` saves a product in Supabase, then attempts its first scrape.
- Scraping: Playwright opens the selected product page, handles cookie consent, moves the mouse over the price area, clicks Reveal price, waits for the actual selling price and stock, and validates both. Each retry opens a **fresh page** and repeats the whole interaction.
- Persistence: `backend/src/services/scrapeRunner.js` uses **ordinary Supabase `.select()`, `.insert()`, `.update()`** methods. Failed/retried attempts get a log only. On a valid success it reads the previous successful price/stock, inserts history and a success log, updates the latest dashboard fields, then inserts any qualifying in-app alerts.
- Bonus alerts: only a lower price in the same currency, or a previous out-of-stock reading becoming in-stock, creates an alert. The first successful reading never creates an alert.
- Dashboard: React shows all tracked products, their latest recorded price/stock, and a selected product's latest 100 history/log rows and latest 50 alerts.

**Important database trade-off:** the simple JavaScript calls above are **not an atomic multi-table transaction**. If a later database call fails, an earlier history or log row may already have been saved. We check every Supabase error and report a failed/incomplete request instead of claiming the whole operation committed. This is simpler to explain but is less robust than the original one-transaction PostgreSQL function. Keep to one backend instance and a small demo workload; for production-grade consistency, restore an atomic database transaction or implement reconciliation/idempotency.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Backend health |
| GET | `/api/store/search?q=laptop` | Product search |
| GET | `/api/products` | Multi-product overview |
| POST | `/api/products` | Track `{ "name": "...", "url": "..." }` |
| GET | `/api/products/:id` | History, logs and alerts |
| POST | `/api/scrape/run` | Authorized scheduled scrape trigger |

## Hosting and cron

**Follow `DEPLOYMENT_STEPS.md` for the recommended Render Docker setup and end-to-end submission procedure.** The pinned Playwright Docker image includes Chromium and its Linux system libraries; unlike native runtime, there is no separate browser installation step at build time.


- **Render backend:** choose Docker runtime with root directory `backend` and `backend/Dockerfile`. This pins the browser image to Playwright 1.63.0 from the lockfile and includes required Linux system libraries. Set the backend environment variables and `FRONTEND_URL` to your Vercel origin. The deployed container still needs to be verified on Render.
- **Vercel frontend:** root `frontend`, build `npm run build`, output directory `dist`, set `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api`.
- **cron-job.org:** POST `https://YOUR-RENDER-SERVICE.onrender.com/api/scrape/run` every **2 hours** with request header `x-cron-secret: YOUR_CRON_SECRET`. Do not rely on an always-on Node loop on a sleeping free-tier backend. The in-memory overlap guard works on **one** backend process, not across multiple replicas. Check whether the scheduler's HTTP timeout is long enough for a cold start and a small batch of products; inspect backend logs if a request times out.

## Tests and demo

In `backend`: `npm run check`, `npm test`. `npm run test:live` contacts the real mock store and requires a working browser environment. The unit tests include **mocked**, not real, database writes. In `frontend`: `npm run build`.

For the required **headed** demo, set `DEMO_PRODUCT_URL` in backend `.env` and run `npm run demo:headed`. Set `DEMO_SIMULATE_FIRST_FAILURE=true` if you want an injected HTTP 503 on the first product-data request; identify it as a **simulated** failure in your recording. The demo does not write to Supabase.

**Before submission, personally verify:** search and scraping on the real INE store; Supabase writes/reads and both bonuses; Chromium on Render; the deployed frontend; two actual cron triggers at the two-hour schedule; and the 2–4 minute headed recording. This ZIP does **not** deploy your app, create your GitHub repo, provide a recording, or include your PDF resume.

Submit the hosted site URL, public GitHub repo URL, recording, README, truthful design note describing actual AI-assisted corrections, and your resume according to the assignment's instructions.
