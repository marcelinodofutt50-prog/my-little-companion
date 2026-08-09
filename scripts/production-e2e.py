import asyncio
import json
import os
import time
from pathlib import Path
from playwright.async_api import async_playwright

# Configurações de Ambiente
PRODUCTION_URL = "https://www.shadowdashstore.com"
SCREENSHOTS = Path("/tmp/browser/production_audit")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

# Injected session variables for Supabase auth (from sandbox env)
STORAGE_KEY = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
SESSION_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
COOKIES_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

async def run_e2e_production():
    async with async_playwright() as playwright:
        print(f"🚀 Iniciando Auditoria E2E Real em: {PRODUCTION_URL}")
        browser = await playwright.chromium.launch(headless=True)
        # Viewport padrão tático
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        
        # 1. Injeção de Sessão (Se disponível)
        if COOKIES_JSON:
            cookies = json.loads(COOKIES_JSON)
            for c in cookies:
                c["url"] = PRODUCTION_URL
            await context.add_cookies(cookies)

        page = await context.new_page()
        
        # Logs de console para capturar erros de produção (PGRST, etc)
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        audit_log = []

        try:
            # --- FASE 1: Landing Page & Branding ---
            print("Verificando Landing Page...")
            await page.goto(PRODUCTION_URL, wait_until="networkidle")
            await page.screenshot(path=str(SCREENSHOTS / "1_homepage.png"))
            
            has_logo = await page.locator("img[alt='Shadow Protocol']").is_visible()
            audit_log.append(f"Homepage: {'OK' if has_logo else 'LOGO_MISSING'}")

            # --- FASE 2: Planos & Checkout Path ---
            print("Verificando Rota de Planos...")
            await page.goto(f"{PRODUCTION_URL}/planos", wait_until="networkidle")
            await page.screenshot(path=str(SCREENSHOTS / "2_planos.png"))
            
            has_plans = await page.locator("button:has-text('Vitalício')").first.is_visible()
            audit_log.append(f"Planos: {'OK' if has_plans else 'CONTENT_MISSING'}")

            # --- FASE 3: Autenticação & Session Guard ---
            # Navegar para Dashboard para verificar redirecionamento ou sessão ativa
            print("Verificando Dashboard Guard...")
            await page.goto(f"{PRODUCTION_URL}/dashboard")
            await page.wait_for_timeout(3000)
            await page.screenshot(path=str(SCREENSHOTS / "3_dashboard_gate.png"))
            
            is_auth = "/auth" not in page.url
            audit_log.append(f"Autenticação: {'SESSION_ACTIVE' if is_auth else 'REDIRECTED_TO_AUTH'}")

            # --- FASE 4: Kraken v2 Production Check ---
            if is_auth:
                print("Verificando Kraken em Produção...")
                await page.goto(f"{PRODUCTION_URL}/servidor/kraken", wait_until="networkidle")
                await page.wait_for_timeout(4000)
                await page.screenshot(path=str(SCREENSHOTS / "4_kraken_prod.png"))
                
                # Verificar se o background tático v18/v19 carregou no domínio real
                bg_ok = await page.evaluate("""
                    () => {
                        const container = document.querySelector('.kraken-bg-container');
                        return container && container.style.backgroundImage.includes('krakenbackground-18.jpg');
                    }
                """)
                audit_log.append(f"Kraken BG: {'OK' if bg_ok else 'ASSET_FAIL'}")

            # --- FASE 5: Training Hub Sync (PGRST Check) ---
            if is_auth:
                print("Verificando Training Hub Sync...")
                await page.goto(f"{PRODUCTION_URL}/tutoriais", wait_until="networkidle")
                await page.wait_for_timeout(5000)
                await page.screenshot(path=str(SCREENSHOTS / "5_training_hub.png"))
                
                sync_fail = await page.evaluate("() => document.body.innerText.includes('Falha de Sincronização')")
                audit_log.append(f"Training Sync: {'FAIL' if sync_fail else 'OK'}")

        except Exception as e:
            print(f"❌ Erro Crítico durante Auditoria: {str(e)}")
            audit_log.append(f"CRITICAL_ERROR: {str(e)}")

        # Relatório Final consolidado
        summary = {
            "target": PRODUCTION_URL,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "steps": audit_log,
            "errors": console_errors[:10],
            "screenshots_count": len(list(SCREENSHOTS.glob("*.png")))
        }
        
        print(f"AUDIT_E2E_FINAL:{json.dumps(summary)}")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_e2e_production())
