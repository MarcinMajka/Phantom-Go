import { Page, Locator, expect } from "playwright/test";

export class PlayerPage {
  constructor(readonly page: Page) {}

  get whiteCaptures(): Locator {
    return this.page.locator("#white-captures");
  }

  async clickAtCoordinate(x: number, y: number) {
    const intersection = this.page.locator(
      `circle[data-row="${x}"][data-col="${y}"][fill="transparent"]`,
    );

    await intersection.click();
  }
}
