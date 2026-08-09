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
                c["url"] = "http://localhost:8080"
            await context.add_cookies(cookies)

        await page.goto("http://localhost:8080")
        if storage_key and session_json:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )

        print("--- AUDITORIA LOYALTY ---")

        # 2. Test Loyalty Dashboard
        # First check if the path exists locally to avoid 404
        await page.goto("http://localhost:8080/fidelidade")
        
        # Wait for either the content or a redirect
        try:
            await page.wait_for_selector("h1", timeout=5000)
        except:
            print("Página /fidelidade não carregou cabeçalho h1. Pode ser um erro de Auth ou 404.")
            
        await page.screenshot(path=str(SCREENSHOTS / "1_loyalty_dashboard.png"))
        print(f"Dashboard carregado em: {page.url}")

        # Check for Shadow Points
        points_element = page.locator("text=Shadow Points")
        if await points_element.count() > 0:
            print("SUCCESS: Elemento 'Shadow Points' encontrado.")
        else:
            print("FAILURE: Elemento 'Shadow Points' não encontrado.")

        # Check for Missions
        missions_title = page.locator("text=Missões Disponíveis")
        if await missions_title.count() > 0:
            print("SUCCESS: Seção de Missões encontrada.")
        else:
            print("FAILURE: Seção de Missões não encontrada.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
