import { createClient } from '@supabase/supabase-js';

async function run() {
  const envUrl = process.env.VITE_SUPABASE_URL;
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // We target the one identified by Vercel logs and the user's manual correction
  const targets = [
    { name: "ENVIRONMENT", url: envUrl, key: envKey },
    { name: "VERCEL_PROD_TARGET", url: "https://dvnksmqbpbzwgwmbnjjy.supabase.co", key: envKey }
  ];

  console.log("=== SHADOW PROTOCOL: FINAL INFRA REPAIR v43 ===");

  for (const target of targets) {
    if (!target.url || !target.key) continue;
    
    console.log(`\n--- Repairing Target: ${target.name} (${target.url}) ---`);
    const supabase = createClient(target.url, target.key);

    // 1. Storage Buckets
    console.log("   1. Checking Storage...");
    const { data: buckets } = await supabase.storage.listBuckets();
    const names = buckets?.map(b => b.name) || [];
    
    if (!names.includes('avatars')) {
      console.log("      - Creating 'avatars' bucket...");
      await supabase.storage.createBucket('avatars', { public: true });
    }
    if (!names.includes('tutorials')) {
      console.log("      - Creating 'tutorials' bucket...");
      await supabase.storage.createBucket('tutorials', { public: false });
    }

    // 2. Schema DDL (using a specialized RPC if available, or just identifying failure)
    // The user mentioned "exec_sql" might not exist. We'll try to find any RPC that can run SQL.
    // If not, we rely on the migration v41/v42 being picked up by the build process 
    // IF the build process actually runs migrations against the target.
    
    console.log("   2. Checking Schema via RPC...");
    const ddl = `
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_tier TEXT DEFAULT 'none';
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 100;
      
      CREATE TABLE IF NOT EXISTS public.community_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_anonymous BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      
      GRANT ALL ON public.profiles TO authenticated, service_role;
      GRANT ALL ON public.community_messages TO authenticated, service_role;
    `;

    // Try a few known RPC names
    const rpcNames = ['exec_sql', 'run_sql', 'execute_sql'];
    let success = false;
    for (const name of rpcNames) {
      const { error } = await supabase.rpc(name, { sql: ddl });
      if (!error) {
        console.log(`      ✅ Success using RPC: ${name}`);
        success = true;
        break;
      }
    }

    if (!success) {
      console.log("      ❌ Direct SQL RPCs failed. Ensure migrations/v39-v42 are applied via Dashboard or CLI.");
    }

    // 3. Post-Repair Verification
    console.log("   3. Final Verification...");
    const { data: probe, error: probeErr } = await supabase.from('profiles').select('trial_started_at').limit(1).maybeSingle();
    if (probeErr) {
        console.log(`      ❌ profiles.trial_started_at: FAILED (${probeErr.message})`);
    } else {
        console.log("      ✅ profiles.trial_started_at: OK");
    }

    const { error: msgErr } = await supabase.from('community_messages').select('id').limit(1);
    console.log("      ✅ community_messages:", msgErr ? `FAILED (${msgErr.code})` : "OK");
  }
}

run();
