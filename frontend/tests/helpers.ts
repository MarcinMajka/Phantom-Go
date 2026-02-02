import { Page, Browser, Locator, expect } from "@playwright/test";

export function generateMatchID() {
  return (
    Math.random().toString(36).substring(2) +
    Math.random().toString(36).substring(2)
  );
}

export async function startGameWithRandomID(page: Page) {
  const matchString = generateMatchID();
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(matchString);
  await page.locator("#join-button").click();

  return { page, matchString };
}

export async function startGameWithID(page: Page, matchString: string) {
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(matchString);
  await page.locator("#join-button").click();
}

export async function startGameAsSpectator(page: Page) {
  const matchString = generateMatchID();
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(matchString);
  await page.locator("#spectator-checkbox").click();
  await page.locator("#join-button").click();

  return { page, matchString };
}

export async function startGameAsSpectatorWithMatchID(
  page: Page,
  matchString: string,
) {
  await page.goto("/frontend/index.html");
  await page.locator("#match-string").fill(matchString);
  await page.locator("#spectator-checkbox").click();
  await page.locator("#join-button").click();

  return page;
}

export async function verifySpectatorState(page: Page) {
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

export async function verifyPlayerIsOnMainPage(
  page: Page,
  sessionToken: string,
) {
  const playerTitle = page.locator("#player-title");
  const boardContainer = page.locator("#board-container");

  await expect(playerTitle).toHaveCount(0);
  await expect(boardContainer.locator(":scope > div")).toHaveCount(3);
  await expect(await getSessionToken(page)).toBe(sessionToken);
}

export async function createUserAndJoinMatch(
  browser: Browser,
  matchString: string,
) {
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

export async function getPlayerPages(
  page1: Page,
  page2: Page,
): Promise<PlayerPages> {
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
export async function clickCenter(page: Page, box: BoundingBox | null) {
  if (!box) throw new Error("Bounding box is null");

  const x = box.x + box.width / 2;
  const y = box.y + box.width / 2;

  await page.mouse.click(x, y);
}

export async function clickAtCoordinate(page: Page, x: number, y: number) {
  const intersection = page.locator(
    `circle[data-row="${x}"][data-col="${y}"][fill="transparent"]`,
  );

  await intersection.click();
}

export async function validateStonePlacement(locator: Locator, color: string) {
  await expect(locator).toHaveAttribute("fill", color);
}

export async function getSessionToken(player: Page) {
  try {
    return await player.evaluate(() => localStorage.getItem("sessionToken"));
  } catch (error) {
    // If navigation happened, wait and retry
    await player.waitForLoadState("domcontentloaded");
    return await player.evaluate(() => localStorage.getItem("sessionToken"));
  }
}

export async function expectAny<T>(
  value: T,
  assertions: Array<(fn: T) => void | Promise<void>>,
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
    "All assertions failed:\n" + errors.map((e) => e.message).join("\n"),
  );
}

export async function startGameAndGetPlayerPages(browser: Browser) {
  const ms = generateMatchID();

  const p1 = await createUserAndJoinMatch(browser, ms);
  const p2 = await createUserAndJoinMatch(browser, ms);

  const playerPages = await getPlayerPages(p1, p2);

  return { ...playerPages, ms };
}

export async function boardRefresh(blackPlayer: Page, whitePlayer: Page) {
  await blackPlayer.waitForTimeout(1000);
  await whitePlayer.waitForTimeout(1000);
}

export async function closeContexts(...pages: Page[]) {
  for (const page of pages) {
    await page.context().close();
  }
}

interface Pages {
  black: Page;
  white: Page;
  spectator: Page;
}

export async function expectSameTextOnAllPages(
  pages: Pages,
  elementId: string,
  text: string,
) {
  const blackPageElement = pages.black.locator(elementId);
  const whitePageElement = pages.white.locator(elementId);
  const spectatorPageElement = pages.spectator.locator(elementId);

  await expect(blackPageElement).toHaveText(text);
  await expect(whitePageElement).toHaveText(text);
  await expect(spectatorPageElement).toHaveText(text);
}

export async function startGameAndGetAllPages(browser: Browser) {
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

export async function rejoinPage(player: Page, matchString: string) {
  await player.goBack();
  await player.locator("#match-string").fill(matchString);
  await player.locator("#join-button").click();
}

interface StoneLocatorsByRole {
  black: Locator;
  white: Locator;
  spectator: Locator;
}

export async function getStoneLocatorsForPages(
  pages: Pages,
  stoneLocator: string,
): Promise<StoneLocatorsByRole> {
  return {
    black: pages.black.locator(stoneLocator),
    white: pages.white.locator(stoneLocator),
    spectator: pages.spectator.locator(stoneLocator),
  };
}

export function stoneAt(pages: Pages, row: number, col: number) {
  const selector = `.stone[data-row="${row}"][data-col="${col}"]`;

  return {
    black: pages.black.locator(selector),
    white: pages.white.locator(selector),
    spectatorMain: pages.spectator.locator("#main-board").locator(selector),
    spectatorBlack: pages.spectator
      .locator("#black-player-board")
      .locator(selector),
    spectatorWhite: pages.spectator
      .locator("#white-player-board")
      .locator(selector),
  };
}

export async function expectStoneState(
  stone: ReturnType<typeof stoneAt>,
  {
    black = 0,
    white = 0,
    spectatorMain = 0,
    spectatorBlack = 0,
    spectatorWhite = 0,
  }: {
    black?: number;
    white?: number;
    spectatorMain?: number;
    spectatorBlack?: number;
    spectatorWhite?: number;
  },
) {
  await expect(stone.black).toHaveCount(black);
  await expect(stone.white).toHaveCount(white);
  await expect(stone.spectatorMain).toHaveCount(spectatorMain);
  await expect(stone.spectatorBlack).toHaveCount(spectatorBlack);
  await expect(stone.spectatorWhite).toHaveCount(spectatorWhite);
}

export async function expectClickable(locator: Locator, timeout = 1000) {
  await expect(locator).toBeVisible({ timeout });
  await expect(locator).toBeEnabled({ timeout });
}
