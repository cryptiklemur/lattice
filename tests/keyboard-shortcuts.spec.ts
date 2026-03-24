import { test, expect } from "@playwright/test";

test.beforeEach(async function ({ page }) {
  await page.evaluate(function () {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        registrations.forEach(function (r) { r.unregister(); });
      });
    }
    if (typeof caches !== "undefined") caches.keys().then(function (names) {
      names.forEach(function (name) { caches.delete(name); });
    });
  });
});

test.describe("Keyboard interactions", function () {
  test("pressing ? opens the shortcuts overlay", async function ({ page }) {
    await page.goto("/");
    await page.waitForSelector("[title='Lattice Dashboard']", { timeout: 10000 });

    await page.keyboard.press("?");
    await page.waitForTimeout(300);

    var shortcutsHeading = page.locator("text='Keyboard Shortcuts'");
    await expect(shortcutsHeading).toBeVisible({ timeout: 5000 });
  });

  test("pressing Escape closes the shortcuts overlay", async function ({ page }) {
    await page.goto("/");
    await page.waitForSelector("[title='Lattice Dashboard']", { timeout: 10000 });

    await page.keyboard.press("?");
    await page.waitForTimeout(300);

    var shortcutsHeading = page.locator("text='Keyboard Shortcuts'");
    await expect(shortcutsHeading).toBeVisible({ timeout: 5000 });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await expect(shortcutsHeading).not.toBeVisible();
  });

  test("Ctrl+K opens the command palette", async function ({ page }) {
    await page.goto("/");
    await page.waitForSelector("[title='Lattice Dashboard']", { timeout: 10000 });

    await page.keyboard.press("Control+k");
    await page.waitForTimeout(300);

    var paletteInput = page.locator("input[placeholder*='command']");
    await expect(paletteInput.first()).toBeVisible({ timeout: 5000 });
  });

  test("Escape closes the command palette", async function ({ page }) {
    await page.goto("/");
    await page.waitForSelector("[title='Lattice Dashboard']", { timeout: 10000 });

    await page.keyboard.press("Control+k");
    await page.waitForTimeout(300);

    var paletteInput = page.locator("input[placeholder*='command']");
    await expect(paletteInput.first()).toBeVisible({ timeout: 5000 });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await expect(paletteInput.first()).not.toBeVisible();
  });
});
