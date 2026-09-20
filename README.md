# INE Product Price Tracker — simplified JavaScript database version

React/Vite frontend · Express backend · Playwright scraper · Supabase-hosted PostgreSQL.

**Core:** product search and tracking, price + stock history, per-attempt scrape logs, retries, headed demonstration, and external triggering every **2 hours**.
**Exactly two optional bonus categories:** in-app price-drop/back-in-stock alerts, and a multi-product dashboard. No GitHub Actions, configurable frequency, email alerts or page-structure change detection.

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

