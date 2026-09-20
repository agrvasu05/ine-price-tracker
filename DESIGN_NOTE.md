# Design note — simplified JavaScript/Supabase implementation

## Architecture

React calls Express for product search and tracking, history, logs and alerts. The backend retrieves names from the mock store's public catalogue with Node `fetch`; actual prices/stock come only from Playwright interactions with the live product page. The external cron service calls a secret-protected Express endpoint every two hours. Supabase stores tracked products, successful price history and every scrape attempt. The two bonuses are in-app price-drop/back-in-stock alerts and a multi-product overview.

## Scraper reliability

Each retry opens a fresh page. The scraper checks navigation status, dismisses cookie consent, performs the mock store's required repeated mouse movement before revealing price, handles its update/error messages, and reads only the visible current selling price and stock badge. It excludes hidden decoys, MRP and deal labels. Invalid or ambiguous data causes an error and cannot create price history. Each failed/retried attempt is recorded; database logging failure is propagated rather than causing an unsafe retry.

## Simple SQL and JavaScript trade-off

The schema uses four plain SQL tables with primary/foreign keys, basic checks, indexes and RLS. **It contains no PL/pgSQL function.** Express persists data with Supabase JS `.select()`, `.insert()` and `.update()` calls. Price-drop/back-in-stock comparisons also occur in straightforward JavaScript.

Unlike the former database function, separate Supabase calls **are not one transaction**. An alert, log or dashboard update can fail after history has already been inserted. We check every write result and report incomplete operations; we do not claim to have implemented atomic rollback, distributed locking or guaranteed idempotency. For a larger production system, transactional persistence and reconciliation would be the next reliability improvements. The service-role key remains exclusively on Express; it is never shipped to the browser.

## What changed from the earlier AI-generated version

The early generated scraper assumed products appeared as anchor links and that prices would appear after waiting. Examination of the mock store indicated button-based product cards and a required mouse interaction to reveal prices. Search now uses the public catalogue endpoint, while Playwright repeats the actual interaction on each attempt. Extraction was narrowed to the visible current selling price to avoid decoys and crossed-out prices. The previous PL/pgSQL saving function was replaced with readable, independent Supabase JavaScript queries to reduce concepts needed for the internship interview, with the loss of transaction atomicity documented above.

## Verification limits

Unit tests are local and use a mocked database client. The revised application still requires live testing against the mock store, a real Supabase project, deployment to Render/Vercel, the two-hour external cron and a real headed screen recording. Do not claim those steps succeeded unless you observe them on your own deployment.
