import { createClient } from '@supabase/supabase-js';

const PROD_URL = "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!PROD_KEY) {
    console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY não configurada.");
    process.exit(1);
  }

  const supabase = createClient(PROD_URL, PROD_KEY);
  console.log(`--- YAARSA FORENSIC AUDIT: ${PROD_URL} ---`);

  // 1. Verificar Variáveis de Ambiente e Overrides
  const { data: overrides, error: oErr } = await supabase.from('panel_servers').select('*');
  console.log("Overrides no Banco:", overrides || "Nenhum");

  const envs = [
    'YAARSA_BASE_URL', 'YAARSA_ADMIN_KEY',
    'YAARSA_V455_BASE_URL', 'YAARSA_V455_ADMIN_KEY',
    'YAARSA_V46_BASE_URL', 'YAARSA_V46_ADMIN_KEY'
  ];
  
  console.log("Status Variáveis de Ambiente (Presença):");
  envs.forEach(e => {
    console.log(`${e}: ${process.env[e] ? 'DEFINIDA' : 'AUSENTE'}`);
  });

  // 2. Teste de Conectividade Yaarsa v457 (Default para Trial)
  const { yaarsaCreateAccount, deriveCredentials, panelFromPlanSlug } = await import('../src/lib/yaarsa.server');
  
  const testUserId = "forensic-test-user-" + Math.random().toString(36).substring(7);
  const creds = deriveCredentials(`shadow-trial:v2:${testUserId}`);
  
  console.log("\n--- TESTE REAL DE CRIAÇÃO (PRODUÇÃO) ---");
  try {
    const res = await yaarsaCreateAccount({
      username: creds.username,
      email: creds.email,
      password: creds.password,
      planSlug: "trial",
      totalPaid: 0,
      additionalInfo: "forensic-audit-v31",
      panel: "v457"
    });
    
    console.log("Resposta Yaarsa:", JSON.stringify(res, null, 2));
    
    if (res.Success) {
      console.log("✅ SUCESSO: O servidor Yaarsa aceitou a criação.");
    } else {
      console.log(`❌ FALHA: ${res.Fail || 'Erro desconhecido'}`);
    }
  } catch (err: any) {
    console.error("❌ ERRO DE CONEXÃO:", err.message);
  }

  // 3. Verificar Logs de Integração Recentes
  const { data: logs } = await supabase
    .from('integration_logs')
    .select('*')
    .eq('source', 'yaarsa-v457')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log("\nÚltimos logs do Yaarsa:");
  logs?.forEach(l => {
    console.log(`[${l.created_at}] Action: ${l.action} | Outcome: ${l.outcome} | Body: ${l.response_body?.slice(0, 100)}`);
  });
}

main().catch(console.error);
