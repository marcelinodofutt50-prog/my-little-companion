import { createClient } from '@supabase/supabase-js';

const PROD_URL = process.env.EXT_SUPABASE_URL || "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
const PROD_KEY = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runRepair() {
  if (!PROD_KEY) {
    console.error("ERRO: SERVICE_ROLE_KEY não encontrada.");
    process.exit(1);
  }

  console.log(`--- AGGRESSIVE DDL REPAIR (RPC-LESS): ${PROD_URL} ---`);
  const supabase = createClient(PROD_URL, PROD_KEY);

  // We check for the exists of a general SQL executor RPC. 
  // In many Supabase setups we add a helper like 'exec_sql' or 'force_refresh_schema_permissions'
  
  const repairSQL = `
    -- 1. Profiles Column Expansion
    ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
    ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

    -- 2. Community Infrastructure
    CREATE TABLE IF NOT EXISTS public.community_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      content text NOT NULL,
      is_anonymous boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );

    ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
    
    -- Permissions for Data API
    DO $$ 
    BEGIN
      GRANT SELECT, INSERT ON public.community_messages TO authenticated;
      GRANT ALL ON public.community_messages TO service_role;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END $$;

    -- 3. Tutorial Progress
    CREATE TABLE IF NOT EXISTS public.tutorials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.tutorial_progress (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      tutorial_id uuid REFERENCES public.tutorials(id) ON DELETE CASCADE,
      completed boolean DEFAULT false,
      last_watched_at timestamptz DEFAULT now(),
      UNIQUE(user_id, tutorial_id)
    );

    ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

    DO $$ 
    BEGIN
      GRANT SELECT ON public.tutorials TO authenticated;
      GRANT SELECT, INSERT, UPDATE ON public.tutorial_progress TO authenticated;
      GRANT ALL ON public.tutorials, public.tutorial_progress TO service_role;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END $$;

    -- 4. Force Cache Invalidation
    NOTIFY pgrst, 'reload schema';
  `;

  console.log("Tentando execução direta via RPC 'exec_sql' (Shadow Protocol Emergency)...");
  
  // Try multiple known RPC names for SQL execution we might have added
  const rpcs = ['exec_sql', 'execute_sql', 'force_refresh_schema_permissions'];
  let success = false;

  for (const rpcName of rpcs) {
    console.log(`   - Tentando RPC: ${rpcName}...`);
    const { error } = await supabase.rpc(rpcName, { sql_query: repairSQL, sql: repairSQL });
    if (!error) {
      console.log(`   ✅ RPC ${rpcName} executado com sucesso.`);
      success = true;
      break;
    } else {
      console.log(`   ❌ RPC ${rpcName} falhou: ${error.message}`);
    }
  }

  if (!success) {
    console.log("   ⚠️ Nenhum RPC de execução SQL disponível no banco alvo.");
    console.log("   ⚠️ A infraestrutura deve ser corrigida via Supabase Dashboard ou Migrations.");
  }

  console.log("--- FINALIZANDO ---");
}

runRepair().catch(console.error);
