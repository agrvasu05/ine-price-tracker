import dotenv from "dotenv";
import { scrapeProduct } from "../services/storeScraper.js";

dotenv.config();

const url = process.env.DEMO_PRODUCT_URL;
if (!url) {
  console.error("Set DEMO_PRODUCT_URL in .env before running the headed demo.");
  process.exit(1);
}

const simulateFirstFailure = String(process.env.DEMO_SIMULATE_FIRST_FAILURE).toLowerCase() === "true";

console.log("Starting headed scraper demo...");
console.log(`Target: ${url}`);
console.log(`Simulated first failure: ${simulateFirstFailure ? "ON" : "OFF"}`);

try {
  const result = await scrapeProduct(url, {
    headed: true,
    simulateFirstFailure,
    onAttempt: async (attempt) => {
      console.log(`[attempt ${attempt.attempt}] ${attempt.outcome} (${attempt.durationMs}ms)`);
      if (attempt.errorMessage) console.log(`  ${attempt.errorMessage}`);
    }
  });

  console.log("Final extracted result:");
  console.log(result);
} catch (error) {
  console.error("Demo failed after all attempts:", error.message);
  process.exitCode = 1;
}
