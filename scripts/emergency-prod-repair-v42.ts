import { createClient } from '@supabase/supabase-js';

const PROD_URL = "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function repairProd() {
  if (!PROD_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is missing");
    process.exit(1);
  }

  const supabase = createClient(PROD_URL, PROD_KEY);

  console.log("--- SHADOW PROTOCOL v42.0: EMERGENCY PROD REPAIR ---");
  console.log(`Target: ${PROD_URL}`);

  // 1. Repair Profiles Columns
  console.log("1. Repairing profiles table...");
  try {
      const { error: colErr } = await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
          ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
          ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
          ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_tier TEXT DEFAULT 'none';
          ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 100;
        `
      });

      if (colErr) {
        console.warn("   ⚠️ RPC exec_sql reported error:", colErr.message);
      } else {
        console.log("   ✅ Columns repaired.");
      }
  } catch (e: any) {
      console.warn("   ⚠️ RPC exec_sql call failed (likely missing):", e.message);
  }

  // 2. Ensure community_messages exists
  console.log("2. Checking community_messages...");
  const { error: msgErr } = await supabase.from('community_messages').select('id').limit(1);
  if (msgErr && msgErr.code === '42P01') {
    console.error("   ❌ Tabela community_messages NÃO existe no banco físico.");
  } else {
    console.log("   ✅ community_messages OK.");
  }

  // 3. Reload Schema Cache
  console.log("3. Reloading schema cache...");
  try {
    await supabase.rpc('force_refresh_schema_permissions');
    console.log("   ✅ Schema refresh triggered.");
  } catch (e) {
    console.warn("   ⚠️ Schema refresh failed.");
  }
  
  console.log("--- REPAIR COMPLETE ---");
}

repairProd();
