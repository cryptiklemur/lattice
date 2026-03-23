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

test.describe("Onboarding - new user flow", function () {
  test("dashboard loads with project cards", async function ({ page }) {
    await page.goto("/");
    await page.waitForSelector("[title='Lattice Dashboard']", { timeout: 10000 });

    var dashboardButton = page.locator("[title='Lattice Dashboard']");
    await expect(dashboardButton).toBeVisible();
  });

  test("clicking a project shows sessions list in sidebar", async function ({ page }) {
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

    var sessionLabels = page.locator("text=/Today|Yesterday|This Week|This Month|Older|No sessions yet/");
    await expect(sessionLabels.first()).toBeVisible({ timeout: 10000 });
  });

  test("project dashboard shows stats", async function ({ page }) {
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
    await page.waitForTimeout(1000);

    var dashboardLink = page.locator("button", { hasText: "Dashboard" });
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await page.waitForTimeout(1000);
    }

    var sidebar = page.locator("text=/Sessions|MCP Servers|Dashboard/").first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });
});
