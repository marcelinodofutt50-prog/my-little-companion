import { createClient } from '@supabase/supabase-js';

// CREDENCIAIS DO PROJETO DE PRODUÇÃO (dvnksmqbpbzwgwmbnjjy)
const PROD_URL = "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!PROD_KEY) {
    console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY não configurada.");
    process.exit(1);
  }

  console.log("--- AUDITORIA DE INFRAESTRUTURA: dvnksmqbpbzwgwmbnjjy ---");
  const supabase = createClient(PROD_URL, PROD_KEY);

  // 1. Buckets
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log("Buckets:", buckets?.map(b => b.name) || "Nenhum");
  
  // 2. Profiles
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(1);
  const keys = profiles?.[0] ? Object.keys(profiles[0]) : [];
  console.log("Colunas Profiles:", keys);
  
  // 3. Community
  const { error: cErr } = await supabase.from('community_messages').select('id').limit(1);
  console.log("community_messages:", cErr ? `ERRO (${cErr.code})` : "OK");

  console.log("\n--- AÇÃO REPARADORA ---");
  // Tentativa de criação do bucket (apenas se não existir)
  if (!buckets?.some(b => b.name === 'avatars')) {
    console.log("Criando bucket 'avatars'...");
    await supabase.storage.createBucket('avatars', { public: true });
  }

  // Se o RPC estiver disponível, usaríamos migrations, mas aqui focamos na prova de identidade
}

main().catch(console.error);
