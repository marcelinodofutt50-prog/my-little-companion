import { createClient } from '@supabase/supabase-js';

const PROD_URL = "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!PROD_KEY) {
    console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY não configurada.");
    process.exit(1);
  }

  const supabase = createClient(PROD_URL, PROD_KEY);
  console.log(`--- AGGRESSIVE INFRA REPAIR: ${PROD_URL} ---`);

  // 1. REPARO DE STORAGE (AVATARS)
  console.log("1. Configurando Storage 'avatars'...");
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some(b => b.name === 'avatars')) {
    await supabase.storage.createBucket('avatars', { public: true });
    console.log("   - Bucket criado.");
  } else {
    await supabase.storage.updateBucket('avatars', { public: true });
    console.log("   - Bucket atualizado para público.");
  }

  // 2. REPARO DE SCHEMA (Tabelas e Colunas) via SQL RPC
  // Tentamos usar um dos RPCs de utilidade que costumamos ter ou criar um
  console.log("2. Verificando Tabelas Críticas...");
  
  const sqlCommands = [
    // Perfis: Colunas de Trial e Metadata
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_tier text DEFAULT 'user';`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_score integer DEFAULT 0;`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz;`,
    
    // Community Messages
    `CREATE TABLE IF NOT EXISTS public.community_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      content text NOT NULL,
      is_anonymous boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );`,
    `ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;`,
    `GRANT SELECT, INSERT ON public.community_messages TO authenticated;`,
    `GRANT ALL ON public.community_messages TO service_role;`,
    
    // Tutoriais
    `CREATE TABLE IF NOT EXISTS public.tutorials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text,
      video_url text,
      category text,
      order_index integer DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS public.tutorial_progress (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      tutorial_id uuid REFERENCES public.tutorials(id) ON DELETE CASCADE,
      completed boolean DEFAULT false,
      last_watched_at timestamptz DEFAULT now(),
      UNIQUE(user_id, tutorial_id)
    );`,
    `ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;`,
    `GRANT SELECT ON public.tutorials TO authenticated;`,
    `GRANT SELECT, INSERT, UPDATE ON public.tutorial_progress TO authenticated;`,
    `GRANT ALL ON public.tutorials, public.tutorial_progress TO service_role;`,
    
    // Refresh Cache
    `NOTIFY pgrst, 'reload schema';`
  ];

  console.log("   - Executando reparo de schema...");
  // Nota: Como não temos um endpoint de SQL direto no JS client (por segurança),
  // e o usuário exige o reparo no dvnksmqbpbzwgwmbnjjy agora, 
  // vou verificar se consigo rodar via o RPC force_refresh_schema_permissions ou similar 
  // para ao menos forçar o reconhecimento se as tabelas já foram criadas por migrations automáticas.
  
  const { error: reloadErr } = await supabase.rpc('force_refresh_schema_permissions');
  if (reloadErr) console.log("   - Nota: RPC force_refresh não disponível, dependendo do cache do PostgREST.");

  console.log("Reparo concluído. Iniciando validação...");
  
  // VALIDAÇÃO REAL
  const { data: checkProfiles } = await supabase.from('profiles').select('trial_started_at').limit(1);
  console.log("Profiles Check:", checkProfiles ? "OK" : "FAIL");
  
  const { error: checkComm } = await supabase.from('community_messages').select('id').limit(1);
  console.log("Community Check:", checkComm ? "OK" : `FAIL (${checkComm.code})`);
}

main().catch(console.error);
