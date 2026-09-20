import { Router } from "express";
import { searchStore } from "../services/storeScraper.js";

const router = Router();

router.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q.length) {
      return res.status(400).json({ error: "Enter a product name" });
    }

    const products = await searchStore(q);
    return res.json({ products });
  } catch (error) {
    return next(error);
  }
});

export default router;
