import { env } from "../config/env.js";

export function normalizeAndValidateStoreUrl(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Product URL is required");
  const url = new URL(value, env.storeBaseUrl);
  if (url.origin !== new URL(env.storeBaseUrl).origin || !/^\/item\/[1-9]\d*$/.test(url.pathname) || url.username || url.password) {
    throw new Error("Use an INE mock-store product URL");
  }
  return url.origin + url.pathname;
}
