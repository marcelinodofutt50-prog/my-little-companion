import { test, expect } from 'vitest';
import { chromium } from 'playwright';

test('verify kraken background assets', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate and wait for some reasonable time for assets to resolve
    await page.goto('http://localhost:8080/servidor/kraken', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); 
    
    const bgVisibility = await page.evaluate(() => {
      const overlays = Array.from(document.querySelectorAll('.absolute.inset-0.bg-cover'));
      return overlays.map(el => {
        const style = window.getComputedStyle(el);
        return {
          hasBg: style.backgroundImage !== 'none' && !style.backgroundImage.includes('none'),
          url: style.backgroundImage,
          opacity: style.opacity
        };
      });
    });
    
    console.log('Background Visibility:', JSON.stringify(bgVisibility, null, 2));
    
    const hasBackground = bgVisibility.some((v: any) => v.hasBg);
    expect(hasBackground).toBe(true);
  } finally {
    await browser.close();
  }
}, 30000);
