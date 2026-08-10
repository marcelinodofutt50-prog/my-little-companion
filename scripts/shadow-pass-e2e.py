import asyncio
import json
import os
import re
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS = Path("/tmp/browser/shadow-pass-e2e/screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    auth_status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS")
    if auth_status != "injected":
        print(f"Aborting: Auth status is {auth_status}. Need injected session.")
        return

    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        
        # Restore cookies for SSR if present
        if cookies_json:
            cookies = json.loads(cookies_json)
            for c in cookies:
                c["url"] = "http://localhost:8080"
            await context.add_cookies(cookies)

        page = await context.new_page()

        # Auth Injection via localStorage
        await page.goto("http://localhost:8080")
        if storage_key and session_json:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )
        
        # 1. Navigation to Shadow Pass
        print("Navegando para /shadow-pass...")
        await page.goto("http://localhost:8080/shadow-pass")
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path=str(SCREENSHOTS / "1_shadow_pass_loaded.png"))
        
        # Check if basic profile info is visible
        nickname_locator = page.locator("h1.font-black")
        await nickname_locator.wait_for(state="visible", timeout=10000)
        initial_name = await nickname_locator.inner_text()
        print(f"Shadow Pass carregado. Usuário: {initial_name}")

        # 2. Test Anonymity Toggle (Ghost Mode)
        print("Testando Modo Fantasma (Anonimato)...")
        # Selector for the anonymity toggle button
        anon_btn = page.get_by_role("button", name=re.compile(r"(Tornar-se Anônimo|Revelar Identidade)", re.I))
        
        if await anon_btn.is_visible():
            status_before = await anon_btn.inner_text()
            print(f"Status inicial: {status_before}")
            
            await anon_btn.click()
            # Wait for mutation to complete and toast/UI update
            await page.wait_for_timeout(3000) 
            await page.screenshot(path=str(SCREENSHOTS / "2_after_toggle_anon.png"))
            
            status_after = await anon_btn.inner_text()
            print(f"Status final: {status_after}")
            
            if status_before != status_after:
                print("✅ Sucesso: Toggle de anonimato funcionando.")
            else:
                print("❌ Falha: O texto do botão não mudou após o clique.")
        else:
            print("❌ Falha: Botão de anonimato não encontrado.")

        # 3. Test Profile Customization (Nickname Edit)
        print("Testando edição de codinome...")
        edit_btn = page.get_by_role("button").filter(has=page.locator("svg.lucide-edit2")).first()
        
        if await edit_btn.is_visible():
            await edit_btn.click()
            input_field = page.locator("input[placeholder='Seu codinome...']")
            await input_field.wait_for(state="visible")
            
            new_test_name = "Shadow_" + os.urandom(2).hex().upper()
            await input_field.fill(new_test_name)
            
            save_btn = page.get_by_role("button").filter(has=page.locator("svg.lucide-save")).first()
            await save_btn.click()
            
            # Wait for mutation and query invalidation
            await page.wait_for_timeout(3000)
            await page.screenshot(path=str(SCREENSHOTS / "3_after_profile_update.png"))
            
            updated_name = await nickname_locator.inner_text()
            print(f"Codinome atualizado para: {updated_name}")
            
            if new_test_name.upper() in updated_name.upper() or "ANÔNIMO" in updated_name.upper():
                print("✅ Sucesso: Atualização de perfil concluída.")
            else:
                print(f"❌ Falha: O nome não foi atualizado corretamente (Esperado: {new_test_name}, Obtido: {updated_name})")
        else:
            print("❌ Falha: Botão de edição de perfil não encontrado.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
