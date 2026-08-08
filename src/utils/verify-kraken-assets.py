import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        print("Navigating to Kraken page...")
        await page.goto("http://localhost:8080/servidor/kraken", wait_until="domcontentloaded")
        
        # Wait for potential hydration and image trigger
        await asyncio.sleep(3)
        
        bg_visibility = await page.evaluate("""() => {
            const overlays = Array.from(document.querySelectorAll('.absolute.inset-0.bg-cover'));
            return overlays.map(el => {
                const style = window.getComputedStyle(el);
                return {
                    hasBg: style.backgroundImage !== 'none' && !style.backgroundImage.includes('none'),
                    url: style.backgroundImage,
                    opacity: style.opacity
                };
            });
        }""")
        
        print(f"Background Visibility: {json.dumps(bg_visibility, indent=2)}")
        
        has_background = any(v['hasBg'] for v in bg_visibility)
        if has_background:
            print("SUCCESS: Kraken background detected.")
        else:
            print("FAILURE: No Kraken background detected.")
            # Take a screenshot to debug
            await page.screenshot(path="/tmp/browser/kraken_error.png")
            print("Screenshot saved to /tmp/browser/kraken_error.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
