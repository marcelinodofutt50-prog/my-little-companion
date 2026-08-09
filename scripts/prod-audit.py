import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

# Injected session variables for Supabase auth
STORAGE_KEY = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
SESSION_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
COOKIES_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

SCREENSHOTS = Path("/tmp/browser/screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        
        # 1. Restore cookies for SSR
        if COOKIES_JSON:
            cookies = json.loads(COOKIES_JSON)
            for c in cookies:
                c["url"] = "http://localhost:8080"
            await context.add_cookies(cookies)

        page = await context.new_page()

        # 2. Establish origin and restore localStorage for SPA client
        await page.goto("http://localhost:8080")
        if STORAGE_KEY and SESSION_JSON:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(STORAGE_KEY)}, {json.dumps(SESSION_JSON)})"
            )
        
        # Start audit
        results = {}
        
        # --- 1. Homepage & Public Pages ---
        print("Checking Homepage...")
        await page.goto("http://localhost:8080", wait_until="networkidle")
        await page.screenshot(path=str(SCREENSHOTS / "1_homepage.png"))
        results["homepage"] = "OK"

        # Check for critical hydration/console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        
        # --- 2. Training Hub (PGRST108 check) ---
        print("Checking Training Hub...")
        await page.goto("http://localhost:8080/tutoriais", wait_until="networkidle")
        await page.screenshot(path=str(SCREENSHOTS / "2_training_hub.png"))
        
        # Check if tutorial progress exists or triggers error toast
        toast_error = await page.locator("div[role='alert']").filter(has_text="PGRST108").is_visible()
        results["training_hub_sync_error"] = toast_error

        # --- 3. Kraken (Background check) ---
        print("Checking Kraken...")
        await page.goto("http://localhost:8080/servidor/kraken", wait_until="networkidle")
        await page.screenshot(path=str(SCREENSHOTS / "3_kraken.png"))
        
        # Verify background v18 asset URL presence
        bg_loaded = await page.evaluate("""
            () => {
                const bg = document.querySelector('div[style*="krakenbackground-18.jpg"]');
                return !!bg;
            }
        """)
        results["kraken_bg_v18"] = bg_loaded

        # --- 4. Light Mode Contrast ---
        print("Checking Light Mode...")
        # Toggle light mode via search param as configured in index.tsx
        await page.goto("http://localhost:8080/?theme=light", wait_until="networkidle")
        await page.screenshot(path=str(SCREENSHOTS / "4_light_mode.png"))
        
        # --- 5. Staff Panel (Permission check) ---
        print("Checking Admin/Staff Access...")
        await page.goto("http://localhost:8080/admin", wait_until="networkidle")
        await page.screenshot(path=str(SCREENSHOTS / "5_admin.png"))
        
        # Log findings
        print(json.dumps({
            "results": results,
            "console_errors": console_errors,
            "final_url": page.url
        }, indent=2))

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
