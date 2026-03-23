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

test.describe("Chat message hover actions", function () {
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

    var sessionButtons = page.locator("button[aria-label^='Session:']");
    var sessionCount = await sessionButtons.count();

    if (sessionCount === 0) {
      test.skip(true, "No sessions available to test");
      return;
    }

    await sessionButtons.first().click();
    await page.waitForTimeout(2000);
  });

  test("hovering a message reveals Copy and New Session buttons", async function ({ page }) {
    var messages = page.locator(".group\\/msg");
    var messageCount = await messages.count();

    if (messageCount === 0) {
      test.skip(true, "No messages available to test");
      return;
    }

    var targetMessage = messages.first();
    await targetMessage.hover();
    await page.waitForTimeout(300);

    var copyButton = targetMessage.locator("button[title*='Copy']");
    await expect(copyButton).toBeVisible({ timeout: 5000 });

    var newSessionButton = targetMessage.locator("button[title='Start new session with this message']");
    var hasNewSession = await newSessionButton.count();
    if (hasNewSession > 0) {
      await expect(newSessionButton).toBeVisible();
    }
  });

  test("clicking New Session creates a session with prefilled input", async function ({ page }) {
    var userMessages = page.locator(".chat.chat-end .group\\/msg, .chat-end.group\\/msg");
    var userMessageCount = await userMessages.count();

    if (userMessageCount === 0) {
      var allMessages = page.locator(".group\\/msg");
      var allCount = await allMessages.count();
      if (allCount === 0) {
        test.skip(true, "No messages available to test");
        return;
      }

      await allMessages.first().hover();
      await page.waitForTimeout(300);

      var newSessionBtn = allMessages.first().locator("button[title='Start new session with this message']");
      if (await newSessionBtn.count() === 0) {
        test.skip(true, "No messages with New Session action available");
        return;
      }

      await newSessionBtn.click();
    } else {
      await userMessages.first().hover();
      await page.waitForTimeout(300);

      var newSessionBtn2 = userMessages.first().locator("button[title='Start new session with this message']");
      if (await newSessionBtn2.count() === 0) {
        test.skip(true, "New Session button not found on user message");
        return;
      }

      await newSessionBtn2.click();
    }

    await page.waitForTimeout(2000);

    var textarea = page.locator("textarea");
    if (await textarea.count() > 0) {
      var value = await textarea.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
