import {
  test,
  expect,
  Page,
  Browser,
  BrowserContext,
  Locator,
} from "@playwright/test";
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

      const p1 = await createUserAndJoinMatch(browser, ms);
      const p2 = await createUserAndJoinMatch(browser, ms);

      const playerOne = await p1.locator("#player-title").textContent();
      const playerTwo = await p2.locator("#player-title").textContent();

      expect(playerOne !== playerTwo);

      await closeContexts(p1, p2);
    }
  });

  test("Confirm the user can go back to his board view by loggin in again", async ({
    browser,
  }) => {
    const { pages, ms } = await startGameAndGetAllPages(browser);

    await rejoinPage(pages.black, ms);

    await expect(pages.black.locator("#player-title")).toHaveText(
      "Black Player"
    );

    await rejoinPage(pages.white, ms);

    await expect(pages.white.locator("#player-title")).toHaveText(
      "White Player"
    );

    await verifySpectatorState(pages.spectator);

    await closeContexts(...Object.values(pages));
  });

  test("Confirm the user can't cheat by opening spectator's page", async ({
    browser,
  }) => {
    const ms = generateMatchID();

    const page = await createUserAndJoinMatch(browser, ms);

    const p1Title = page.locator("#player-title");
    const p1Color = await p1Title.textContent();

    await page.goBack();
    await startGameAsSpectator(page, ms);

    expect(await p1Title.textContent()).toEqual(p1Color);

    await closeContexts(page);
  });

  test("Confirm subsequent joining users are spectators", async ({
    browser,
  }) => {
    const RUNS = 50;

    for (let i = 0; i < RUNS; i++) {
      const matchString = generateMatchID();

      // Create first two players (they join and leave immediately)
      (await createUserAndJoinMatch(browser, matchString)).context().close();
      (await createUserAndJoinMatch(browser, matchString)).context().close();

      // Create third user (spectator) and verify they're a spectator
      const spectatorSession = await createUserAndJoinMatch(
        browser,
        matchString
      );

      await verifySpectatorState(spectatorSession);
      await spectatorSession.context().close();
    }
  });
});

test("Player logs in, then resigns", async ({ page }) => {
  await startGameWithRandomID(page);
  const sessionToken = await getSessionToken(page);
  await expectAny(sessionToken, [
    (t) => expect(t).not.toBeNull(),
    (t) => expect(t).not.toBe(""),
  ]);

  const resignButton = page.locator("#resign-button");

  await resignButton.click();

  const result = page.locator("#result");

  // The ! tells TypeScript: "Trust me, it's not null."
  await verifyPlayerIsOnMainPage(page, sessionToken!);
  await expect(result).toContainText("+ R");
});

test.describe("Rules", () => {
  test("Players can't place a stone on opponent's stone", async ({
    browser,
  }) => {
    const { pages } = await startGameAndGetAllPages(browser);

    const row = 5;
    const col = 5;
    const stoneAtPage = stoneAt(pages, row, col);

    await clickAtCoordinate(pages.black, row, col);

    await expectSameTextOnAllPages(pages, "#player-turn", "Turn: white");

    await expect(stoneAtPage.black).toHaveCount(1);
    await expect(stoneAtPage.white).toHaveCount(0);
    await expect(pages.spectator.locator("#main-board .stone")).toHaveCount(1);

    await clickAtCoordinate(pages.white, row, col);

    await expectSameTextOnAllPages(pages, "#player-turn", "Turn: white");

    await expect(stoneAtPage.black).toHaveCount(1);
    await expect(stoneAtPage.white).toHaveCount(0);
    await expect(pages.spectator.locator("#main-board .stone")).toHaveCount(1);

    await closeContexts(...Object.values(pages));
  });
});

test.describe("Capturing stones", () => {
  test("Capturing white stones updates Black Captures", async ({ browser }) => {
    const { pages } = await startGameAndGetAllPages(browser);

    await clickAtCoordinate(pages.black, 0, 1);
    await clickAtCoordinate(pages.white, 0, 0);

    await expectSameTextOnAllPages(
      pages,
      "#black-captures",
      "Black Captures: 0"
    );

    await clickAtCoordinate(pages.black, 1, 0);

    await expectSameTextOnAllPages(
      pages,
      "#black-captures",
      "Black Captures: 1"
    );

    await closeContexts(...Object.values(pages));
  });

  test("Capturing black stones updates White Captures", async ({ browser }) => {
    const { pages } = await startGameAndGetAllPages(browser);

    const blackPageWhiteCaptures = pages.black.locator("#white-captures");
    const whitePageWhiteCaptures = pages.white.locator("#white-captures");
    const spectatorPageWhiteCaptures =
      pages.spectator.locator("#white-captures");

    await clickAtCoordinate(pages.black, 0, 0);
    await clickAtCoordinate(pages.white, 1, 0);
    await clickAtCoordinate(pages.black, 0, 1);
    await clickAtCoordinate(pages.white, 1, 1);
    await clickAtCoordinate(pages.black, 1, 2);

    await expect(blackPageWhiteCaptures).toHaveText("White Captures: 0");
    await expect(whitePageWhiteCaptures).toHaveText("White Captures: 0");
    await expect(spectatorPageWhiteCaptures).toHaveText("White Captures: 0");

    await clickAtCoordinate(pages.white, 0, 2);

    await expect(blackPageWhiteCaptures).toHaveText("White Captures: 2");
    await expect(whitePageWhiteCaptures).toHaveText("White Captures: 2");
    await expect(spectatorPageWhiteCaptures).toHaveText("White Captures: 2");

    await closeContexts(pages.black, pages.white, pages.spectator);
  });
});

test.describe("Undo", () => {
  test("Black plays a move, then UNDO", async ({ browser }) => {
    const { pages } = await startGameAndGetAllPages(browser);

    const undoButton = pages.black.locator("#undo-button");
    const turnBlack = pages.black.locator("#player-turn");
    const turnWhite = pages.white.locator("#player-turn");
    const turnSpectator = pages.spectator.locator("#player-turn");

    await expect(turnBlack).toHaveText("Turn: black");
    await expect(turnWhite).toHaveText("Turn: black");
    await expect(turnSpectator).toHaveText("Turn: black");
    await expect(pages.black.locator(".stone")).toHaveCount(0);

    await clickAtCoordinate(pages.black, 1, 2);

    await expect(turnBlack).toHaveText("Turn: white");
    await expect(turnWhite).toHaveText("Turn: white");
    await expect(turnSpectator).toHaveText("Turn: white");
    await expect(pages.black.locator(".stone")).toHaveCount(1);

    await undoButton.click();

    await expect(turnBlack).toHaveText("Turn: black");
    await expect(turnWhite).toHaveText("Turn: black");
    await expect(turnSpectator).toHaveText("Turn: black");
    await expect(pages.black.locator(".stone")).toHaveCount(0);

    await closeContexts(pages.black, pages.white, pages.spectator);
  });

  test("Black passes, then UNDO", async ({ browser }) => {
    const { pages } = await startGameAndGetAllPages(browser);

    const passButton = pages.black.locator("#pass-button");
    const undoButton = pages.black.locator("#undo-button");
    const turnBlack = pages.black.locator("#player-turn");
    const turnWhite = pages.white.locator("#player-turn");
    const turnSpectator = pages.spectator.locator("#player-turn");

    await passButton.click();

    await expect(turnBlack).toHaveText("Turn: black");
    await expect(turnWhite).toHaveText("Turn: black");
    await expect(turnSpectator).toHaveText("Turn: black");

    await expect(turnBlack).toHaveText("Turn: white");
    await expect(turnWhite).toHaveText("Turn: white");
    await expect(turnSpectator).toHaveText("Turn: white");

    await undoButton.click();

    await expect(turnBlack).toHaveText("Turn: black");
    await expect(turnWhite).toHaveText("Turn: black");
    await expect(turnSpectator).toHaveText("Turn: black");

    await closeContexts(pages.black, pages.white, pages.spectator);
  });

  test("White passes, then UNDO", async ({ browser }) => {
    const { pages } = await startGameAndGetAllPages(browser);

    const passButton = pages.white.locator("#pass-button");
    const undoButton = pages.white.locator("#undo-button");
    const turnBlack = pages.black.locator("#player-turn");
    const turnWhite = pages.white.locator("#player-turn");
    const turnSpectator = pages.spectator.locator("#player-turn");

    await clickAtCoordinate(pages.black, 5, 5);

    await expect(turnBlack).toHaveText("Turn: white");
    await expect(turnWhite).toHaveText("Turn: white");
    await expect(turnSpectator).toHaveText("Turn: white");

    await passButton.click();

    await expect(turnBlack).toHaveText("Turn: black");
    await expect(turnWhite).toHaveText("Turn: black");
    await expect(turnSpectator).toHaveText("Turn: black");

    await undoButton.click();

    await expect(turnBlack).toHaveText("Turn: white");
    await expect(turnWhite).toHaveText("Turn: white");
    await expect(turnSpectator).toHaveText("Turn: white");

    await closeContexts(pages.black, pages.white, pages.spectator);
  });

  test("White UNDO, black UNDO", async ({ browser }) => {
    const { pages } = await startGameAndGetAllPages(browser);

    const undoButtonBlack = pages.black.locator("#undo-button");
    const undoButtonWhite = pages.white.locator("#undo-button");
    const turnBlack = pages.black.locator("#player-turn");
    const turnWhite = pages.white.locator("#player-turn");
    const turnSpectator = pages.spectator.locator("#player-turn");

    await expect(pages.black.locator(".stone")).toHaveCount(0);
    await expect(pages.white.locator(".stone")).toHaveCount(0);
    await expect(pages.spectator.locator("#main-board .stone")).toHaveCount(0);

    await clickAtCoordinate(pages.black, 1, 1);
    await clickAtCoordinate(pages.white, 5, 5);

    await expect(pages.black.locator(".stone")).toHaveCount(1);
    await expect(pages.white.locator(".stone")).toHaveCount(1);
    await expect(pages.spectator.locator("#main-board .stone")).toHaveCount(2);

    await expect(turnBlack).toHaveText("Turn: black");
    await expect(turnWhite).toHaveText("Turn: black");
    await expect(turnSpectator).toHaveText("Turn: black");

    await undoButtonWhite.click();

    await expect(pages.black.locator(".stone")).toHaveCount(1);
    await expect(pages.white.locator(".stone")).toHaveCount(0);
    await expect(pages.spectator.locator("#main-board .stone")).toHaveCount(1);

    await expect(turnBlack).toHaveText("Turn: white");
    await expect(turnWhite).toHaveText("Turn: white");
    await expect(turnSpectator).toHaveText("Turn: white");

    await undoButtonBlack.click();

    await expect(pages.black.locator(".stone")).toHaveCount(0);
    await expect(pages.white.locator(".stone")).toHaveCount(0);
    await expect(pages.spectator.locator("#main-board .stone")).toHaveCount(0);

    await expect(turnBlack).toHaveText("Turn: black");
    await expect(turnWhite).toHaveText("Turn: black");
    await expect(turnSpectator).toHaveText("Turn: black");

    await closeContexts(pages.black, pages.white, pages.spectator);
  });

  test("Capturing white stone, then undo", async ({ browser }) => {
    const { pages } = await startGameAndGetAllPages(browser);

    const undoButtonBlack = pages.black.locator("#undo-button");
    const blackPageBlackCaptures = pages.black.locator("#black-captures");
    const whitePageBlackCaptures = pages.white.locator("#black-captures");
    const spectatorPageBlackCaptures =
      pages.spectator.locator("#black-captures");

    await clickAtCoordinate(pages.black, 0, 1);
    await clickAtCoordinate(pages.white, 0, 0);

    await expect(blackPageBlackCaptures).toHaveText("Black Captures: 0");
    await expect(whitePageBlackCaptures).toHaveText("Black Captures: 0");
    await expect(spectatorPageBlackCaptures).toHaveText("Black Captures: 0");

    await clickAtCoordinate(pages.black, 1, 0);

    await expect(blackPageBlackCaptures).toHaveText("Black Captures: 1");
    await expect(whitePageBlackCaptures).toHaveText("Black Captures: 1");
    await expect(spectatorPageBlackCaptures).toHaveText("Black Captures: 1");

    await undoButtonBlack.click();

    await expect(blackPageBlackCaptures).toHaveText("Black Captures: 0");
    await expect(whitePageBlackCaptures).toHaveText("Black Captures: 0");
    await expect(spectatorPageBlackCaptures).toHaveText("Black Captures: 0");

    await closeContexts(pages.black, pages.white, pages.spectator);
  });
});

test.describe("Passing", () => {
  test("Black passes", async ({ browser }) => {
    const { blackPlayer, whitePlayer } = await startGameAndGetPlayerPages(
      browser
    );

    const blackPassButton = blackPlayer.locator("#pass-button");
    const blackPageTurn = blackPlayer.locator("#player-turn");
    const whitePageBlackReady = whitePlayer.locator("#player-turn");

    expect(await blackPageTurn.textContent()).toBe("Turn: black");
    expect(await whitePageBlackReady.textContent()).toBe("Turn: black");

    await blackPassButton.click();

    await boardRefresh(blackPlayer, whitePlayer);

    expect(await blackPageTurn.textContent()).toBe("Turn: white");
    expect(await whitePageBlackReady.textContent()).toBe("Turn: white");

    await closeContexts(blackPlayer, whitePlayer);
  });

  test("White passes", async ({ browser }) => {
    const { blackPlayer, whitePlayer } = await startGameAndGetPlayerPages(
      browser
    );

    const whitePassButton = whitePlayer.locator("#pass-button");
    const blackPageTurn = blackPlayer.locator("#player-turn");
    const whitePageBlackReady = whitePlayer.locator("#player-turn");

    await clickAtCoordinate(blackPlayer, 6, 6);

    await boardRefresh(blackPlayer, whitePlayer);

    expect(await blackPageTurn.textContent()).toBe("Turn: white");
    expect(await whitePageBlackReady.textContent()).toBe("Turn: white");

    await whitePassButton.click();

    await boardRefresh(blackPlayer, whitePlayer);

    expect(await blackPageTurn.textContent()).toBe("Turn: black");
    expect(await whitePageBlackReady.textContent()).toBe("Turn: black");

    await closeContexts(blackPlayer, whitePlayer);
  });

  test("Both players passing consecutively results in transfer to Main Board", async ({
    browser,
  }) => {
    const { blackPlayer, whitePlayer } = await startGameAndGetPlayerPages(
      browser
    );

    const blackPassButton = blackPlayer.locator("#pass-button");
    const whitePassButton = whitePlayer.locator("#pass-button");

    await blackPassButton.click();
    await whitePassButton.click();

    await boardRefresh(blackPlayer, whitePlayer);

    await verifyPlayerIsOnMainPage(
      blackPlayer,
      (await getSessionToken(blackPlayer))!
    );
    await verifyPlayerIsOnMainPage(
      whitePlayer,
      (await getSessionToken(whitePlayer))!
    );

    await closeContexts(blackPlayer, whitePlayer);
  });
});

test.describe("Counting", () => {
  test("Player 1 selects a dead stone, Player 2 counts score", async ({
    browser,
  }) => {
    const { blackPlayer, whitePlayer } = await startGameAndGetPlayerPages(
      browser
    );

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

    await closeContexts(blackPlayer, whitePlayer);
  });

  test("Player selects a dead stone, counts, then deselects", async ({
    browser,
  }) => {
    const { blackPlayer, whitePlayer } = await startGameAndGetPlayerPages(
      browser
    );

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

    await closeContexts(blackPlayer, whitePlayer);
  });

  test("Player selects a dead stone, counts, then other player deselects", async ({
    browser,
  }) => {
    const { blackPlayer, whitePlayer } = await startGameAndGetPlayerPages(
      browser
    );

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

    await closeContexts(blackPlayer, whitePlayer);
  });

  test("Spectator counts score - doesn't affect the game", async ({
    browser,
  }) => {
    const { pages } = await startGameAndGetAllPages(browser);

    await pages.black.locator("#pass-button").click();
    await pages.white.locator("#pass-button").click();

    await pages.spectator.waitForTimeout(1000);
    await pages.spectator.locator("#count-score-button").click();

    expect(await pages.spectator.locator("#black-ready").textContent()).toBe(
      "Black: selecting dead stones"
    );
    expect(await pages.black.locator("#black-ready").textContent()).toBe(
      "Black: selecting dead stones"
    );
    expect(await pages.white.locator("#black-ready").textContent()).toBe(
      "Black: selecting dead stones"
    );
    expect(await pages.spectator.locator("#white-ready").textContent()).toBe(
      "White: selecting dead stones"
    );
    expect(await pages.black.locator("#white-ready").textContent()).toBe(
      "White: selecting dead stones"
    );
    expect(await pages.white.locator("#white-ready").textContent()).toBe(
      "White: selecting dead stones"
    );

    await closeContexts(pages.black, pages.white, pages.spectator);
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

  return page;
}

interface PlayerPages {
  blackPlayer: Page;
  whitePlayer: Page;
}

async function getPlayerPages(page1: Page, page2: Page): Promise<PlayerPages> {
  if ((await page1.locator("#player-title").textContent()) === "Black Player") {
    return { blackPlayer: page1, whitePlayer: page2 };
  } else {
    return { blackPlayer: page2, whitePlayer: page1 };
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

  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      await clickAtCoordinate(page, i, j);
      const stone = page.locator(`.stone[data-row="${i}"][data-col="${j}"]`);
      await expect(stone).toBeVisible();
    }
  }
});

async function validateStonePlacement(locator: Locator, color: string) {
  await expect(locator).toHaveAttribute("fill", color);
}

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

async function startGameAndGetPlayerPages(browser: Browser) {
  const ms = generateMatchID();

  const p1 = await createUserAndJoinMatch(browser, ms);
  const p2 = await createUserAndJoinMatch(browser, ms);

  const playerPages = await getPlayerPages(p1, p2);

  return { ...playerPages, ms };
}

async function boardRefresh(blackPlayer: Page, whitePlayer: Page) {
  await blackPlayer.waitForTimeout(1000);
  await whitePlayer.waitForTimeout(1000);
}

async function closeContexts(...pages: Page[]) {
  for (const page of pages) {
    await page.context().close();
  }
}

interface Pages {
  black: Page;
  white: Page;
  spectator: Page;
}

async function expectSameTextOnAllPages(
  pages: Pages,
  elementId: string,
  text: string
) {
  const blackPageElement = pages.black.locator(elementId);
  const whitePageElement = pages.white.locator(elementId);
  const spectatorPageElement = pages.spectator.locator(elementId);

  await expect(blackPageElement).toHaveText(text);
  await expect(whitePageElement).toHaveText(text);
  await expect(spectatorPageElement).toHaveText(text);
}

async function startGameAndGetAllPages(browser: Browser) {
  const ms = generateMatchID();

  const p1 = await createUserAndJoinMatch(browser, ms);
  const p2 = await createUserAndJoinMatch(browser, ms);
  const p3 = await createUserAndJoinMatch(browser, ms);

  const playerPages = await getPlayerPages(p1, p2);
  const pages: Pages = {
    black: playerPages.blackPlayer,
    white: playerPages.whitePlayer,
    spectator: p3,
  };

  return { pages, ms };
}

async function rejoinPage(player: Page, matchString: string) {
  await player.goBack();
  await player.locator("#match-string").fill(matchString);
  await player.locator("#join-button").click();
}

interface StoneLocatorsByRole {
  black: Locator;
  white: Locator;
  spectator: Locator;
}

async function getStoneLocatorsForPages(
  pages: Pages,
  stoneLocator: string
): Promise<StoneLocatorsByRole> {
  return {
    black: pages.black.locator(stoneLocator),
    white: pages.white.locator(stoneLocator),
    spectator: pages.spectator.locator(stoneLocator),
  };
}

function stoneAt(pages: Pages, row: number, col: number) {
  const selector = `.stone[data-row="${row}"][data-col="${col}"]`;

  return {
    black: pages.black.locator(selector),
    white: pages.white.locator(selector),
    spectator: pages.spectator.locator(selector),
  };
}

async function expectStoneState(
  stone: ReturnType<typeof stoneAt>,
  {
    black = 0,
    white = 0,
    spectator = 0,
  }: { black?: number; white?: number; spectator?: number }
) {
  await expect(stone.black).toHaveCount(black);
  await expect(stone.white).toHaveCount(white);
  await expect(stone.spectator).toHaveCount(spectator);
}
