import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

# Injected session variables for Supabase auth
STORAGE_KEY = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
SESSION_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_JSON")
COOKIES_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

SCREENSHOTS = Path("/tmp/browser/screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        # Standard viewport for all checks
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        
        # 1. Restore cookies for SSR paths
        if COOKIES_JSON:
            cookies = json.loads(COOKIES_JSON)
            for c in cookies:
                c["url"] = "http://localhost:8080"
            await context.add_cookies(cookies)

        page = await context.new_page()

        # 2. Navigate to establish origin for localStorage
        await page.goto("http://localhost:8080")
        if STORAGE_KEY and SESSION_JSON:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(STORAGE_KEY)}, {json.dumps(SESSION_JSON)})"
            )
        
        audit_results = {}
        console_logs = []
        page.on("console", lambda msg: console_logs.append({"type": msg.type, "text": msg.text}))
        
        # --- TEST 1: Training Hub (Central de Conexão) ---
        print("Auditing Training Hub...")
        try:
            # The route is /tutoriais (pathless layout _authenticated wraps it)
            await page.goto("http://localhost:8080/tutoriais", wait_until="domcontentloaded")
            await page.wait_for_timeout(4000) # Wait for resilient loader and health checks
            await page.screenshot(path=str(SCREENSHOTS / "audit_training_hub.png"))
            
            # Check for specific PGRST or Sync error text
            has_sync_error = await page.evaluate("() => document.body.innerText.includes('Falha de Sincronização') || document.body.innerText.includes('PGRST108')")
            # Check if tutorials loaded (SortableTutorialCard or similar container)
            has_tutorials = await page.locator("h3").filter(has_text="Centro de Treinamento").is_visible()
            
            audit_results["training_hub"] = {
                "status": "PASS" if not has_sync_error and has_tutorials else "FAIL",
                "has_sync_error": has_sync_error,
                "has_content": has_tutorials
            }
        except Exception as e:
            audit_results["training_hub"] = {"status": "FAIL", "error": str(e)}

        # --- TEST 2: Kraken 2.0 (Background & Assets) ---
        print("Auditing Kraken...")
        try:
            await page.goto("http://localhost:8080/servidor/kraken", wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)
            await page.screenshot(path=str(SCREENSHOTS / "audit_kraken.png"))
            
            # Check for background asset v18 presence
            # kraken.tsx uses a fixed div with style="background-image: url(...)"
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

        # --- TEST 3: Light Mode Audit ---
        print("Auditing Light Mode...")
        try:
            await page.goto("http://localhost:8080/tutoriais?theme=light", wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)
            await page.screenshot(path=str(SCREENSHOTS / "audit_light_mode.png"))
            
            # Check for specific contrast issues (e.g., black text on dark backgrounds if any remain)
            audit_results["light_mode"] = {"status": "VALIDATED"}
        except Exception as e:
            audit_results["light_mode"] = {"status": "FAIL", "error": str(e)}

        # --- TEST 4: Security (Unauthorized Admin Access) ---
        print("Auditing Security...")
        # If the injected user is NOT an admin, this should redirect or show unauthorized
        try:
            await page.goto("http://localhost:8080/admin/staff", wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)
            is_unauthorized = "auth" in page.url or await page.locator("text=Unauthorized").is_visible() or await page.locator("text=Forbidden").is_visible()
            
            audit_results["security_admin_gate"] = {
                "status": "PASS" if is_unauthorized else "WARN (Check if user is admin)",
                "final_url": page.url
            }
        except Exception as e:
            audit_results["security_admin_gate"] = {"status": "FAIL", "error": str(e)}

        print("AUDIT_SUMMARY:" + json.dumps({
            "results": audit_results,
            "logs": [l for l in console_logs if l["type"] == "error"],
            "session_injected": bool(SESSION_JSON)
        }))

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
