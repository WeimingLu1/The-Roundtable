import { test, expect } from '@playwright/test';

test('onboarding flow', async ({ page }) => {
  await page.goto('/');

  // Enter name
  await page.fill('input[placeholder="Enter your name"]', 'TestUser');
  await page.click('button:has-text("Enter")');

  // Should be on landing page
  await expect(page.locator('h1')).toContainText('The Roundtable');
});

test('landing page has topic input', async ({ page }) => {
  await page.goto('/');

  // Fill name and continue
  await page.fill('input[placeholder="Enter your name"]', 'TestUser');
  await page.click('button:has-text("Enter")');

  // Should see topic textarea
  await expect(page.locator('textarea[placeholder*="debate"]')).toBeVisible();

  // Should see Summon Guests button
  await expect(page.locator('button:has-text("Summon Guests")')).toBeVisible();

  // Should see Random button
  await expect(page.locator('button:has-text("Random")')).toBeVisible();
});
