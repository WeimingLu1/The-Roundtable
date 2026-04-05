# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: example.spec.ts >> landing page has topic input
- Location: tests/example.spec.ts:14:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[placeholder="Enter your name"]')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:css] [postcss] It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin. The PostCSS plugin has moved to a separate package, so to continue using Tailwind CSS with PostCSS you'll need to install `@tailwindcss/postcss` and update your PostCSS configuration."
  - generic [ref=e5]: at at (/Users/weiminglu/Projects/roundtable/node_modules/tailwindcss/dist/lib.js:38:1643) at LazyResult.runOnRoot (/Users/weiminglu/Projects/roundtable/node_modules/postcss/lib/lazy-result.js:361:16) at LazyResult.runAsync (/Users/weiminglu/Projects/roundtable/node_modules/postcss/lib/lazy-result.js:290:26) at LazyResult.async (/Users/weiminglu/Projects/roundtable/node_modules/postcss/lib/lazy-result.js:192:30) at LazyResult.then (/Users/weiminglu/Projects/roundtable/node_modules/postcss/lib/lazy-result.js:436:17
  - generic [ref=e6]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e7]: server.hmr.overlay
    - text: to
    - code [ref=e8]: "false"
    - text: in
    - code [ref=e9]: vite.config.ts
    - text: .
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('onboarding flow', async ({ page }) => {
  4  |   await page.goto('/');
  5  | 
  6  |   // Enter name
  7  |   await page.fill('input[placeholder="Enter your name"]', 'TestUser');
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
> 18 |   await page.fill('input[placeholder="Enter your name"]', 'TestUser');
     |              ^ Error: page.fill: Test timeout of 30000ms exceeded.
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