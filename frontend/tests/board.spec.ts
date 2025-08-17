import { test, expect, Page } from "@playwright/test";
import { NETWORK_PRESETS } from "../test-data/NETWORK_PRESETS";

test("Start game", async ({ page }) => {
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(generateMatchID());
  await page.locator("button").click();

  const playerTitle = page.locator("#player-title");
  const boardContainer = page.locator("#board-container");

  await expect(playerTitle).toBeVisible();
  await expect(boardContainer.locator(":scope > div")).toHaveCount(1);
});

test("two independent contexts in same browser", async ({ browser }) => {
  // Not sure why, but when repeating-each, first run is 40 something seconds, next dozen is sub 60s, subsequent time out
  test.setTimeout(120 * 1000);

  const RUNS = 100;

  for (let i = 0; i < RUNS; i++) {
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto("/frontend/index.html");

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/frontend/index.html");

    const matchString = generateMatchID();

    await page1.locator("#match-string").fill(matchString);
    await page1.locator("button").click();

    const playerOne = await page1.locator("#player-title").textContent();

    await page2.locator("#match-string").fill(matchString);
    await page2.locator("button").click();

    const playerTwo = await page2.locator("#player-title").textContent();

    expect(playerOne !== playerTwo);

    await context1.close();
    await context2.close();
  }
});

test("Start game as a spectator", async ({ page }) => {
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(generateMatchID());
  await page.locator("#spectator-checkbox").click();
  await page.locator("button").click();

  const playerTitle = page.locator("#player-title");
  const boardContainer = page.locator("#board-container");

  await expect(playerTitle).toHaveCount(0);
  await expect(boardContainer.locator(":scope > div")).toHaveCount(3);
});

test("Add/remove guess stone and check its status after each click", async ({
  page,
}) => {
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(generateMatchID());
  await page.locator("button").click();
  await page.locator("#guess-stone-button").click();
  await page.locator("#remove-stone-button").click();

  const guessStone = page.locator(".stone");
  const emptyField = page.locator("circle:nth-child(130)");

  for (let i = 0; i < 100; i++) {
    await emptyField.click();
    expect(guessStone).toBeVisible();
    await guessStone.click();
    expect(emptyField).toBeVisible();
  }
});

// Helper: click center of provided box
async function clickCenter(page: Page, box) {
  const x = box.x + box.width / 2;
  const y = box.y + box.width / 2;

  await page.mouse.click(x, y);
}

test("Add/remove guess stone and check its status after all the clicks", async ({
  page,
  context,
}) => {
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(generateMatchID());
  await page.locator("button").click();
  await page.locator("#guess-stone-button").click();
  await page.locator("#remove-stone-button").click();

  const board = page.locator("svg");
  const box = await board.boundingBox();

  for (let i = 0; i < 100; i++) {
    await clickCenter(page, box);
  }

  await page.waitForTimeout(100);
  await expect(page.locator(".stone")).toHaveCount(0);

  for (let i = 0; i < 101; i++) {
    await clickCenter(page, box);
  }
  await page.waitForTimeout(100);

  await expect(page.locator(".stone")).toHaveCount(1);
});

test("Add then remove all guess stones in quick succession", async ({
  page,
}) => {
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(generateMatchID());
  await page.locator("button").click();
  await page.locator("#guess-stone-button").click();

  for (let i = 33; i < 202; i++) {
    await page.locator(`circle:nth-child(${i})`).click();
  }

  const guessStones = page.locator(".stone");
  const count = await guessStones.count();

  expect(count).toBe(169);

  await page.locator("#remove-stone-button").click();

  const stoneSelectors: string[] = [];
  for (let i = 0; i < count; i++) {
    const row = await guessStones.nth(i).getAttribute("data-row");
    const col = await guessStones.nth(i).getAttribute("data-col");
    stoneSelectors.push(`.stone[data-row="${row}"][data-col="${col}"]`);
  }

  for (let i = count; i > 0; i--) {
    await page.locator(stoneSelectors[i - 1]).click();
  }

  await expect(guessStones).toHaveCount(0, { timeout: 6000 });
});

test.describe("Throttling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/frontend/index.html");
    await page.locator("#match-string").fill(generateMatchID());
    await page.locator("button").click();

    await page.waitForLoadState("networkidle");

    await page.locator("#guess-stone-button").click();
    await page.locator("#remove-stone-button").click();
  });

  test("3G: Add then remove all guess stones in quick succession", async ({
    context,
    page,
  }) => {
    // Setting a longer timeout for this test
    test.setTimeout(30000);

    // Initiate throttling with Chrome DevTools Protocol
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send(
      "Network.emulateNetworkConditions",
      NETWORK_PRESETS.Regular3G
    );

    for (let i = 33; i < 202; i++) {
      await page.locator(`circle:nth-child(${i})`).click();
    }

    const guessStones = page.locator(".stone");
    const count = await guessStones.count();

    expect(count).toBe(169);

    const stoneSelectors: string[] = [];
    for (let i = 0; i < count; i++) {
      const row = await guessStones.nth(i).getAttribute("data-row");
      const col = await guessStones.nth(i).getAttribute("data-col");
      stoneSelectors.push(`.stone[data-row="${row}"][data-col="${col}"]`);
    }

    for (let i = count; i > 0; i--) {
      await page.locator(stoneSelectors[i - 1]).click();
    }

    await expect(guessStones).toHaveCount(0, { timeout: 20000 });
  });

  test("2G: Add then remove all guess stones in quick succession", async ({
    context,
    page,
  }) => {
    // Setting a longer timeout for this test
    test.setTimeout(100000);

    // Initiate throttling with Chrome DevTools Protocol
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send(
      "Network.emulateNetworkConditions",
      NETWORK_PRESETS.Regular2G
    );

    for (let i = 33; i < 202; i++) {
      await page.locator(`circle:nth-child(${i})`).click();
    }

    const guessStones = page.locator(".stone");
    const count = await guessStones.count();

    expect(count).toBe(169);

    const stoneSelectors: string[] = [];
    for (let i = 0; i < count; i++) {
      const row = await guessStones.nth(i).getAttribute("data-row");
      const col = await guessStones.nth(i).getAttribute("data-col");
      stoneSelectors.push(`.stone[data-row="${row}"][data-col="${col}"]`);
    }

    for (let i = count; i > 0; i--) {
      await page.locator(stoneSelectors[i - 1]).click();
    }

    await expect(guessStones).toHaveCount(0, { timeout: 90000 });
  });
});

function generateMatchID() {
  return (
    Math.random().toString(36).substring(2) +
    Math.random().toString(36).substring(2)
  );
}
