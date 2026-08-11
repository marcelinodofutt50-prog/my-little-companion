import { createClient } from '@supabase/supabase-js';

const PROD_URL = process.env.EXT_SUPABASE_URL || "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
const PROD_KEY = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runRepair() {
  if (!PROD_KEY) {
    console.error("ERRO: SERVICE_ROLE_KEY não encontrada.");
    process.exit(1);
  }

  console.log(`--- INICIANDO REPARO TÁTICO NO BANCO REAL: ${PROD_URL} ---`);
  const supabase = createClient(PROD_URL, PROD_KEY);

  // 1. Criar bucket avatars se não existir
  console.log("1. Verificando bucket 'avatars'...");
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find(b => b.name === 'avatars')) {
    const { error: bErr } = await supabase.storage.createBucket('avatars', { public: true });
    console.log(bErr ? `   ❌ Erro ao criar bucket: ${bErr.message}` : "   ✅ Bucket criado com sucesso.");
  } else {
    console.log("   ✅ Bucket já existe.");
  }

  // 2. Tentar criar as colunas e tabelas via RPC se existir um executor de SQL
  // Como não temos, vamos sugerir a execução via dashboard ou tentar usar migrations se configurado.
  // No entanto, para fins de build, a Vercel falha porque a coluna não está lá.
  // Vou tentar usar o RPC force_refresh_schema_permissions que costuma estar presente em nossos projetos.
  
  console.log("2. Solicitando reload de schema...");
  const { error: relErr } = await supabase.rpc('force_refresh_schema_permissions');
  if (relErr) {
     console.log("   ⚠️ RPC de refresh não disponível. O PostgREST levará alguns segundos para atualizar.");
  }

  console.log("--- FIM DO REPARO ---");
}

runRepair().catch(console.error);
