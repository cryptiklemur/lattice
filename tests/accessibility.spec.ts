import { test, expect } from "@playwright/test";

test.beforeEach(async function ({ page }) {
  await page.evaluate(function () {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        registrations.forEach(function (r) { r.unregister(); });
      });
    }
    caches.keys().then(function (names) {
      names.forEach(function (name) { caches.delete(name); });
    });
  });
});

test.describe("Focus and modal behavior", function () {
  test("Add Project modal traps focus", async function ({ page }) {
    await page.goto("/");
    await page.waitForSelector("[title='Lattice Dashboard']", { timeout: 10000 });

    var addButton = page.locator("button[title='Add project']");
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();
    await page.waitForTimeout(500);

    var modal = page.locator("[role='dialog'][aria-label='Add Project']");
    await expect(modal).toBeVisible({ timeout: 5000 });

    var pathInput = modal.locator("#project-path");
    await expect(pathInput).toBeFocused();

    var focusableElements = modal.locator(
      "input, button, [tabindex]:not([tabindex='-1'])"
    );
    var focusableCount = await focusableElements.count();

    for (var i = 0; i < focusableCount + 2; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(50);
    }

    var activeElement = page.locator(":focus");
    var activeInModal = await modal.locator(":focus").count();
    expect(activeInModal).toBeGreaterThan(0);
  });

  test("Escape closes the Add Project modal", async function ({ page }) {
    await page.goto("/");
    await page.waitForSelector("[title='Lattice Dashboard']", { timeout: 10000 });

    var addButton = page.locator("button[title='Add project']");
    await addButton.click();
    await page.waitForTimeout(500);

    var modal = page.locator("[role='dialog'][aria-label='Add Project']");
    await expect(modal).toBeVisible({ timeout: 5000 });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await expect(modal).not.toBeVisible();
  });

  test("connection status dot is present on the Lattice logo", async function ({ page }) {
    await page.goto("/");
    await page.waitForSelector("[title='Lattice Dashboard']", { timeout: 10000 });

    var dashboardButton = page.locator("[title='Lattice Dashboard']");
    await expect(dashboardButton).toBeVisible();

    var statusDot = dashboardButton.locator("div.rounded-full.border-\\[1\\.5px\\]");
    await expect(statusDot).toBeVisible();

    var dotClasses = await statusDot.getAttribute("class");
    expect(dotClasses).toMatch(/bg-success|bg-warning|bg-error/);
  });
});
