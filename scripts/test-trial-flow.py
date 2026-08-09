import asyncio
import os
import json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Step 1: Open Home and check Trial button
        print("--- Step 1: Homepage Verification ---")
        await page.goto("http://localhost:8080")
        await page.wait_for_selector('text=Gerar Trial')
        print("✓ Homepage trial button present")

        # Step 2: Simulate Trial Intent and Auth redirect
        print("--- Step 2: Auth Redirect Verification ---")
        await page.click('text=Gerar Trial')
        await page.wait_for_url("**/auth?mode=up&trial=true")
        print(f"✓ Correct redirect to auth with trial param: {page.url}")

        # Step 3: Check UI components for trial activation (Placeholder for actual session check)
        # Note: We can't easily sign up/login without email confirmation unless bypass is active
        # But we can check if the dashboard logic correctly handles the param
        
        await browser.close()
        print("--- End of Automated Test ---")

if __name__ == "__main__":
    asyncio.run(main())
