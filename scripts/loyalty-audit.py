import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS = Path("/tmp/browser/loyalty-audit/screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # 1. Setup Session if available
        storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

        if cookies_json:
            cookies = json.loads(cookies_json)
            for c in cookies:
                c["url"] = "https://www.shadowdashstore.com"
            await context.add_cookies(cookies)

        await page.goto("https://www.shadowdashstore.com")
        if storage_key and session_json:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )

        print("--- AUDITORIA LOYALTY ---")

        # 2. Test Loyalty Dashboard
        await page.goto("https://www.shadowdashstore.com/fidelidade")
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path=str(SCREENSHOTS / "1_loyalty_dashboard.png"))
        print("Dashboard Fidelidade carregado.")

        # Check for errors in console
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        
        # Check for specific elements
        points_element = page.locator("text=Shadow Points")
        if await points_element.is_visible():
            print("Elemento 'Shadow Points' visível.")
        else:
            print("AVISO: Elemento 'Shadow Points' não encontrado.")

        missions_title = page.locator("text=Missões Disponíveis")
        if await missions_title.is_visible():
            print("Seção de Missões visível.")
        else:
            print("AVISO: Seção de Missões não encontrada.")

        # 3. Test Dark/Light Mode
        await page.evaluate("document.documentElement.classList.add('dark')")
        await page.screenshot(path=str(SCREENSHOTS / "2_dark_mode.png"))
        print("Screenshot Dark Mode capturado.")

        await page.evaluate("document.documentElement.classList.remove('dark')")
        await page.evaluate("document.documentElement.classList.add('theme-light')")
        await page.screenshot(path=str(SCREENSHOTS / "3_light_mode.png"))
        print("Screenshot Light Mode capturado.")

        # 4. Test Mobile View
        await page.set_viewport_size({"width": 375, "height": 812})
        await page.screenshot(path=str(SCREENSHOTS / "4_mobile_view.png"))
        print("Screenshot Mobile capturado.")

        # 5. Production URL Check (Simulated check of metadata/availability)
        prod_url = "https://www.shadowdashstore.com/fidelidade"
        print(f"Targeting Production URL for future validation: {prod_url}")

        if console_errors:
            print("ERROS DE CONSOLE ENCONTRADOS:")
            for err in console_errors:
                print(f"- {err}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
