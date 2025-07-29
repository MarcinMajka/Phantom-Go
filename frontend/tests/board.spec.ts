import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://127.0.0.1:5501/frontend/index.html');
  await page.getByRole('textbox', { name: 'Enter match string' }).fill(';hlmlykmnglhkmnglhlwkmsnglhk');
  await page.locator('button').click();
  await page.locator('#guess-stone-button').click();
  await page.locator('#remove-stone-button').click();

  for (let i = 0; i < 2 * 1000; i++) {
    console.log(`Iteration: ${i}`);
    await page.locator('circle:nth-child(130)').click();
    await page.locator('.stone').click(); 
  }
  
});
