import { createClient } from '@supabase/supabase-js';

// CREDENCIAIS RÍGIDAS DO PROJETO DE PRODUÇÃO (dvnksmqbpbzwgwmbnjjy)
const PROD_URL = "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!PROD_KEY) {
    console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY não configurada.");
    process.exit(1);
  }

  console.log("--- REPARO DE INFRAESTRUTURA: PROJETO dvnksmqbpbzwgwmbnjjy ---");
  const supabase = createClient(PROD_URL, PROD_KEY);

  // 1. Criar Bucket 'avatars'
  console.log("1. Provisionando Bucket 'avatars'...");
  const { data: bData, error: bErr } = await supabase.storage.createBucket('avatars', {
    public: true,
    fileSizeLimit: 2097152,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
  });
  if (bErr && bErr.message !== 'Bucket already exists') {
    console.error("Erro ao criar bucket:", bErr.message);
  } else {
    console.log("✅ Bucket 'avatars' OK.");
  }

  // 2. Aplicar Migração de Colunas e Tabelas
  console.log("2. Aplicando Schema Fix (Trial Columns & Community Table)...");
  const sql = `
    -- Colunas de Trial
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz;
    
    -- Tabela de Chat
    CREATE TABLE IF NOT EXISTS public.community_messages (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references auth.users(id) on delete cascade not null,
        content text not null,
        created_at timestamptz default now()
    );

    -- Tabela de Progresso (Tutorial)
    CREATE TABLE IF NOT EXISTS public.tutorial_progress (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references auth.users(id) on delete cascade not null,
        tutorial_id text not null,
        completed boolean default false,
        last_watched_at timestamptz default now(),
        unique(user_id, tutorial_id)
    );

    -- RLS & Grants
    ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT ON public.community_messages TO authenticated;
    
    ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON public.tutorial_progress TO authenticated;

    -- Reload Cache
    NOTIFY pgrst, 'reload schema';
  `;

  // Tenta executar via RPC genérico se disponível, ou instrui o erro
  const { error: sqlErr } = await supabase.rpc('run_sql', { sql }).catch(() => ({ error: { message: "RPC run_sql not available" } }));
  if (sqlErr) {
    console.log("⚠️ RPC 'run_sql' não disponível. Tentando reparo via queries diretas...");
    
    // Tenta pelo menos garantir que as tabelas apareçam no select (forçando cache)
    await supabase.from('profiles').select('trial_started_at').limit(1).catch(() => {});
    await supabase.from('community_messages').select('id').limit(1).catch(() => {});
    await supabase.from('tutorial_progress').select('id').limit(1).catch(() => {});
  }

  console.log("3. Verificação Final Pós-Reparo...");
  const { data: buckets } = await supabase.storage.listBuckets();
  const { data: pTest } = await supabase.from('profiles').select('*').limit(1);
  const pKeys = pTest?.[0] ? Object.keys(pTest[0]) : [];

  console.log("RESULTADO FINAL:");
  console.log("- Project ID:", PROD_URL);
  console.log("- Bucket avatars:", buckets?.some(b => b.name === 'avatars') ? "EXISTE" : "FALHA");
  console.log("- Coluna trial_started_at:", pKeys.includes('trial_started_at') ? "EXISTE" : "FALHA");
}

main().catch(console.error);
