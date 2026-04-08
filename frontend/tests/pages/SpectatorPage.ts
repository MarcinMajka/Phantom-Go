import { Page, Locator } from "playwright/test";

export class SpectatorPage {
  constructor(readonly page: Page) {}

  // Could be useful for checking if Player is on Main page
  get playerTitle() {
    return this.page.locator("#player-title");
  }

  get mainBoardStones(): Locator {
    return this.page.locator("#main-board .stone");
  }

  get blackBoardStones(): Locator {
    return this.page.locator("#black-player-board .stone");
  }

  get whiteBoardStones(): Locator {
    return this.page.locator("#white-player-board .stone");
  }

  locator(selector: string) {
    return this.page.locator(selector);
  }

  async clickAtCoordinate(x: number, y: number) {
    if (
      await this.page.evaluate(() =>
        window.location.pathname.includes("main.html"),
      )
    ) {
      await this.page
        .locator(`#main-board .stone[data-row="${x}"][data-col="${y}"]`)
        .click();

      return;
    }

    const intersection = this.page.locator(
      `circle[data-row="${x}"][data-col="${y}"][fill="transparent"]`,
    );

    await intersection.click();
  }

  async waitForTimeout(timeout = 1000) {
    await this.page.waitForTimeout(timeout);
  }
}
