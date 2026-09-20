import test from "node:test";
import assert from "node:assert/strict";
import { parsePrice } from "../src/services/storeScraper.js";
import { normalizeAndValidateStoreUrl } from "../src/utils/storeUrl.js";

for (const text of ["₹12,345", "₹12 345", "₹12.345,00", "₹12,345/- (incl. of all taxes)", "₹１２,３４５", "₹\u00a01\u200b2,345", "Rs. 12,345.00"]) {
  test(`reads store price format ${text}`, () => assert.deepEqual(parsePrice(text), { price: 12345, currency: "INR" }));
}
test("Indian grouping and decimal amounts", () => {
  assert.equal(parsePrice("Rs. 1,23,456.50").price, 123456.5);
  assert.deepEqual(parsePrice("$10.25"), { price: 10.25, currency: "USD" });
});
test("does not guess a price from unrelated text", () => {
  for (const value of ["", "20% off", "4.2 stars", "Loading…", "Deal price ₹120", "₹-10", "₹10 and ₹20", "NaN", "₹1,,234", "₹1,2,3"]) assert.throws(() => parsePrice(value));
});
test("accepts only INE product URLs", () => {
  assert.equal(normalizeAndValidateStoreUrl("/product/831"), "https://demo.inelabteamdev.com/product/831");
  for (const value of [undefined, "", "/", "/api/catalog", "https://example.com/product/1", "http://demo.inelabteamdev.com/product/1", "https://user:pass@demo.inelabteamdev.com/product/1"]) assert.throws(() => normalizeAndValidateStoreUrl(value));
});
