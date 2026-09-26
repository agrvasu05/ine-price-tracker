import { Router } from "express";
import { env } from "../config/env.js";
import { runScheduledScrapes } from "../services/scrapeRunner.js";

const router = Router();

// Called by the scheduler every two hours.
// A full batch takes a few minutes (Playwright + retries), but schedulers such as
// cron-job.org give up after ~30 seconds. So we reply immediately with 202 and let
// the batch keep running in the background. Results are still saved to Supabase
// (scrape_logs / price_history), so nothing is lost by not waiting.
router.post("/run", (req, res) => {
  const suppliedSecret = req.get("x-cron-secret");

  if (!suppliedSecret || suppliedSecret !== env.cronSecret) {
    return res.status(401).json({ error: "Unauthorized cron request" });
  }

  runScheduledScrapes()
    .then((summary) => {
      if (summary?.skipped) {
        console.log(`Scheduled scrape skipped: ${summary.reason}`);
      } else {
        const failed = (summary?.results || []).filter((r) => !r.ok).length;
        console.log(`Scheduled scrape finished: ${summary?.checked ?? 0} products, ${failed} failed`);
      }
    })
    .catch((error) => console.error("Scheduled scrape error:", error));

  return res.status(202).json({ ok: true, message: "Scrape run started" });
});

export default router;
