
# Design note

I kept the app as a React frontend, an Express backend and a Supabase database. Product search uses the mock store's catalogue endpoint. I used Playwright for the product page because the current price is not available just by loading the HTML: the page needs a mouse interaction before the price is revealed.

## Scraping and retries

The scraper opens a fresh page for each attempt. It checks the navigation response, handles the cookie prompt, moves the mouse over the price area and activates the price-reveal control. It reads the visible selling price and stock state rather than taking the first price-looking text on the page. This matters because the page can also contain a hidden price, an old crossed-out price or a temporary loading message.

If navigation, interaction or extraction fails, the attempt is recorded and the scraper tries again, up to three times. It never inserts a price-history row for a failed extraction. Each attempt closes its page. The headed browser closes at the end of the demo; the backend may reuse its headless browser while it is running. The headed demo also has an **optional simulated first HTTP 503**, clearly marked as simulated, so retry behavior can be shown on demand.

## Database and schedule

I used ordinary SQL tables for tracked products, price history, scrape logs and alerts. The backend reads and writes them through the Supabase JavaScript client. This keeps most of the application logic in JavaScript, which makes it easier for me to trace and change.

The trade-off is that these separate writes are not one transaction. A history insert could succeed before a later log or dashboard update fails. The code checks for database errors instead of reporting the whole operation as successful, but it does not provide a full rollback. For a larger system, I would group related writes into one transaction and make repeated requests idempotent.

A protected endpoint is triggered by cron-job.org every two hours. This avoids relying on a `setInterval` loop in a Render free-tier web service that can sleep. The app keeps the most recent successful reading separately from its individual scrape attempts.

## What I changed while using AI tools

The first generated version assumed that products would be found through ordinary product links. Searches returned no results. I changed the search code to use the mock store's catalogue endpoint and filter product names there.

The first price scraper also assumed the price would eventually appear if it waited long enough. That was not enough: the store requires interaction to reveal it. I changed the scraper to perform the necessary mouse movement and button interaction on each attempt, then validate the visible current price before saving it.

I also replaced an earlier PostgreSQL function with straightforward Supabase JavaScript queries. That reduced the amount of database-specific code, but I have documented the loss of transaction-level atomicity rather than treating the two approaches as equivalent.

## Verification

I confirmed on my deployed app that product search returned results and that tracking Vista Monitor Lite saved a current price and stock state in Supabase. I also ran a cron-job.org test that returned HTTP 200. The HTTP status alone does not establish that a complete two-hour unattended run or both alert conditions were successful; these require checking the corresponding database rows and execution logs. The headed recording is a separate local demonstration and is not the same as a Render cron run.
