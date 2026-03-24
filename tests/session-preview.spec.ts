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

test.describe("Sidebar hover preview", function () {
  test.beforeEach(async function ({ page }) {
    await page.goto("/");
    await page.waitForSelector("[title='Lattice Dashboard']", { timeout: 10000 });

    var projectButtons = page.locator("button:has(svg[aria-hidden='true'])").filter({
      has: page.locator("text=/^[A-Z]{2,3}$/"),
    });

    var count = await projectButtons.count();
    if (count === 0) {
      test.skip(true, "No projects available to test");
      return;
    }

    await projectButtons.first().click();
    await page.waitForTimeout(1500);
  });

  test("hovering a session shows a preview popover with stats", async function ({ page }) {
    var sessionButtons = page.locator("button[aria-label^='Session:']");
    var sessionCount = await sessionButtons.count();

    if (sessionCount === 0) {
      test.skip(true, "No sessions available to test");
      return;
    }

    await sessionButtons.first().hover();
    await page.waitForTimeout(500);

    var previewPopover = page.locator(".fixed.z-\\[9999\\].w-\\[270px\\]");
    await expect(previewPopover).toBeVisible({ timeout: 5000 });

    var costIndicator = previewPopover.locator("text=/\\$[0-9]|<\\$0\\.01/");
    await expect(costIndicator).toBeVisible({ timeout: 5000 });

    var durationIndicator = previewPopover.locator("text=/\\d+[smh]/");
    await expect(durationIndicator).toBeVisible({ timeout: 5000 });

    var messageCountIndicator = previewPopover.locator("text=/\\d+ msgs/");
    await expect(messageCountIndicator).toBeVisible({ timeout: 5000 });

    var modelIndicator = previewPopover.locator("text=/claude|sonnet|opus|haiku|unknown/i");
    await expect(modelIndicator).toBeVisible({ timeout: 5000 });
  });

  test("preview disappears when mouse leaves the session", async function ({ page }) {
    var sessionButtons = page.locator("button[aria-label^='Session:']");
    var sessionCount = await sessionButtons.count();

    if (sessionCount === 0) {
      test.skip(true, "No sessions available to test");
      return;
    }

    await sessionButtons.first().hover();
    await page.waitForTimeout(500);

    var previewPopover = page.locator(".fixed.z-\\[9999\\].w-\\[270px\\]");
    await expect(previewPopover).toBeVisible({ timeout: 5000 });

    await page.locator("[title='Lattice Dashboard']").hover();
    await page.waitForTimeout(300);

    await expect(previewPopover).not.toBeVisible();
  });
});
