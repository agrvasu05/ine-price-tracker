import express from "express";
import cors from "cors";
import { assertBackendEnv, env } from "./config/env.js";
import productsRouter from "./routes/products.js";
import storeRouter from "./routes/store.js";
import scrapeRouter from "./routes/scrape.js";
import { closeSharedBrowser } from "./services/browser.js";

assertBackendEnv();

const app = express();
const allowedOrigins = env.frontendUrl.split(",").map((value) => value.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ success: true, service: "INE Price Tracker API" });
});

app.use("/api/store", storeRouter);
app.use("/api/products", productsRouter);
app.use("/api/scrape", scrapeRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const message = process.env.NODE_ENV === "production"
    ? "Request failed"
    : String(error?.message || error);
  res.status(500).json({ error: message });
});

const server = app.listen(env.port, () => {
  console.log(`INE Price Tracker API listening on port ${env.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);
  server.close(async () => {
    await closeSharedBrowser().catch(() => {});
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
