import { test, expect } from '@playwright/test';

test('Change in guess stones in quick succession', async ({ page }) => {
  const longRandomString = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  
  await page.goto('/frontend/index.html');
  await page.locator('#match-string').fill(longRandomString);
  await page.locator('button').click();
  await page.locator('#guess-stone-button').click();
  await page.locator('#remove-stone-button').click();

  const guessStone = page.locator('.stone');
  const emptyField = page.locator('circle:nth-child(130)');

  for (let i = 0; i < 100; i++) {
    await emptyField.click();
    expect(guessStone).toBeVisible();
    await guessStone.click();
    expect(emptyField).toBeVisible();
  }
});
