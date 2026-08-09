import { chromium } from 'playwright';

async function verify() {
  console.log("🔍 Iniciando Verificação Tática do Centro de Treinamento...");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // URL de produção ou preview
  const targetUrl = process.env.VERIFY_URL || "http://localhost:8080/tutoriais";
  
  try {
    console.log(`🌐 Navegando para: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    // 1. Verificar se a tela de erro de sincronização está visível
    const syncErrorVisible = await page.isVisible('text=Aguardando Sincronização');
    if (syncErrorVisible) {
      console.error("❌ ERRO: Tela de falha de sincronização detectada!");
      process.exit(1);
    }

    // 2. Verificar se o loader está travado
    const isLoading = await page.isVisible('text=Sincronizando...');
    if (isLoading) {
       // Aguarda mais um pouco para resiliência
       await page.waitForTimeout(5000);
       if (await page.isVisible('text=Sincronizando...')) {
         console.error("❌ ERRO: Loader infinito detectado!");
         process.exit(1);
       }
    }

    // 3. Verificar presença de conteúdo (módulos)
    // Procuramos por cards de tutorial que devem ser renderizados após o Admin Tunnel responder
    const tutorials = await page.locator('div.enterprise-surface').count();
    console.log(`📦 Módulos detectados: ${tutorials}`);
    
    if (tutorials === 0) {
      // Se não houver nada, verificamos se há logs de erro no console
      console.error("❌ ERRO: Nenhum módulo carregado no Centro de Treinamento.");
      process.exit(1);
    }

    console.log("✅ SUCESSO: Centro de Treinamento validado e operacional.");
    await browser.close();
  } catch (error) {
    console.error("❌ FALHA CRÍTICA NO TESTE:", error);
    await browser.close();
    process.exit(1);
  }
}

verify();
