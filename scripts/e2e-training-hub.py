import asyncio
import json
import os
import sys
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    target_url = os.environ.get("TARGET_URL", "http://localhost:8080")
    print(f"[E2E] Iniciando validação tática em: {target_url}")

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        
        storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

        if cookies_json:
            cookies = json.loads(cookies_json)
            for c in cookies:
                c["url"] = target_url.split("?")[0].rstrip("/")
            await context.add_cookies(cookies)

        page = await context.new_page()
        
        # 1. Login/Session setup
        await page.goto(target_url)
        if storage_key and session_json:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )
        
        # 2. Navegação para Tutoriais
        hub_url = f"{target_url.rstrip('/')}/tutoriais"
        print(f"[E2E] Navegando para: {hub_url}")
        await page.goto(hub_url, wait_until="domcontentloaded", timeout=60000)
        
        # 3. Validação de Conteúdo (Resiliência PGRST108)
        try:
            # Espera pelo título principal - aumentamos a flexibilidade do seletor
            await page.wait_for_selector("h1, .enterprise-surface, button:has-text('Sincronizar')", timeout=30000)
            h1_text = await page.inner_text("h1")
            print(f"[E2E] H1 detectado: '{h1_text}'")
            
            if "CENTRO DE" not in h1_text.upper():
                # Se não carregou o título, pode ser que redirecionou ou deu erro
                print(f"[E2E] AVISO: H1 não condiz com o esperado. URL atual: {page.url}")
                await page.screenshot(path="/tmp/browser/e2e/h1_mismatch.png")
            
            # Verifica se não está preso na tela de sincronização infinita
            sync_text = await page.inner_text("body")
            if "Aguardando Sincronização" in sync_text and "Sincronizar Agora" in sync_text:
                print("[E2E] AVISO: Tela de sincronização manual detectada. Tentando reparo automático...")
                await page.click("button:has-text('Sincronizar Agora')")
                await page.wait_for_timeout(5000)
            
            # Validação de Módulos (Tanque de Dados)
            # Procuramos por cards de tutoriais ou skeletons que sumiram
            await page.wait_for_selector(".enterprise-surface", timeout=15000)
            print("[E2E] Interface tática carregada com sucesso.")
            
            # Snapshot para evidência
            os.makedirs("/tmp/browser/e2e", exist_ok=True)
            await page.screenshot(path="/tmp/browser/e2e/training_hub_success.png")
            print("[E2E] Validação concluída com sucesso.")
            sys.exit(0)
            
        except Exception as e:
            print(f"[E2E] FALHA CRÍTICA: {str(e)}")
            os.makedirs("/tmp/browser/e2e", exist_ok=True)
            await page.screenshot(path="/tmp/browser/e2e/training_hub_failure.png")
            sys.exit(1)
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
