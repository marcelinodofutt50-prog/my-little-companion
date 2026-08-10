import { chromium, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log("🚀 Iniciando Protocolo de Verificação E2E - Vercel Compliance...");
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1800 }
  });
  
  const page = await context.newPage();
  const targetUrl = process.env.VERIFY_URL || 'http://localhost:8080/tutoriais';
  
  console.log(`📡 Alvo: ${targetUrl}`);

  // Captura de logs do console para telemetria
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`🔴 [BROWSER ERROR] ${msg.text()}`);
    if (msg.text().includes('[tutorials]')) console.log(`🔵 [TELEMETRIA] ${msg.text()}`);
  });

  try {
    // 1. Navegação com timeout estrito
    const response = await page.goto(targetUrl, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    if (!response || response.status() >= 400) {
      throw new Error(`Falha na navegação: Status ${response?.status()}`);
    }

    // 2. Detecção de Erros de Sincronização (PGRST108 / 42P01)
    // O sistema Shadow mostra "Aguardando Sincronização" ou "Calibrando conexão" em caso de falha
    const syncFailureText = await page.locator('text=/Aguardando Sincronização|Erro de Sincronização|Calibrando conexão/i').isVisible();
    
    if (syncFailureText) {
      console.error("❌ FALHA: Interface de erro de sincronização detectada.");
      // Tira um print para evidência técnica
      await page.screenshot({ path: '/tmp/browser/sync_failure.png' });
      process.exit(1);
    }

    // 3. Validação de Conteúdo (Admin Tunnel Check)
    // Esperamos que o bypass do Admin Tunnel carregue os itens mesmo com RLS instável
    console.log("⏳ Aguardando renderização dos módulos...");
    
    // Espera até 10 segundos pelos cards de tutorial (classe enterprise-surface ou cards de grid)
    try {
      await page.waitForSelector('.enterprise-surface', { timeout: 15000 });
    } catch (e) {
      console.error("❌ FALHA: Timeout aguardando carregamento dos módulos.");
      await page.screenshot({ path: '/tmp/browser/timeout_load.png' });
      process.exit(1);
    }

    const cardCount = await page.locator('.enterprise-surface').count();
    console.log(`📊 Módulos Carregados: ${cardCount}`);

    if (cardCount === 0) {
      console.error("❌ FALHA: Nenhum módulo visível após o carregamento.");
      process.exit(1);
    }

    // 4. Verificação de Saúde do Backend via UI
    // Se o loader ainda estiver visível, algo travou
    const isStillLoading = await page.locator('text=/Sincronizando.../i').isVisible();
    if (isStillLoading) {
      console.error("❌ FALHA: O sistema ficou preso no estado 'Sincronizando'.");
      process.exit(1);
    }

    console.log("✅ OPERACIONAL: Centro de Treinamento validado com sucesso.");
    await browser.close();
    process.exit(0);

  } catch (error: any) {
    console.error(`❌ ERRO CRÍTICO NO TESTE: ${error.message}`);
    await browser.close();
    process.exit(1);
  }
}

runTest();
