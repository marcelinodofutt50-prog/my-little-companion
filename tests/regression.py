import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

# Configuração de caminhos para artefatos de teste
SCREENSHOTS = Path("/tmp/browser/screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def test_theme_logic(page):
    """Verifica se o sistema de temas aplica as classes corretas no HTML."""
    print("[TEST] Verificando lógica de temas...")
    await page.goto("http://localhost:8080")
    
    # Testa modo Escuro (Padrão)
    await page.evaluate("localStorage.setItem('shadow-theme', 'dark')")
    await page.reload()
    is_dark = await page.evaluate("document.documentElement.classList.contains('dark')")
    if not is_dark:
        raise Exception("Erro: Classe '.dark' não aplicada no modo escuro.")
    
    # Testa modo Claro
    await page.evaluate("localStorage.setItem('shadow-theme', 'light')")
    await page.reload()
    is_light = await page.evaluate("document.documentElement.classList.contains('theme-light')")
    if not is_light:
        raise Exception("Erro: Classe '.theme-light' não aplicada no modo claro.")
    
    print("[PASS] Lógica de temas validada.")

async def test_page_stability(page):
    """Verifica se as páginas críticas carregam sem erros de interface (system_error)."""
    paths = ["/", "/auth", "/play-protect"]
    for path in paths:
        print(f"[TEST] Verificando estabilidade da rota: {path}")
        await page.goto(f"http://localhost:8080{path}")
        await page.wait_for_timeout(1000)
        
        # Procura por indicadores de erro catastrófico na UI
        content = await page.content()
        if "system_error" in content.lower() or "algo falhou no processo" in content.lower():
            raise Exception(f"Erro: Rota {path} exibiu tela de falha do sistema.")
            
    print("[PASS] Estabilidade de rotas críticas confirmada.")

async def run_regression():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        try:
            await test_theme_logic(page)
            await test_page_stability(page)
            print("\n✅ TODOS OS TESTES DE REGRESSÃO PASSARAM COM SUCESSO.")
        except Exception as e:
            print(f"\n❌ FALHA NOS TESTES: {str(e)}")
            await page.screenshot(path=str(SCREENSHOTS / "regression_failure.png"))
            exit(1)
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run_regression())
