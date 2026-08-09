import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def run_test():
    print("🚀 Iniciando Protocolo de Verificação E2E via Python (Sandbox Optimized)...")
    
    async with async_playwright() as p:
        # O sandbox tem o Chromium pré-configurado
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        
        target_url = os.environ.get("VERIFY_URL", "http://localhost:8080/tutoriais")
        print(f"📡 Alvo: {target_url}")

        try:
            # 1. Navegação
            response = await page.goto(target_url, wait_until="networkidle", timeout=30000)
            
            if not response or response.status >= 400:
                print(f"❌ FALHA: Status HTTP {response.status if response else 'N/A'}")
                sys.exit(1)

            # 2. Detecção de Erros de Sincronização
            # Verificamos se textos de erro ou loaders infinitos estão presentes
            sync_error = await page.get_by_text("Aguardando Sincronização").is_visible()
            if sync_error:
                print("❌ FALHA: Interface de erro de sincronização (PGRST108) detectada.")
                await page.screenshot(path="/tmp/browser/sync_failure_detected.png")
                sys.exit(1)

            # 3. Validação de Conteúdo (Cards de Módulo)
            # Esperamos pelos cards renderizados pelo Admin Tunnel
            print("⏳ Aguardando renderização dos módulos...")
            try:
                # O seletor .enterprise-surface é usado no código para os cards
                await page.wait_for_selector(".enterprise-surface", timeout=15000)
            except Exception:
                print("❌ FALHA: Timeout aguardando carregamento dos módulos (.enterprise-surface não encontrado).")
                await page.screenshot(path="/tmp/browser/timeout_load.png")
                # Verificamos se há algum card de tutorial genérico ou se a lista está vazia
                sys.exit(1)

            card_count = await page.locator(".enterprise-surface").count()
            print(f"📊 Módulos Carregados: {card_count}")

            if card_count == 0:
                print("❌ FALHA: Nenhum módulo visível após o carregamento.")
                sys.exit(1)

            print("✅ OPERACIONAL: Centro de Treinamento validado com sucesso.")
            await browser.close()
            sys.exit(0)

        except Exception as e:
            print(f"❌ ERRO CRÍTICO NO TESTE: {str(e)}")
            await browser.close()
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_test())
