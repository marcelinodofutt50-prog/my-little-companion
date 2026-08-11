import { createClient } from '@supabase/supabase-js';

const PROD_URL = process.env.VITE_SUPABASE_URL || "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runRepair() {
  if (!PROD_KEY) {
    console.error("ERRO: SERVICE_ROLE_KEY não encontrada.");
    process.exit(1);
  }

  console.log(`--- SHADOW PROTOCOL v41.0: INFRASTRUCTURE FINAL REPAIR ---`);
  console.log(`Target Project: ${PROD_URL}`);
  
  const supabase = createClient(PROD_URL, PROD_KEY);

  // 1. Buckets check
  console.log("1. Verificando Storage Buckets...");
  const { data: buckets } = await supabase.storage.listBuckets();
  const requiredBuckets = ['avatars', 'apk-uploads', 'apk-results', 'tutorials'];
  for (const b of requiredBuckets) {
    if (!buckets?.find(bucket => bucket.name === b)) {
      console.log(`   - Criando bucket '${b}'...`);
      await supabase.storage.createBucket(b, { public: b === 'avatars' || b === 'tutorials' });
    } else {
      console.log(`   - Bucket '${b}' OK.`);
    }
  }

  // 2. Tabela force_refresh_schema_permissions (se não existir, o rpc vai falhar e saberemos)
  console.log("2. Refresh Schema Cache...");
  try {
    const { error: rpcErr } = await supabase.rpc('force_refresh_schema_permissions');
    if (rpcErr) console.warn("   ⚠️ RPC refresh falhou (pode não existir):", rpcErr.message);
    else console.log("   ✅ RPC refresh disparado com sucesso.");
  } catch(e) {
    console.warn("   ⚠️ Erro ao chamar RPC refresh.");
  }

  // 3. Validação REAL de colunas em profiles
  console.log("3. Validação de Colunas em profiles...");
  const { data: profileTest, error: pErr } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
  if (pErr) {
    console.error("   ❌ Erro ao ler profiles:", pErr.message);
  } else if (profileTest) {
    const cols = Object.keys(profileTest);
    const requiredCols = ['trial_started_at', 'trial_expires_at', 'metadata', 'vip_tier', 'reputation_score'];
    for (const c of requiredCols) {
      if (!cols.includes(c)) {
        console.error(`   ❌ Coluna 'profiles.${c}' AUSENTE.`);
      } else {
        console.log(`   ✅ Coluna 'profiles.${c}' presente.`);
      }
    }
  } else {
    console.log("   ⚠️ Tabela profiles vazia, não foi possível validar colunas via select.");
  }

  // 4. Validação de community_messages
  console.log("4. Validação de community_messages...");
  const { error: cErr } = await supabase.from('community_messages').select('id').limit(1);
  if (cErr) {
    console.error("   ❌ Erro em community_messages:", cErr.message);
  } else {
    console.log("   ✅ community_messages OK.");
  }

  // 5. Validação de play_protect_grants
  console.log("5. Validação de play_protect_grants...");
  const { error: ppErr } = await supabase.from('play_protect_grants').select('id').limit(1);
  if (ppErr) {
    console.error("   ❌ Erro em play_protect_grants:", ppErr.message);
  } else {
    console.log("   ✅ play_protect_grants OK.");
  }

  console.log("--- FIM DA AUDITORIA DE INFRAESTRUTURA ---");
}

runRepair().catch(console.error);
