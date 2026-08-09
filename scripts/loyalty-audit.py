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

        print("--- AUDITORIA TÉCNICA LOYALTY ---")
        await page.goto("http://localhost:8080/fidelidade")
        
        try:
            # Espera pelo esqueleto de carregamento sumir ou pelo título aparecer
            await page.wait_for_selector("h1", timeout=10000)
            print("SUCCESS: Componente Loyalty renderizado.")
        except:
            print("WARNING: Timeout ao esperar h1. Verificando DOM...")
            
        await page.screenshot(path=str(SCREENSHOTS / "final_audit.png"))

        # Verifica Shadow Points
        has_points = await page.locator("text=Shadow Points").count() > 0
        print(f"{'SUCCESS' if has_points else 'FAILURE'}: Shadow Points encontrado.")

        # Verifica Missões
        has_missions = await page.locator("text=Missões Disponíveis").count() > 0
        print(f"{'SUCCESS' if has_missions else 'FAILURE'}: Seção de Missões encontrada.")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
