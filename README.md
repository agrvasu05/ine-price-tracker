# INE Product Price Tracker

This is my submission for the INE Software Engineer Intern assignment. It tracks product prices and stock on the INE demo store. A user can search for a product, add it to the tracker, and view its price history, stock history, scrape attempts, and alerts.

I used React for the frontend, Express for the API, and Supabase for storage. The product price cannot be read directly when the page loads, so the scraper uses Playwright to perform the required browser interaction before collecting it.

## Live deployment

- Frontend: [frontend-lyart-rho-95.vercel.app](https://frontend-lyart-rho-95.vercel.app)
- Backend health check: [ine-price-tracker-api-0vq3.onrender.com/health](https://ine-price-tracker-api-0vq3.onrender.com/health)

## Features

- Search the INE product catalogue by name
- Track more than one product
- Record price and stock history
- Retry failed scrapes and save every attempt
- Show price-drop and back-in-stock alerts
- Run scheduled checks every two hours through an external cron job

## Tech stack

- React and Vite
- Node.js and Express
- Playwright with Chromium
- Supabase/PostgreSQL
- Vercel for the frontend
- Render for the backend
- cron-job.org for scheduled runs

## Project structure

```text
backend/          Express API, scraper, tests and Dockerfile
frontend/         React application
supabase/         Database schema
DESIGN_NOTE.md    Notes about the implementation and trade-offs
```

## Running locally

Node.js 22 or newer is recommended.

### 1. Set up Supabase

Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor. This creates the following tables:

- `tracked_products`
- `price_history`
- `scrape_logs`
- `alerts`

### 2. Start the backend

```bash
cd backend
npm ci
npx playwright install chromium
cp .env.example .env
npm run dev
```

Fill in these values in `backend/.env`:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_random_secret
FRONTEND_URL=http://localhost:5173
```

The service-role key is only used by the backend. It should never be added to the frontend environment or committed to Git.

### 3. Start the frontend

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

The frontend environment file should contain:

```env
VITE_API_URL=http://localhost:5000/api
```

Open `http://localhost:5173` in the browser.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check whether the backend is running |
| `GET` | `/api/store/search?q=...` | Search the store catalogue |
| `GET` | `/api/products` | List tracked products |
| `POST` | `/api/products` | Add a product and run its first scrape |
| `GET` | `/api/products/:id` | Get history, logs, and alerts |
| `POST` | `/api/scrape/run` | Run the scheduled scrape batch |

The scheduled endpoint expects the cron secret in an `x-cron-secret` request header.

## Deployment notes

The backend is deployed on Render using [`backend/Dockerfile`](backend/Dockerfile). The Docker image already contains Chromium and the Linux packages Playwright needs.

For Render, set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `FRONTEND_URL`
- `STORE_BASE_URL=https://demo.inelabteamdev.com`

`FRONTEND_URL` must match the Vercel origin exactly and should not end with `/`.

For Vercel, set:

```env
VITE_API_URL=https://your-render-service.onrender.com/api
```

The cron job sends a `POST` request to:

```text
https://your-render-service.onrender.com/api/scrape/run
```

with the same `x-cron-secret` value configured on Render. It is scheduled to run once every two hours.

## Tests

Run the backend checks with:

```bash
cd backend
npm run check
npm test
```

Build the frontend with:

```bash
cd frontend
npm run build
```

There is also a headed scraper demo:

```bash
cd backend
npm run demo:headed
```

Set `DEMO_PRODUCT_URL` in `backend/.env` before running it.
