import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS = Path("/tmp/browser/screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        errors = []
        page.on("pageerror", lambda exc: errors.append(f"PAGE_ERROR: {exc}"))
        page.on("console", lambda msg: errors.append(f"CONSOLE_{msg.type.upper()}: {msg.text}") if msg.type == "error" else None)

        print("Starting deep audit on Homepage...")
        await page.goto("http://localhost:8080", wait_until="networkidle")
        await page.screenshot(path=str(SCREENSHOTS / "audit_homepage.png"))
        
        # Check for broken images manually in DOM
        broken_imgs = await page.evaluate("""
            () => Array.from(document.querySelectorAll('img')).filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src)
        """)
        
        # Check for hydration errors by looking for specific React warnings in console
        hydration_issues = [e for e in errors if "hydration" in e.lower()]

        print(json.dumps({
            "errors": errors,
            "broken_images": broken_imgs,
            "hydration_issues": hydration_issues,
            "url": page.url
        }, indent=2))

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
