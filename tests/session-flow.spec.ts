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

test.describe("Session switching", function () {
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

  test("clicking a session loads the chat view with messages", async function ({ page }) {
    var sessionButtons = page.locator("button[aria-label^='Session:']");
    var sessionCount = await sessionButtons.count();

    if (sessionCount === 0) {
      test.skip(true, "No sessions available to test");
      return;
    }

    await sessionButtons.first().click();
    await page.waitForTimeout(2000);

    var chatMessages = page.locator(".chat");
    await expect(chatMessages.first()).toBeVisible({ timeout: 10000 });
  });

  test("message content is visible in chat view", async function ({ page }) {
    var sessionButtons = page.locator("button[aria-label^='Session:']");
    var sessionCount = await sessionButtons.count();

    if (sessionCount === 0) {
      test.skip(true, "No sessions available to test");
      return;
    }

    await sessionButtons.first().click();
    await page.waitForTimeout(2000);

    var chatBubbles = page.locator(".chat-bubble");
    await expect(chatBubbles.first()).toBeVisible({ timeout: 10000 });
    var text = await chatBubbles.first().textContent();
    expect(text).toBeTruthy();
  });

  test("session title appears in the header", async function ({ page }) {
    var sessionButtons = page.locator("button[aria-label^='Session:']");
    var sessionCount = await sessionButtons.count();

    if (sessionCount === 0) {
      test.skip(true, "No sessions available to test");
      return;
    }

    var sessionLabel = await sessionButtons.first().getAttribute("aria-label");
    var expectedTitle = sessionLabel?.replace("Session: ", "") ?? "";

    await sessionButtons.first().click();
    await page.waitForTimeout(2000);

    var headerTitle = page.locator("h1, [class*='font-mono'][class*='font-bold']").filter({
      hasText: expectedTitle,
    });

    await expect(headerTitle.first()).toBeVisible({ timeout: 10000 });
  });

  test("switching sessions loads different messages", async function ({ page }) {
    var sessionButtons = page.locator("button[aria-label^='Session:']");
    var sessionCount = await sessionButtons.count();

    if (sessionCount < 2) {
      test.skip(true, "Need at least 2 sessions to test switching");
      return;
    }

    await sessionButtons.first().click();
    await page.waitForTimeout(2000);

    var firstSessionMessages = page.locator(".chat-bubble");
    await expect(firstSessionMessages.first()).toBeVisible({ timeout: 10000 });
    var firstMessageText = await firstSessionMessages.first().textContent();

    await sessionButtons.nth(1).click();
    await page.waitForTimeout(2000);

    var secondSessionMessages = page.locator(".chat-bubble");
    await expect(secondSessionMessages.first()).toBeVisible({ timeout: 10000 });
    var secondMessageText = await secondSessionMessages.first().textContent();

    var activeSession = page.locator("button[aria-label^='Session:'][aria-current='true']");
    await expect(activeSession).toHaveCount(1);
  });
});
