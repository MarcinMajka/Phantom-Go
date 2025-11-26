import { test, expect, Page, Browser } from "@playwright/test";
import { NETWORK_PRESETS } from "../test-data/NETWORK_PRESETS";

test.describe("Logging in", () => {
  test("Start game", async ({ page }) => {
    await startGameWithRandomID(page);

    const playerTitle = page.locator("#player-title");
    const boardContainer = page.locator("#board-container");

    await expect(playerTitle).toBeVisible();
    await expect(boardContainer.locator(":scope > div")).toHaveCount(1);
  });

  test("Start game as a spectator", async ({ page }) => {
    startGameAsSpectator(page, generateMatchID());

    await verifySpectatorState(page);
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

  test("Confirm the user can go back to his board view by loggin in again", async ({
    browser,
  }) => {
    const ms = generateMatchID();

    const { context: c1, page: p1 } = await createUserAndJoinMatch(browser, ms);
    const { context: c2, page: p2 } = await createUserAndJoinMatch(browser, ms);

    const p1Title = p1.locator("#player-title");
    const p1Color = await p1Title.textContent();

    await p1.goBack();
    await p1.locator("#match-string").fill(ms);
    await p1.locator("#join-button").click();

    expect(await p1Title.textContent()).toEqual(p1Color);

    const p2Title = p2.locator("#player-title");
    const p2Color = await p2Title.textContent();

    await p2.goBack();
    await p2.locator("#match-string").fill(ms);
    await p2.locator("#join-button").click();

    expect(await p2Title.textContent()).toEqual(p2Color);

    const { context: c3, page: spectator } = await createUserAndJoinMatch(
      browser,
      ms
    );

    const playerTitle = spectator.locator("#player-title");
    const boardContainer = spectator.locator("#board-container");

    await expect(playerTitle).toHaveCount(0);
    await expect(boardContainer.locator(":scope > div")).toHaveCount(3);

    await c1.close();
    await c2.close();
    await c3.close();
  });

  test("Confirm the user can't cheat by opening spectator's page", async ({
    browser,
  }) => {
    const ms = generateMatchID();

    const { context, page } = await createUserAndJoinMatch(browser, ms);

    const p1Title = page.locator("#player-title");
    const p1Color = await p1Title.textContent();

    await page.goBack();
    await page.locator("#match-string").fill(ms);
    await page.locator("#spectator-checkbox").click();
    await page.locator("#join-button").click();

    expect(await p1Title.textContent()).toEqual(p1Color);

    await context.close();
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

test("Player logs in, then resigns", async ({ page }) => {
  await startGameWithRandomID(page);
  const sessionToken = await getSessionToken(page);
  expect(sessionToken).not.toBe(null);
  expect(sessionToken).not.toBe("");

  const resignButton = page.locator("#resign-button");

  await resignButton.click();

  const result = page.locator("#result");

  // The ! tells TypeScript: "Trust me, it's not null."
  await verifyPlayerIsOnMainPage(page, sessionToken!);
  await expect(result).toContainText("+ R");
});

test.describe("Undo", () => {});

test.describe("Passing", () => {
  test("Black passes", async ({ browser }) => {
    const ms = generateMatchID();

    const { context: c1, page: p1 } = await createUserAndJoinMatch(browser, ms);
    const { context: c2, page: p2 } = await createUserAndJoinMatch(browser, ms);

    const { blackPlayerPage: blackPlayer, whitePlayerPage: whitePlayer } =
      await getPlayerPages(p1, p2);

    const blackPassButton = blackPlayer.locator("#pass-button");
    const blackPageTurn = blackPlayer.locator("#player-turn");
    const whitePageBlackReady = whitePlayer.locator("#player-turn");

    expect(await blackPageTurn.textContent()).toBe("Turn: black");
    expect(await whitePageBlackReady.textContent()).toBe("Turn: black");

    await blackPassButton.click();

    await blackPlayer.waitForTimeout(1000);
    await whitePlayer.waitForTimeout(1000);

    expect(await blackPageTurn.textContent()).toBe("Turn: white");
    expect(await whitePageBlackReady.textContent()).toBe("Turn: white");
  });
});

test.describe("Counting", () => {
  test("Player 1 selects a dead stone, Player 2 counts score", async ({
    browser,
  }) => {
    const ms = generateMatchID();

    const { context: c1, page: p1 } = await createUserAndJoinMatch(browser, ms);
    const { context: c2, page: p2 } = await createUserAndJoinMatch(browser, ms);

    const { blackPlayerPage: blackPlayer, whitePlayerPage: whitePlayer } =
      await getPlayerPages(p1, p2);

    const board = blackPlayer.locator("svg");
    const box = await board.boundingBox();
    clickCenter(blackPlayer, box);

    await whitePlayer.locator("#pass-button").click();
    await blackPlayer.locator("#pass-button").click();

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

    expect(await whitePlayer.locator("#result").textContent()).toBe(
      "White +2.5"
    );

    await c1.close();
    await c2.close();
  });

  test("Player selects a dead stone, counts, then deselects", async ({
    browser,
  }) => {
    const ms = generateMatchID();

    const { context: c1, page: p1 } = await createUserAndJoinMatch(browser, ms);
    const { context: c2, page: p2 } = await createUserAndJoinMatch(browser, ms);

    const { blackPlayerPage: blackPlayer, whitePlayerPage: whitePlayer } =
      await getPlayerPages(p1, p2);

    let board = blackPlayer.locator("svg");
    let box = await board.boundingBox();
    clickCenter(blackPlayer, box);

    await whitePlayer.locator("#pass-button").click();
    await blackPlayer.locator("#pass-button").click();

    await blackPlayer.locator(".stone").first().click();

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

    const selectedStone = blackPlayer.locator(".stone").first();
    await selectedStone.click();

    await blackPlayer.waitForTimeout(1000);
    expect(await blackPlayer.locator("#black-ready").textContent()).toBe(
      "Black: selecting dead stones"
    );

    await whitePlayer.waitForTimeout(1000);
    expect(await whitePlayer.locator("#black-ready").textContent()).toBe(
      "Black: selecting dead stones"
    );

    await c1.close();
    await c2.close();
  });

  test("Player selects a dead stone, counts, then other player deselects", async ({
    browser,
  }) => {
    const ms = generateMatchID();

    const { context: c1, page: p1 } = await createUserAndJoinMatch(browser, ms);
    const { context: c2, page: p2 } = await createUserAndJoinMatch(browser, ms);

    const { blackPlayerPage: blackPlayer, whitePlayerPage: whitePlayer } =
      await getPlayerPages(p1, p2);

    let board = blackPlayer.locator("svg");
    let box = await board.boundingBox();
    clickCenter(blackPlayer, box);

    await whitePlayer.locator("#pass-button").click();
    await blackPlayer.locator("#pass-button").click();

    await blackPlayer.locator(".stone").first().click();

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

    const selectedStone = whitePlayer.locator(".stone").first();
    await selectedStone.click();

    await whitePlayer.waitForTimeout(1000);
    expect(await whitePlayer.locator("#black-ready").textContent()).toBe(
      "Black: selecting dead stones"
    );

    await blackPlayer.waitForTimeout(1000);
    expect(await blackPlayer.locator("#black-ready").textContent()).toBe(
      "Black: selecting dead stones"
    );

    await c1.close();
    await c2.close();
  });

  test("Spectator counts score - doesn't affect the game", async ({
    browser,
  }) => {
    const ms = generateMatchID();

    const { context: c1, page: p1 } = await createUserAndJoinMatch(browser, ms);
    const { context: c2, page: p2 } = await createUserAndJoinMatch(browser, ms);
    const { context: c3, page: spectator } = await createUserAndJoinMatch(
      browser,
      ms
    );

    const { blackPlayerPage: blackPlayer, whitePlayerPage: whitePlayer } =
      await getPlayerPages(p1, p2);

    await blackPlayer.locator("#pass-button").click();
    await whitePlayer.locator("#pass-button").click();

    await spectator.waitForTimeout(1000);
    await spectator.locator("#count-score-button").click();

    expect(await spectator.locator("#black-ready").textContent()).toBe(
      "Black: selecting dead stones"
    );
    expect(await blackPlayer.locator("#black-ready").textContent()).toBe(
      "Black: selecting dead stones"
    );
    expect(await whitePlayer.locator("#black-ready").textContent()).toBe(
      "Black: selecting dead stones"
    );
    expect(await spectator.locator("#white-ready").textContent()).toBe(
      "White: selecting dead stones"
    );
    expect(await blackPlayer.locator("#white-ready").textContent()).toBe(
      "White: selecting dead stones"
    );
    expect(await whitePlayer.locator("#white-ready").textContent()).toBe(
      "White: selecting dead stones"
    );

    await c1.close();
    await c2.close();
    await c3.close();
  });
});

test.describe("Guess stones", () => {
  test("Add/remove guess stone and check its status after each click", async ({
    page,
  }) => {
    await startGameWithRandomID(page);

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
    await startGameWithRandomID(page);

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
    await startGameWithRandomID(page);

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
});

test.describe("Throttling", () => {
  test.beforeEach(async ({ page }) => {
    await startGameWithRandomID(page);

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
  await page.locator("#join-button").click();
}

async function startGameWithID(page: Page, matchString: string) {
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(matchString);
  await page.locator("#join-button").click();
}

async function startGameAsSpectator(page: Page, matchString: string) {
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(matchString);
  await page.locator("#spectator-checkbox").click();
  await page.locator("#join-button").click();
}

async function verifySpectatorState(page: Page) {
  const playerTitle = page.locator("#player-title");
  const boardContainer = page.locator("#board-container");
  const sessionToken = await getSessionToken(page);

  await expect(playerTitle).toHaveCount(0);
  await expect(boardContainer.locator(":scope > div")).toHaveCount(3);
  await expectAny(sessionToken, [
    (t) => expect(t).toBeNull(),
    (t) => expect(t).toBe(""),
  ]);
}

async function verifyPlayerIsOnMainPage(page: Page, sessionToken: string) {
  const playerTitle = page.locator("#player-title");
  const boardContainer = page.locator("#board-container");

  await expect(playerTitle).toHaveCount(0);
  await expect(boardContainer.locator(":scope > div")).toHaveCount(3);
  await expect(await getSessionToken(page)).toBe(sessionToken);
}

async function createUserAndJoinMatch(browser: Browser, matchString: string) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(matchString);
  await page.locator("#join-button").click();

  return { context, page };
}

interface PlayerPages {
  blackPlayerPage: Page;
  whitePlayerPage: Page;
}

async function getPlayerPages(page1: Page, page2: Page): Promise<PlayerPages> {
  if ((await page1.locator("#player-title").textContent()) === "Black Player") {
    return { blackPlayerPage: page1, whitePlayerPage: page2 };
  } else {
    return { blackPlayerPage: page2, whitePlayerPage: page1 };
  }
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

async function clickAtCoordinate(page: Page, x: number, y: number) {
  const intersection = page.locator(
    `circle[data-row="${x}"][data-col="${y}"][fill="transparent"]`
  );

  await intersection.click();
}

test("Tests clickAtCoordinate()", async ({ page }) => {
  await startGameWithRandomID(page);

  await page.locator("#guess-stone-button").click();

  const guessStone = page.locator(".stone");

  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      await clickAtCoordinate(page, i, j);
      const stone = page.locator(`.stone[data-row="${i}"][data-col="${j}"]`);
      await expect(stone).toBeVisible();
    }
  }
});

async function getSessionToken(player: Page) {
  try {
    return await player.evaluate(() => localStorage.getItem("sessionToken"));
  } catch (error) {
    // If navigation happened, wait and retry
    await player.waitForLoadState("domcontentloaded");
    return await player.evaluate(() => localStorage.getItem("sessionToken"));
  }
}

async function expectAny<T>(
  value: T,
  assertions: Array<(fn: T) => void | Promise<void>>
): Promise<void> {
  const errors = [];

  for (const assertFn of assertions) {
    try {
      await assertFn(value);
      return;
    } catch (err) {
      errors.push(err as Error);
    }
  }

  throw new Error(
    "All assertions failed:\n" + errors.map((e) => e.message).join("\n")
  );
}
