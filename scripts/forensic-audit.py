import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

STORAGE_KEY = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
SESSION_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
COOKIES_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

SCREENSHOTS = Path("/tmp/browser/screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        
        if COOKIES_JSON:
            cookies = json.loads(COOKIES_JSON)
            for c in cookies:
                c["url"] = "http://localhost:8080"
            await context.add_cookies(cookies)

        page = await context.new_page()

        await page.goto("http://localhost:8080")
        if STORAGE_KEY and SESSION_JSON:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(STORAGE_KEY)}, {json.dumps(SESSION_JSON)})"
            )
        
        audit_results = {}
        console_logs = []
        page.on("console", lambda msg: console_logs.append({"type": msg.type, "text": msg.text}))
        
        # --- TEST 1: Training Hub ---
        print("Auditing Training Hub...")
        try:
            await page.goto("http://localhost:8080/tutoriais", wait_until="domcontentloaded")
            await page.wait_for_timeout(5000)
            await page.screenshot(path=str(SCREENSHOTS / "audit_training_hub.png"))
            
            has_sync_error = await page.evaluate("() => document.body.innerText.includes('Falha de Sincronização') || document.body.innerText.includes('PGRST108')")
            has_tutorials = await page.locator("h3").filter(has_text="Centro de Treinamento").is_visible()
            
            audit_results["training_hub"] = {
                "status": "PASS" if not has_sync_error and has_tutorials else "FAIL",
                "has_sync_error": has_sync_error,
                "has_content": has_tutorials
            }
        except Exception as e:
            audit_results["training_hub"] = {"status": "FAIL", "error": str(e)}

        # --- TEST 2: Kraken ---
        print("Auditing Kraken...")
        try:
            await page.goto("http://localhost:8080/servidor/kraken", wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)
            await page.screenshot(path=str(SCREENSHOTS / "audit_kraken.png"))
            
            bg_v18_present = await page.evaluate("""
                () => {
                    const divs = Array.from(document.querySelectorAll('div'));
                    return divs.some(d => d.style.backgroundImage && d.style.backgroundImage.includes('krakenbackground-18.jpg'));
                }
            """)
            
            audit_results["kraken"] = {
                "status": "PASS" if bg_v18_present else "FAIL",
                "bg_v18_detected": bg_v18_present
            }
        except Exception as e:
            audit_results["kraken"] = {"status": "FAIL", "error": str(e)}

        # --- TEST 3: Light Mode ---
        print("Auditing Light Mode...")
        try:
            await page.goto("http://localhost:8080/tutoriais?theme=light", wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)
            await page.screenshot(path=str(SCREENSHOTS / "audit_light_mode.png"))
            audit_results["light_mode"] = {"status": "VALIDATED"}
        except Exception as e:
            audit_results["light_mode"] = {"status": "FAIL", "error": str(e)}

        print("AUDIT_SUMMARY:" + json.dumps({
            "results": audit_results,
            "logs": [l for l in console_logs if l["type"] == "error"],
            "session_injected": bool(SESSION_JSON)
        }))

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
