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

  // Tentativa de rodar SQL via RPC 'exec_sql' se disponível no banco alvo
  // Se não, tentaremos criar as tabelas/colunas via migrations ou dashboard.
  const sql = `
    -- 1. Buckets
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('avatars', 'avatars', true)
    ON CONFLICT (id) DO UPDATE SET public = true;

    -- 2. Colunas Profiles
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

    -- 3. Community Messages
    CREATE TABLE IF NOT EXISTS public.community_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      content text NOT NULL,
      is_anonymous boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT ON public.community_messages TO authenticated;
    GRANT ALL ON public.community_messages TO service_role;

    -- 4. Reload PostgREST
    NOTIFY pgrst, 'reload schema';
  `;

  console.log("Executando comandos via RPC exec_sql...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.log("   ⚠️ RPC exec_sql falhou ou não existe. Tentando alternativa...");
    // Se falhar, tentamos o 'force_refresh_schema_permissions' que às vezes roda SQL de reparo internamente
    await supabase.rpc('force_refresh_schema_permissions');
  } else {
    console.log("   ✅ SQL executado com sucesso.");
  }

  console.log("--- FIM DO REPARO ---");
}

runRepair().catch(console.error);
