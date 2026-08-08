import { test, expect } from 'vitest';
import playwright from 'playwright';

test('verify kraken background assets', async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.new_context();
  const page = await context.new_page();
  
  try {
    await page.goto('http://localhost:8080/servidor/kraken', { waitUntil: 'networkidle' });
    
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
  } finally {
    await browser.close();
  }
}, 30000);
