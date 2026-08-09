import asyncio
import os
import sys
import json
from playwright.async_api import async_playwright

async def run_test():
    print("🚀 Iniciando Protocolo de Verificação E2E - Vercel & Auth Resilience...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Usar um user agent comum para evitar bloqueios básicos
        context = await browser.new_context(
            viewport={"width": 1280, "height": 1800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        # Injeção de Sessão se disponível no ambiente
        storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        
        page = await context.new_page()
        
        # Estabelecer a origem primeiro
        await page.goto("http://localhost:8080")
        
        if storage_key and session_json:
            print("🔑 Injetando sessão Supabase para bypass de Auth...")
            await page.evaluate(
                f"window.localStorage.setItem('{storage_key}', '{session_json}')"
            )
        
        target_url = "http://localhost:8080/tutoriais"
        print(f"📡 Navegando para: {target_url}")

        try:
            # Aumentar timeout para Vercel Deploys pesados
            await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
            
            # Esperar o React hidratar (verificar texto do header)
            print("⏳ Aguardando hidratação e sincronização do Shadow Core...")
            
            # 1. Verificar se fomos redirecionados para /auth (falha de sessão)
            if "/auth" in page.url:
                print("❌ FALHA: Redirecionado para login. Sessão não injetada ou expirada.")
                sys.exit(1)

            # 2. Verificar o Título da Página (Indica que o componente renderizou)
            await page.wait_for_selector("[data-testid='training-hub-title']", timeout=30000)
            header_text = await page.inner_text("[data-testid='training-hub-title']")
            print(f"📌 Cabeçalho detectado: {header_text}")
            
            if "CENTRO DE TREINAMENTO" not in header_text.upper():
                print(f"❌ FALHA: Título inesperado: {header_text}")
                sys.exit(1)

            # 3. Validação de Resiliência (PGRST108 Check)
            # Se virmos "Aguardando Sincronização", o Admin Tunnel falhou ou está lento
            sync_error_visible = await page.get_by_text("Aguardando Sincronização").is_visible()
            if sync_error_visible:
                print("⚠️ Detectado estado 'Aguardando Sincronização'. Aguardando reparo automático (10s)...")
                await page.wait_for_timeout(10000)
                # Re-checar
                if await page.get_by_text("Aguardando Sincronização").is_visible():
                    print("❌ FALHA: Reparo automático não recuperou a sincronização.")
                    await page.screenshot(path="/tmp/browser/sync_failure.png")
                    sys.exit(1)

            # 4. Validação de Módulos (Sucesso Total)
            # Esperamos que o Admin Tunnel traga os cards
            try:
                await page.wait_for_selector(".enterprise-surface", timeout=20000)
                card_count = await page.locator(".enterprise-surface").count()
                print(f"✅ SUCESSO: {card_count} módulos carregados via Admin Tunnel.")
            except Exception:
                print("❌ FALHA: Timeout. Nenhum módulo carregado após 20s de hidratação.")
                await page.screenshot(path="/tmp/browser/no_modules_timeout.png")
                sys.exit(1)

            print("🏆 PROTOCOLO CONCLUÍDO: Centro de Treinamento Validado.")
            await browser.close()
            sys.exit(0)

        except Exception as e:
            print(f"❌ ERRO CRÍTICO NO TESTE: {str(e)}")
            await page.screenshot(path="/tmp/browser/critical_error.png")
            await browser.close()
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_test())
