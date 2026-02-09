import { Page, Locator, expect } from "playwright/test";

export class PlayerPage {
  constructor(readonly page: Page) {}

  get playerTitle() {
    return this.page.locator("#player-title");
  }

  get stonesInAtari() {
    return this.page.locator("#stones-in-atari");
  }

  get playerTurn(): Locator {
    return this.page.locator("#player-turn");
  }

  get blackCaptures(): Locator {
    return this.page.locator("#black-captures");
  }

  get whiteCaptures(): Locator {
    return this.page.locator("#white-captures");
  }

  get undoButton(): Locator {
    return this.page.locator("#undo-button");
  }

  get passButton(): Locator {
    return this.page.locator("#pass-button");
  }

  get guessStoneButton(): Locator {
    return this.page.locator("#guess-stone-button");
  }

  get resignButton(): Locator {
    return this.page.locator("#resign-button");
  }

  async clickAtCoordinate(x: number, y: number) {
    const intersection = this.page.locator(
      `circle[data-row="${x}"][data-col="${y}"][fill="transparent"]`,
    );

    await intersection.click();
  }

  async clickUndo() {
    await this.undoButton.click();
  }

  async clickPass() {
    await this.passButton.click();
  }

  async clickGuessStoneButton() {
    await this.guessStoneButton.click();
  }

  async clickResign() {
    await this.resignButton.click();
  }
}
