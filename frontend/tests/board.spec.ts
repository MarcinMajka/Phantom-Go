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

test("Add then remove all guess stones in quick succession", async ({ page }) => {
  const longRandomString = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

  await page.goto('/frontend/index.html');
  await page.locator('#match-string').fill(longRandomString);
  await page.locator('button').click();
  await page.locator('#guess-stone-button').click(); 

  for (let i = 33; i <= 202; i++) {
    await page.locator(`circle:nth-child(${i})`).click();
  }
  
  const guessStones = page.locator('.stone');
  const count = await guessStones.count();

  for (let i = 0; i < count; i++) {
    expect(guessStones.nth(i)).toBeVisible();
  }

  await page.locator('#remove-stone-button').click();

  for (let i = 0; i < count; i++) {
    await guessStones.last().click();
  }

  expect(page.locator('.stone')).toHaveCount(0);
});

test("Throttled - 3G: Add then remove all guess stones in quick succession", async ({ context, page }) => {
    // Setting a longer timeout for this test
    test.setTimeout(120000);

    const longRandomString = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

    // Initiate throttling with Chrome DevTools Protocol
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('Network.emulateNetworkConditions', {
        // Cellular 3G emulation
        offline: false,
        downloadThroughput: (750 * 1024) / 8,
        uploadThroughput: (250 * 1024) / 8,
        latency: 100,
    });

  await page.goto('/frontend/index.html');
  await page.locator('#match-string').fill(longRandomString);
  await page.locator('button').click();

  await page.waitForLoadState('networkidle');

  await page.locator('#guess-stone-button').click(); 

  for (let i = 33; i <= 202; i++) {
    await page.locator(`circle:nth-child(${i})`).click();
  }
  
  const guessStones = page.locator('.stone');
  const count = await guessStones.count();

  for (let i = 0; i < count; i++) {
    expect(guessStones.nth(i)).toBeVisible();
  }

  await page.locator('#remove-stone-button').click();
  
  // Change to decrementing for checking each change
  for (let i = count; i > 0; i--) {
    await guessStones.last().click();
    await expect(guessStones).toHaveCount(i - 1);
  }
});