import { Page } from "@playwright/test";

export class LoginPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto("/frontend/index.html");
  }

  async joinGame(matchString: string) {
    await this.page.locator("#match-string").fill(matchString);
    await this.page.locator("#join-button").click();
  }

  async joinGameAsSpectator(matchString: string) {
    await this.page.locator("#match-string").fill(matchString);
    await this.page.locator("#spectator-checkbox").click();
    await this.page.locator("#join-button").click();
  }
}
