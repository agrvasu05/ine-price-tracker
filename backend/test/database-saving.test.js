import test from "node:test";
import assert from "node:assert/strict";

// No real credentials or network needed: the Supabase client is replaced by a tiny mock.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-key";
process.env.CRON_SECRET = "local-test-cron-secret";
const { saveAttempt } = await import("../src/services/scrapeRunner.js");

function mockDatabase(previous = [], failedTable = "") {
  const writes = [];
  return {
    writes,
    from(table) {
      return {
        insert: async (value) => {
          writes.push({ table, operation: "insert", value });
          return { error: table === failedTable ? { message: `Mock ${table} unavailable` } : null };
        },
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: previous, error: null })
            })
          })
        }),
        update: (value) => ({
          eq: async () => {
            writes.push({ table, operation: "update", value });
            return { error: table === failedTable ? { message: `Mock ${table} unavailable` } : null };
          }
        })
      };
    }
  };
}

const success = {
  attempt: 2, outcome: "success", durationMs: 950,
  errorMessage: null,
  data: { name: "Laptop", price: 900, currency: "INR", inStock: true }
};

test("failed attempts create a log and never insert price history", async () => {
  const db = mockDatabase();
  await saveAttempt("product-1", { attempt: 1, outcome: "retried", durationMs: 400, errorMessage: "Timeout" }, db);
  assert.deepEqual(db.writes.map(({ table }) => table), ["scrape_logs"]);
  assert.equal(db.writes[0].value.outcome, "retried");
});

test("successful attempt writes history, log, latest data and both bonus alerts", async () => {
  const db = mockDatabase([{ price: "1000.00", currency: "INR", in_stock: false }]);
  await saveAttempt("product-1", success, db);
  assert.deepEqual(db.writes.map(({ table }) => table),
    ["price_history", "scrape_logs", "tracked_products", "alerts"]);
  assert.deepEqual(db.writes[3].value.map(({ kind }) => kind), ["price_drop", "back_in_stock"]);
  assert.equal(db.writes[0].value.price, 900);
});

test("first successful reading does not invent alerts", async () => {
  const db = mockDatabase();
  await saveAttempt("product-1", success, db);
  assert.equal(db.writes.some(({ table }) => table === "alerts"), false);
});

test("incomplete successful reading is rejected before database writes", async () => {
  const db = mockDatabase();
  await assert.rejects(() => saveAttempt("product-1", {
    ...success, data: { name: "Laptop", price: NaN, currency: "INR", inStock: true }
  }, db), /incomplete/);
  assert.equal(db.writes.length, 0);
});

test("database write errors propagate rather than being presented as success", async () => {
  const db = mockDatabase([], "price_history");
  await assert.rejects(() => saveAttempt("product-1", success, db), /unavailable/);
  assert.deepEqual(db.writes.map(({ table }) => table), ["price_history"]);
});

test("price changes in different currencies do not trigger a price-drop alert", async () => {
  const db = mockDatabase([{ price: "1000.00", currency: "USD", in_stock: true }]);
  await saveAttempt("product-1", success, db);
  assert.equal(db.writes.some(({ table }) => table === "alerts"), false);
});
