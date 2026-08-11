import { createClient } from '@supabase/supabase-js';

const TARGETS = [
  "https://yvvjaoqzhjqnchhwhwvy.supabase.co",
  "https://dvnksmqbpbzwgwmbnjjy.supabase.co"
];

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function repair() {
  if (!SERVICE_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  for (const url of TARGETS) {
    console.log(`\n--- REPAIRING: ${url} ---`);
    const supabase = createClient(url, SERVICE_KEY);

    // Try to execute SQL to add columns and table
    const sql = `
      -- 1. Profiles columns
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_tier TEXT DEFAULT 'none';
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 100;

      -- 2. Community Messages table
      CREATE TABLE IF NOT EXISTS public.community_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_anonymous BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      -- 3. Grants & RLS
      GRANT ALL ON public.profiles TO authenticated, service_role;
      GRANT ALL ON public.community_messages TO authenticated, service_role;
      ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

      -- 4. Reload cache
      NOTIFY pgrst, 'reload schema';
    `;

    console.log("   Attempting DDL via RPC exec_sql...");
    const { error: rpcErr } = await supabase.rpc('exec_sql', { sql });
    if (rpcErr) {
      console.log(`   ❌ exec_sql failed: ${rpcErr.message}`);
      
      console.log("   Attempting per-column repair via table update (if possible)...");
      // Some clients might not have exec_sql.
    } else {
      console.log("   ✅ DDL executed successfully.");
    }

    // Ensure Bucket
    console.log("   Checking storage buckets...");
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketNames = buckets?.map(b => b.name) || [];
    
    if (!bucketNames.includes('avatars')) {
      console.log("   Creating 'avatars' bucket...");
      await supabase.storage.createBucket('avatars', { public: true });
    }
    if (!bucketNames.includes('tutorials')) {
      console.log("   Creating 'tutorials' bucket...");
      await supabase.storage.createBucket('tutorials', { public: false });
    }
    
    console.log("   Final Verification...");
    const { data: probe } = await supabase.from('profiles').select('trial_started_at').limit(1);
    console.log(`   profiles.trial_started_at: ${probe ? "OK" : "MISSING"}`);
  }
}

repair();
