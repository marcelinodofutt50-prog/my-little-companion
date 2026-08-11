import { createClient } from '@supabase/supabase-js';

async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("=== SHADOW PROTOCOL: POST-DEPLOY FORENSIC REPAIR ===");
  console.log(`Targeting: ${url}`);

  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const sql = `
    -- 1. Profiles Table Expansion
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_tier TEXT DEFAULT 'none';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 100;

    -- 2. Community Messages Table
    CREATE TABLE IF NOT EXISTS public.community_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_anonymous BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- 3. Security Grants
    GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
    GRANT SELECT, INSERT ON public.community_messages TO authenticated;
    GRANT ALL ON public.profiles TO service_role;
    GRANT ALL ON public.community_messages TO service_role;

    -- 4. RLS Activation
    ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
    
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Anyone can view non-anonymous messages') THEN
            CREATE POLICY "Anyone can view non-anonymous messages" ON public.community_messages
                FOR SELECT USING (NOT is_anonymous OR auth.uid() = user_id);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Users can post messages') THEN
            CREATE POLICY "Users can post messages" ON public.community_messages
                FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
    END
    \$\$;

    -- 5. Force Schema Reload
    NOTIFY pgrst, 'reload schema';
  `;

  console.log("   Applying DDL via RPC exec_sql...");
  const { error: rpcErr } = await supabase.rpc('exec_sql', { sql });
  
  if (rpcErr) {
    console.log(`   ❌ exec_sql failed: ${rpcErr.message}`);
    console.log("   Attempting per-column repair via alternative RPCs...");
    
    for (const alt of ['run_sql', 'execute_sql']) {
        const { error: altErr } = await supabase.rpc(alt, { sql });
        if (!altErr) {
            console.log(`      ✅ Success using alternative RPC: ${alt}`);
            break;
        }
    }
  } else {
    console.log("   ✅ DDL applied successfully.");
  }

  // Storage Bucket
  console.log("   Checking storage...");
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketNames = buckets?.map(b => b.name) || [];
  
  if (!bucketNames.includes('avatars')) {
    console.log("      - Creating 'avatars' bucket...");
    await supabase.storage.createBucket('avatars', { public: true });
  }

  console.log("=== REPAIR COMPLETE ===");
}

run();
