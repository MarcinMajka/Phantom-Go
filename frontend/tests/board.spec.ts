import { test, expect, Page, Browser } from "@playwright/test";
import { NETWORK_PRESETS } from "../test-data/NETWORK_PRESETS";

test.describe("Logging in", () => {
  test("Start game", async ({ page }) => {
    startGameWithRandomID(page);

    const playerTitle = page.locator("#player-title");
    const boardContainer = page.locator("#board-container");

    await expect(playerTitle).toBeVisible();
    await expect(boardContainer.locator(":scope > div")).toHaveCount(1);
  });

  test("Start game as a spectator", async ({ page }) => {
    startGameAsSpectator(page, generateMatchID());

    const playerTitle = page.locator("#player-title");
    const boardContainer = page.locator("#board-container");

    await expect(playerTitle).toHaveCount(0);
    await expect(boardContainer.locator(":scope > div")).toHaveCount(3);
  });

  test("Confirm the second joining user has the other color", async ({
    browser,
  }) => {
    // Not sure why, but when repeating-each, first run is 40 something seconds, next dozen is sub 60s, subsequent time out
    test.setTimeout(120 * 1000);

    const RUNS = 100;

    for (let i = 0; i < RUNS; i++) {
      const ms = generateMatchID();

      const { context: c1, page: p1 } = await createUserAndJoinMatch(
        browser,
        ms
      );
      const { context: c2, page: p2 } = await createUserAndJoinMatch(
        browser,
        ms
      );

      const playerOne = await p1.locator("#player-title").textContent();
      const playerTwo = await p2.locator("#player-title").textContent();

      expect(playerOne !== playerTwo);

      await c1.close();
      await c2.close();
    }
  });

  test("Confirm subsequent joining users are spectators", async ({
    browser,
  }) => {
    const RUNS = 50;

    for (let i = 0; i < RUNS; i++) {
      const matchString = generateMatchID();

      // Create first two players (they join and leave immediately)
      (await createUserAndJoinMatch(browser, matchString)).context.close();
      (await createUserAndJoinMatch(browser, matchString)).context.close();

      // Create third user (spectator) and verify they're a spectator
      const spectatorSession = await createUserAndJoinMatch(
        browser,
        matchString
      );

      await verifySpectatorState(spectatorSession.page);
      await spectatorSession.context.close();
    }
  });
});

test("Player 1 selects a dead stone, Player 2 counts score", async ({
  browser,
}) => {
  const ms = generateMatchID();

  const { context: c1, page: p1 } = await createUserAndJoinMatch(browser, ms);
  const { context: c2, page: p2 } = await createUserAndJoinMatch(browser, ms);

  let blackPlayer: Page, whitePlayer: Page;
  if ((await p1.locator("#player-title").textContent()) === "Black Player") {
    blackPlayer = p1;
    whitePlayer = p2;
  } else {
    blackPlayer = p2;
    whitePlayer = p1;
  }

  const board = blackPlayer.locator("svg");
  const box = await board.boundingBox();
  clickCenter(blackPlayer, box);

  await whitePlayer.locator("#pass-button").click();
  await blackPlayer.locator("#pass-button").click();

  await whitePlayer.locator("#go-to-main-board-button").click();
  await blackPlayer.locator("#go-to-main-board-button").click();

  await whitePlayer.locator(".stone").first().click();

  await blackPlayer.waitForTimeout(1000);
  await blackPlayer.locator("#count-score-button").click();

  await blackPlayer.waitForTimeout(1000);
  expect(await blackPlayer.locator("#black-ready").textContent()).toBe(
    "Black: ready"
  );

  await whitePlayer.waitForTimeout(1000);
  expect(await whitePlayer.locator("#black-ready").textContent()).toBe(
    "Black: ready"
  );
  await whitePlayer.locator("#count-score-button").click();

  // TODO: update this when element IDs make sense
  expect(await whitePlayer.locator("#result").textContent()).toBe("White +2.5");
});

test("Add/remove guess stone and check its status after each click", async ({
  page,
}) => {
  startGameWithRandomID(page);

  await page.locator("#guess-stone-button").click();

  const guessStone = page.locator(".stone");
  const emptyField = page.locator("circle:nth-child(130)");

  for (let i = 0; i < 100; i++) {
    await emptyField.click();
    expect(guessStone).toBeVisible();
    await guessStone.click();
    expect(emptyField).toBeVisible();
  }
});

test("Add/remove guess stone and check its status after all the clicks", async ({
  page,
  context,
}) => {
  startGameWithRandomID(page);

  await page.locator("#guess-stone-button").click();

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
  startGameWithRandomID(page);

  await page.locator("#guess-stone-button").click();

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

  await expect(guessStones).toHaveCount(0, { timeout: 6000 });
});

test.describe("Throttling", () => {
  test.beforeEach(async ({ page }) => {
    startGameWithRandomID(page);

    await page.waitForLoadState("networkidle");

    await page.locator("#guess-stone-button").click();
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

async function startGameWithRandomID(page: Page) {
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(generateMatchID());
  await page.locator("button").click();
}

async function startGameAsSpectator(page: Page, mathString: string) {
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(mathString);
  await page.locator("#spectator-checkbox").click();
  await page.locator("button").click();
}

async function verifySpectatorState(page: Page) {
  const playerTitle = page.locator("#player-title");
  const boardContainer = page.locator("#board-container");

  await expect(playerTitle).toHaveCount(0);
  await expect(boardContainer.locator(":scope > div")).toHaveCount(3);
}

async function createUserAndJoinMatch(browser: Browser, matchString: string) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(matchString);
  await page.locator("button").click();

  return { context, page };
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Helper: click center of provided box
async function clickCenter(page: Page, box: BoundingBox | null) {
  if (!box) throw new Error("Bounding box is null");

  const x = box.x + box.width / 2;
  const y = box.y + box.width / 2;

  await page.mouse.click(x, y);
}
