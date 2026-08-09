import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS = Path("/tmp/browser/shadow-pass-audit/screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    auth_status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS")
    if auth_status != "injected":
        print(f"Aborting: Auth status is {auth_status}. Need injected session.")
        return

    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Auth Injection
        await page.goto("http://localhost:8080")
        if storage_key and session_json:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )
        
        # 1. Access Shadow Pass
        await page.goto("http://localhost:8080/shadow-pass")
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path=str(SCREENSHOTS / "1_shadow_pass_initial.png"))
        print("Acessou Shadow Pass")

        # 2. Test Anonymity Toggle
        anon_button = page.get_by_role("button", name=re.compile(r"(Tornar-se Anônimo|Revelar Identidade)", re.I))
        if await anon_button.is_visible():
            initial_text = await anon_button.inner_text()
            await anon_button.click()
            await page.wait_for_timeout(2000)
            await page.screenshot(path=str(SCREENSHOTS / "2_after_toggle.png"))
            new_text = await anon_button.inner_text()
            print(f"Toggle anonimato: {initial_text} -> {new_text}")
        else:
            print("Botão de anonimato não encontrado")

        # 3. Test Profile Edit
        edit_button = page.get_by_role("button").filter(has=page.locator("svg.lucide-edit2")).first()
        if await edit_button.is_visible():
            await edit_button.click()
            input_field = page.locator("input[placeholder='Seu codinome...']")
            await input_field.fill("Audit_Shadow_" + os.urandom(2).hex())
            save_button = page.get_by_role("button").filter(has=page.locator("svg.lucide-save")).first()
            await save_button.click()
            await page.wait_for_timeout(2000)
            await page.screenshot(path=str(SCREENSHOTS / "3_after_save.png"))
            print("Edição de perfil testada")
        else:
            print("Botão de edição não encontrado")

        await browser.close()

import re
asyncio.run(main())
