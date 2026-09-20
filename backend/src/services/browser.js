import { chromium } from "playwright";

let sharedBrowser = null;

export async function getSharedBrowser() {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({ headless: true });
  }
  return sharedBrowser;
}

export async function createHeadedBrowser() {
  return chromium.launch({
    headless: false,
    slowMo: 200
  });
}

export async function closeSharedBrowser() {
  if (sharedBrowser?.isConnected()) {
    await sharedBrowser.close();
  }
  sharedBrowser = null;
}
