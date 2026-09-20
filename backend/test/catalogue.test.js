import test from "node:test";
import assert from "node:assert/strict";
import { searchStore } from "../src/services/storeScraper.js";

test("product search collects unique IDs from reshuffled catalogue pages", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount++;
    // A reshuffled page repeats ID 1 before returning IDs 2 and 3.
    const items = requestCount === 1 ? [{ id: 1, name: "Laptop" }] :
      [{ id: 1, name: "Laptop" }, { id: 2, name: "Mouse" }, { id: 3, name: "Keyboard" }];
    return { ok: true, json: async () => ({ items, total: 3, pages: 1 }) };
  };
  try {
    const partial = await searchStore("mou");
    assert.deepEqual(partial, [{ name: "Mouse", url: "https://demo.inelabteamdev.com/product/2" }]);
    const full = await searchStore("Keyboard");
    assert.equal(full.length, 1);
    assert.equal(full[0].url, "https://demo.inelabteamdev.com/product/3");
    assert.equal(requestCount, 2, "the second search should reuse the complete cached catalogue");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
