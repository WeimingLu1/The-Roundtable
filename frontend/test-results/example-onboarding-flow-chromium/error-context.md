# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: example.spec.ts >> onboarding flow
- Location: tests/example.spec.ts:3:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[placeholder="Enter your name"]')

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('onboarding flow', async ({ page }) => {
  4  |   await page.goto('/');
  5  | 
  6  |   // Enter name
> 7  |   await page.fill('input[placeholder="Enter your name"]', 'TestUser');
     |              ^ Error: page.fill: Test timeout of 30000ms exceeded.
  8  |   await page.click('button:has-text("Enter")');
  9  | 
  10 |   // Should be on landing page
  11 |   await expect(page.locator('h1')).toContainText('The Roundtable');
  12 | });
  13 | 
  14 | test('landing page has topic input', async ({ page }) => {
  15 |   await page.goto('/');
  16 | 
  17 |   // Fill name and continue
  18 |   await page.fill('input[placeholder="Enter your name"]', 'TestUser');
  19 |   await page.click('button:has-text("Enter")');
  20 | 
  21 |   // Should see topic textarea
  22 |   await expect(page.locator('textarea[placeholder*="debate"]')).toBeVisible();
  23 | 
  24 |   // Should see Summon Guests button
  25 |   await expect(page.locator('button:has-text("Summon Guests")')).toBeVisible();
  26 | 
  27 |   // Should see Random button
  28 |   await expect(page.locator('button:has-text("Random")')).toBeVisible();
  29 | });
  30 | 
```