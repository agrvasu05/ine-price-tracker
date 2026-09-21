import { Router } from "express";
import { env } from "../config/env.js";
import { runScheduledScrapes } from "../services/scrapeRunner.js";

const router = Router();

router.post("/run", async (req, res) => {
  const suppliedSecret = req.get("x-cron-secret");

  if (!suppliedSecret || suppliedSecret !== env.cronSecret) {
    return res.status(401).json({
      error: "Unauthorized cron request"
    });
  }

  try {
    // Run the scheduled scraper and wait for it to finish.
    await runScheduledScrapes();

    // Cron-job.org only needs a small response.
    return res.status(200).json({
      ok: true,
      message: "Scrape run finished"
    });
  } catch (error) {
    console.error("Scheduled scrape error:", error);

    // Keep error responses small too.
    return res.status(500).json({
      ok: false,
      message: "Scheduled scrape failed"
    });
  }
});

export default router;