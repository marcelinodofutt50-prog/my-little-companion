import { createClient } from '@supabase/supabase-js';

const PROD_URL = process.env.EXT_SUPABASE_URL || "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
const PROD_KEY = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runRepair() {
  if (!PROD_KEY) {
    console.error("ERRO: SERVICE_ROLE_KEY não encontrada.");
    process.exit(1);
  }

  console.log(`--- REPARO DE EMERGÊNCIA (SQL DIRECT): ${PROD_URL} ---`);
  const supabase = createClient(PROD_URL, PROD_KEY);

  // Tentativa de rodar comandos de limpeza e criação se possível
  // Como não temos SQL, vamos usar os clients para verificar e criar o que dá
  
  // 1. Storage
  console.log("1. Verificando Storage...");
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find(b => b.name === 'avatars')) {
    console.log("   - Criando bucket 'avatars'...");
    await supabase.storage.createBucket('avatars', { public: true });
  }

  // 2. Tentar disparar o force_refresh_schema_permissions
  console.log("2. Refresh Schema Cache...");
  await supabase.rpc('force_refresh_schema_permissions');
  
  console.log("3. Validação de Colunas via Select...");
  const { error: pErr } = await supabase.from('profiles').select('trial_started_at').limit(1);
  if (pErr) console.error("   ❌ Erro em profiles:", pErr.message);
  else console.log("   ✅ Profiles colunas OK.");

  const { error: cErr } = await supabase.from('community_messages').select('id').limit(1);
  if (cErr) console.error("   ❌ Erro em community_messages:", cErr.message);
  else console.log("   ✅ community_messages OK.");

  console.log("--- FIM DO REPARO ---");
}

runRepair().catch(console.error);
