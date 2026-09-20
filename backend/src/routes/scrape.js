import { Router } from "express";
import { env } from "../config/env.js";
import { runScheduledScrapes } from "../services/scrapeRunner.js";

const router = Router();

router.post("/run", async (req, res, next) => {
  try {
    const suppliedSecret = req.get("x-cron-secret");
    if (!suppliedSecret || suppliedSecret !== env.cronSecret) {
      return res.status(401).json({ error: "Unauthorized cron request" });
    }

    const summary = await runScheduledScrapes();
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
});

export default router;
