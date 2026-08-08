import { test, expect } from '@playwright/test';

test('verify kraken background assets', async ({ page }) => {
  await page.goto('http://localhost:8080/servidor/kraken');
  
  // Wait for some time to allow images to trigger their onload/onerror
  await page.waitForTimeout(2000);
  
  // Check if any tactical background is visible (has a background-image with a URL)
  const bgVisibility = await page.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll('.absolute.inset-0.bg-cover'));
    return overlays.map(el => {
      const style = window.getComputedStyle(el);
      return {
        hasBg: style.backgroundImage !== 'none',
        url: style.backgroundImage,
        opacity: style.opacity
      };
    });
  });
  
  console.log('Background Visibility:', JSON.stringify(bgVisibility, null, 2));
  
  // At least one background should be set
  const hasBackground = bgVisibility.some(v => v.hasBg);
  expect(hasBackground).toBe(true);
});
