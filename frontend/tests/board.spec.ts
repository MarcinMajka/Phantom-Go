import {
  test,
  expect,
  Page,
  Browser,
  BrowserContext,
  Locator,
} from "@playwright/test";
import * as helpers from "./helpers";
import { NETWORK_PRESETS } from "../test-data/NETWORK_PRESETS";
import { LoginPage } from "./pages/LoginPage";

test.describe("Logging in", () => {
  test("Start game", async ({ page }) => {
    const login = new LoginPage(page);
    const matchId = helpers.generateMatchID();

    await login.goto();
    await login.joinGame(matchId);

    const playerTitle = page.locator("#player-title");
    const boardContainer = page.locator("#board-container");

    await expect(playerTitle).toBeVisible();
    await expect(boardContainer.locator(":scope > div")).toHaveCount(1);
  });

  test("Start game as a spectator", async ({ page }) => {
    const login = new LoginPage(page);
    const matchId = helpers.generateMatchID();

    await login.goto();
    await login.joinGameAsSpectator(matchId);

    await helpers.verifySpectatorState(page);
  });

  test("UI elements are visible and enabled at game start", async ({
    page,
  }) => {
    await helpers.startGameWithRandomID(page);

    const elements = [
      "#pass-button",
      "#undo-button",
      "#guess-stone-button",
      "#resign-button",
    ];
    for (const el of elements) {
      const elementLocator = page.locator(el);
      await helpers.expectClickable(elementLocator);
    }
  });

  test("Confirm the second joining user has the other color", async ({
    browser,
  }) => {
    // Not sure why, but when repeating-each, first run is 40 something seconds, next dozen is sub 60s, subsequent time out
    test.setTimeout(120 * 1000);

    const RUNS = 100;

    for (let i = 0; i < RUNS; i++) {
      const ms = helpers.generateMatchID();

      const p1 = await helpers.createUserAndJoinMatch(browser, ms);
      const p2 = await helpers.createUserAndJoinMatch(browser, ms);

      const playerOne = await p1.locator("#player-title").textContent();
      const playerTwo = await p2.locator("#player-title").textContent();

      expect(playerOne !== playerTwo);

      await helpers.closeContexts(p1, p2);
    }
  });

  test("Confirm the user can go back to his board view by loggin in again", async ({
    browser,
  }) => {
    const { pages, ms } = await helpers.startGameAndGetAllPages(browser);

    await helpers.rejoinPage(pages.black, ms);

    await expect(pages.black.locator("#player-title")).toHaveText(
      "Black Player",
    );

    await helpers.rejoinPage(pages.white, ms);

    await expect(pages.white.locator("#player-title")).toHaveText(
      "White Player",
    );

    await helpers.verifySpectatorState(pages.spectator);

    await helpers.closeContexts(...Object.values(pages));
  });

  test("Confirm the user can't cheat by opening spectator's page: index.html", async ({
    browser,
  }) => {
    const { pages, ms } = await helpers.startGameAndGetAllPagesPOM(browser);

    await pages.black.page.goBack();

    const newPage = await pages.black.page.context().newPage();
    await helpers.startGameAsSpectatorWithMatchID(newPage, ms);

    await expect(newPage.locator("#player-title")).toHaveText("Black Player");

    await helpers.closeContextsPOM(...Object.values(pages));
  });

  // TODO: POMify
  test("Confirm the user can't cheat by opening spectator's page: games.html", async ({
    browser,
  }) => {
    const { blackPlayer, whitePlayer, ms } =
      await helpers.startGameAndGetPlayerPages(browser);

    const spectatorContext = await browser.newContext();
    const spectatorPage = await spectatorContext.newPage();
    const spectator = helpers.startGameAsSpectator(spectatorPage);

    const players = [blackPlayer, whitePlayer];

    for (const player of players) {
      const playerTitle = player.locator("#player-title");
      const playerColor = await playerTitle.textContent();
      player.goBack();
      await player.locator("#games-button").click();
      await player.getByText(ms).click();
      await expect(playerTitle).toHaveText(playerColor!);

      player.goBack();
      await player.getByText((await spectator).matchString).click();

      const boardContainer = player.locator("#board-container");

      await expect(playerTitle).toHaveCount(0);
      await expect(boardContainer.locator(":scope > div")).toHaveCount(3);
    }
  });

  test("Confirm subsequent joining users are spectators", async ({
    browser,
  }) => {
    const RUNS = 50;

    for (let i = 0; i < RUNS; i++) {
      const matchString = helpers.generateMatchID();

      // Create first two players (they join and leave immediately)
      (await helpers.createUserAndJoinMatch(browser, matchString))
        .context()
        .close();
      (await helpers.createUserAndJoinMatch(browser, matchString))
        .context()
        .close();

      // Create third user (spectator) and verify they're a spectator
      const spectatorSession = await helpers.createUserAndJoinMatch(
        browser,
        matchString,
      );

      await helpers.verifySpectatorState(spectatorSession);
      await spectatorSession.context().close();
    }
  });
});

test("Player logs in, then resigns", async ({ page }) => {
  await helpers.startGameWithRandomID(page);
  const sessionToken = await helpers.getSessionToken(page);
  await helpers.expectAny(sessionToken, [
    (t) => expect(t).not.toBeNull(),
    (t) => expect(t).not.toBe(""),
  ]);

  const resignButton = page.locator("#resign-button");

  await resignButton.click();

  const result = page.locator("#result");

  // The ! tells TypeScript: "Trust me, it's not null."
  await helpers.verifyPlayerIsOnMainPage(page, sessionToken!);
  await expect(result).toContainText("+ R");
});

test.describe("Rules", () => {
  test("Players can't place a stone on opponent's stone", async ({
    browser,
  }) => {
    const { pages } = await helpers.startGameAndGetAllPagesPOM(browser);

    const row = 5;
    const col = 5;
    const stone = helpers.stoneAtPOM(pages, row, col);

    await pages.black.clickAtCoordinate(row, col);

    // TODO: fix - white page doesn't change #player-turn
    await helpers.expectSameTextOnAllPagesPOM(
      pages,
      "#player-turn",
      "Turn: white",
    );

    await helpers.expectStoneState(stone, {
      black: 1,
      white: 0,
      spectatorMain: 1,
      spectatorBlack: 1,
      spectatorWhite: 0,
    });

    await pages.white.clickAtCoordinate(row, col);

    await helpers.expectSameTextOnAllPagesPOM(
      pages,
      "#player-turn",
      "Turn: white",
    );
    await helpers.expectStoneState(stone, {
      black: 1,
      white: 0,
      spectatorMain: 1,
      spectatorBlack: 1,
      spectatorWhite: 0,
    });

    await helpers.closeContextsPOM(...Object.values(pages));
  });
});

test.describe("Capturing stones", () => {
  test("Capturing white stones updates Black Captures", async ({ browser }) => {
    const {
      pages: { black, white, spectator },
    } = await helpers.startGameAndGetAllPagesPOM(browser);

    await black.clickAtCoordinate(0, 1);
    await white.clickAtCoordinate(0, 0);

    await helpers.expectSameTextOnAllPagesPOM(
      { black, white, spectator },
      "#black-captures",
      "Black Captures: 0",
    );

    await black.clickAtCoordinate(1, 0);

    await helpers.expectSameTextOnAllPagesPOM(
      { black, white, spectator },
      "#black-captures",
      "Black Captures: 1",
    );

    await helpers.closeContextsPOM(black, white, spectator);
  });

  test("Capturing black stones updates White Captures", async ({ browser }) => {
    const {
      pages: { black, white, spectator },
    } = await helpers.startGameAndGetAllPagesPOM(browser);

    await black.clickAtCoordinate(0, 0);
    await white.clickAtCoordinate(1, 0);
    await black.clickAtCoordinate(0, 1);
    await white.clickAtCoordinate(1, 1);
    await black.clickAtCoordinate(1, 2);

    await helpers.expectSameTextOnAllPagesPOM(
      { black, white, spectator },
      "#white-captures",
      "White Captures: 0",
    );

    await white.clickAtCoordinate(0, 2);

    await helpers.expectSameTextOnAllPagesPOM(
      { black, white, spectator },
      "#white-captures",
      "White Captures: 2",
    );

    await helpers.closeContextsPOM(black, white, spectator);
  });
});

test.describe("Undo", () => {
  test("Black plays a move, then UNDO", async ({ browser }) => {
    const {
      pages: { black, white, spectator },
    } = await helpers.startGameAndGetAllPagesPOM(browser);

    await helpers.expectTurnPOM({ black, white, spectator }, "black");
    await expect(black.stones).toHaveCount(0);

    await black.clickAtCoordinate(1, 2);

    await helpers.expectTurnPOM({ black, white, spectator }, "white");
    await expect(black.stones).toHaveCount(1);

    await black.undoButton.click();

    await helpers.expectTurnPOM({ black, white, spectator }, "black");
    await expect(black.stones).toHaveCount(0);

    await helpers.closeContextsPOM(black, white, spectator);
  });

  test("Black passes, then UNDO", async ({ browser }) => {
    const { pages } = await helpers.startGameAndGetAllPagesPOM(browser);

    await helpers.expectTurnPOM(pages, "black");

    await pages.black.passButton.click();

    await helpers.expectTurnPOM(pages, "white");

    await pages.black.undoButton.click();

    await helpers.expectTurnPOM(pages, "black");

    await helpers.closeContextsPOM(...Object.values(pages));
  });

  test("White passes, then UNDO", async ({ browser }) => {
    const { pages } = await helpers.startGameAndGetAllPagesPOM(browser);

    await pages.black.clickAtCoordinate(5, 5);

    await helpers.expectTurnPOM(pages, "white");

    await pages.white.passButton.click();

    await helpers.expectTurnPOM(pages, "black");

    await pages.white.undoButton.click();

    await helpers.expectTurnPOM(pages, "white");

    await helpers.closeContextsPOM(...Object.values(pages));
  });

  test("White UNDO, black UNDO", async ({ browser }) => {
    const { pages } = await helpers.startGameAndGetAllPagesPOM(browser);

    await expect(pages.black.stones).toHaveCount(0);
    await expect(pages.white.stones).toHaveCount(0);
    await expect(pages.spectator.mainBoardStones).toHaveCount(0);

    await pages.black.clickAtCoordinate(1, 1);
    await pages.white.clickAtCoordinate(5, 5);

    await expect(pages.black.stones).toHaveCount(1);
    await expect(pages.white.stones).toHaveCount(1);
    await expect(pages.spectator.mainBoardStones).toHaveCount(2);

    await helpers.expectTurnPOM(pages, "black");

    await pages.white.undoButton.click();

    await expect(pages.black.stones).toHaveCount(1);
    await expect(pages.white.stones).toHaveCount(0);
    await expect(pages.spectator.mainBoardStones).toHaveCount(1);

    await helpers.expectTurnPOM(pages, "white");

    await pages.black.undoButton.click();

    await expect(pages.black.stones).toHaveCount(0);
    await expect(pages.white.stones).toHaveCount(0);
    await expect(pages.spectator.mainBoardStones).toHaveCount(0);

    await helpers.expectTurnPOM(pages, "black");

    await helpers.closeContextsPOM(...Object.values(pages));
  });

  test("Capturing white stone, then undo", async ({ browser }) => {
    const { pages } = await helpers.startGameAndGetAllPagesPOM(browser);

    await pages.black.clickAtCoordinate(0, 1);
    await pages.white.clickAtCoordinate(0, 0);

    await helpers.expectSameTextOnAllPagesPOM(
      pages,
      "#black-captures",
      "Black Captures: 0",
    );

    await pages.black.clickAtCoordinate(1, 0);

    await helpers.expectSameTextOnAllPagesPOM(
      pages,
      "#black-captures",
      "Black Captures: 1",
    );

    await pages.black.undoButton.click();

    await helpers.expectSameTextOnAllPagesPOM(
      pages,
      "#black-captures",
      "Black Captures: 0",
    );

    await helpers.closeContextsPOM(...Object.values(pages));
  });
});

test.describe("Passing", () => {
  test("Black passes", async ({ browser }) => {
    const { pages } = await helpers.startGameAndGetAllPagesPOM(browser);

    await helpers.expectTurnPOM(pages, "black");

    await pages.black.passButton.click();

    await helpers.boardRefreshPOM(pages.black, pages.white);

    await helpers.expectTurnPOM(pages, "white");

    await helpers.closeContextsPOM(...Object.values(pages));
  });

  test("White passes", async ({ browser }) => {
    const { pages } = await helpers.startGameAndGetAllPagesPOM(browser);

    await pages.black.clickAtCoordinate(6, 6);

    await helpers.boardRefreshPOM(pages.black, pages.white);

    await helpers.expectTurnPOM(pages, "white");

    await pages.white.passButton.click();

    await helpers.boardRefreshPOM(pages.black, pages.white);

    await helpers.expectTurnPOM(pages, "black");

    await helpers.closeContextsPOM(...Object.values(pages));
  });

  // TODO: POMify
  test("Both players passing consecutively results in transfer to Main Board", async ({
    browser,
  }) => {
    const { blackPlayer, whitePlayer } =
      await helpers.startGameAndGetPlayerPages(browser);

    const blackPassButton = blackPlayer.locator("#pass-button");
    const whitePassButton = whitePlayer.locator("#pass-button");

    await blackPassButton.click();
    await whitePassButton.click();

    await helpers.boardRefresh(blackPlayer, whitePlayer);

    await helpers.verifyPlayerIsOnMainPage(
      blackPlayer,
      (await helpers.getSessionToken(blackPlayer))!,
    );
    await helpers.verifyPlayerIsOnMainPage(
      whitePlayer,
      (await helpers.getSessionToken(whitePlayer))!,
    );

    await helpers.closeContexts(blackPlayer, whitePlayer);
  });
});

test.describe("Counting", () => {
  test("Player 1 selects a dead stone, Player 2 counts score", async ({
    browser,
  }) => {
    const { pages } = await helpers.startGameAndGetAllPagesPOM(browser);

    await pages.black.clickAtCoordinate(5, 5);

    await pages.white.passButton.click();
    await pages.black.passButton.click();

    await pages.white.waitForTimeout();
    await pages.white.clickAtCoordinate(5, 5);

    const countButton = pages.black.locator("#count-score-button");
    await helpers.expectClickable(countButton);
    await countButton.click();

    await pages.black.waitForTimeout();
    await helpers.expectSameTextOnAllPagesPOM(
      pages,
      "#black-ready",
      "Black: ready",
    );

    await pages.white.locator("#count-score-button").click();

    expect(await pages.white.locator("#result").textContent()).toBe(
      "White +2.5",
    );

    await helpers.closeContextsPOM(...Object.values(pages));
  });

  test("Player selects a dead stone, counts, then deselects", async ({
    browser,
  }) => {
    const { pages } = await helpers.startGameAndGetAllPagesPOM(browser);

    await pages.black.clickAtCoordinate(5, 5);

    await pages.white.passButton.click();
    await pages.black.passButton.click();

    await pages.black.locator(".stone").first().click();

    await pages.black.waitForTimeout(1000);
    await pages.black.locator("#count-score-button").click();

    await pages.black.waitForTimeout(1000);
    await helpers.expectSameTextOnAllPagesPOM(
      pages,
      "#black-ready",
      "Black: ready",
    );

    const selectedStone = pages.black.locator(".stone").first();
    await selectedStone.click();

    await pages.black.waitForTimeout(1000);
    await helpers.expectSameTextOnAllPagesPOM(
      pages,
      "#black-ready",
      "Black: selecting dead stones",
    );

    await helpers.closeContextsPOM(...Object.values(pages));
  });

  test("Player selects a dead stone, counts, then other player deselects", async ({
    browser,
  }) => {
    const { pages } = await helpers.startGameAndGetAllPagesPOM(browser);

    await pages.black.clickAtCoordinate(5, 5);

    await pages.white.passButton.click();
    await pages.black.passButton.click();

    await pages.black.waitForTimeout(1000);
    await pages.black.locator("#count-score-button").click();

    await pages.black.waitForTimeout(1000);
    await helpers.expectSameTextOnAllPagesPOM(
      pages,
      "#black-ready",
      "Black: ready",
    );

    const selectedStone = pages.white.locator(".stone").first();
    await selectedStone.click();

    await pages.black.waitForTimeout(1000);
    await helpers.expectSameTextOnAllPagesPOM(
      pages,
      "#black-ready",
      "Black: selecting dead stones",
    );

    await helpers.closeContextsPOM(...Object.values(pages));
  });

  test("Spectator counts score - doesn't affect the game", async ({
    browser,
  }) => {
    const { pages } = await helpers.startGameAndGetAllPagesPOM(browser);

    await pages.black.locator("#pass-button").click();
    await pages.white.locator("#pass-button").click();

    await pages.spectator.waitForTimeout(1000);
    await pages.spectator.locator("#count-score-button").click();

    await helpers.expectSameTextOnAllPagesPOM(
      pages,
      "#black-ready",
      "Black: selecting dead stones",
    );
    await helpers.expectSameTextOnAllPagesPOM(
      pages,
      "#white-ready",
      "White: selecting dead stones",
    );

    await helpers.closeContextsPOM(...Object.values(pages));
  });
});

test.describe("Guess stones", () => {
  test("Add/remove guess stone and check its status after each click", async ({
    page,
  }) => {
    await helpers.startGameWithRandomID(page);

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
    await helpers.startGameWithRandomID(page);

    await page.locator("#guess-stone-button").click();

    const board = page.locator("svg");
    const box = await board.boundingBox();

    for (let i = 0; i < 100; i++) {
      await helpers.clickCenter(page, box);
    }

    await page.waitForTimeout(100);
    await expect(page.locator(".stone")).toHaveCount(0);

    for (let i = 0; i < 101; i++) {
      await helpers.clickCenter(page, box);
    }
    await page.waitForTimeout(100);

    await expect(page.locator(".stone")).toHaveCount(1);
  });

  test("Add then remove all guess stones in quick succession", async ({
    page,
  }) => {
    await helpers.startGameWithRandomID(page);

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
    await helpers.startGameWithRandomID(page);

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
      NETWORK_PRESETS.Regular3G,
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
      NETWORK_PRESETS.Regular2G,
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

test("Tests helpers.clickAtCoordinate()", async ({ page }) => {
  await helpers.startGameWithRandomID(page);

  await page.locator("#guess-stone-button").click();

  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      await helpers.clickAtCoordinate(page, i, j);
      const stone = page.locator(`.stone[data-row="${i}"][data-col="${j}"]`);
      await expect(stone).toBeVisible();
    }
  }
});
