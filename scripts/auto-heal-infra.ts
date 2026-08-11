import { createClient } from '@supabase/supabase-js';

async function heal() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Extração do Project ID da URL
  const projectId = url?.split('//')[1]?.split('.')[0];

  console.log("\n[Shadow Protocol] Build Pipeline Verification...");
  console.log(`[Shadow Protocol] Target URL: ${url}`);
  console.log(`[Shadow Protocol] Project ID: ${projectId}`);

  if (!url || !key) {
    console.error("[Shadow Protocol] ❌ FALHA CRÍTICA: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.");
    process.exit(1);
  }
  
  if (!url.includes('supabase.co')) {
    console.error("[Shadow Protocol] ❌ ERRO DE CONEXÃO: URL do Supabase inválida.");
    process.exit(1);
  }

  console.log("[Shadow Protocol] Conexão validada. Iniciando Auto-Healing...");
  const supabase = createClient(url, key);

  // 1. Storage Buckets
  console.log("[Shadow Protocol] Ensuring storage buckets...");
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketNames = buckets?.map(b => b.name) || [];
  
  if (!bucketNames.includes('avatars')) {
    console.log("[Shadow Protocol] Creating 'avatars' bucket...");
    await supabase.storage.createBucket('avatars', { public: true });
  }

  // 2. Schema Probe & Repair
  console.log("[Shadow Protocol] Probing schema...");
  const { data: profileCols, error: pErr } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
  
  if (pErr) {
    console.error(`[Shadow Protocol] Schema probe failed: ${pErr.message}`);
  } else if (profileCols) {
    const cols = Object.keys(profileCols);
    const required = ['trial_started_at', 'trial_expires_at', 'metadata', 'vip_tier', 'reputation_score'];
    const missing = required.filter(c => !cols.includes(c));
    
    if (missing.length > 0) {
      console.warn(`[Shadow Protocol] Missing columns in profiles: ${missing.join(', ')}`);
      
      const sql = `
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
        ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
        
        -- Reload schema
        NOTIFY pgrst, 'reload schema';
      `;
      
      console.log("[Shadow Protocol] Attempting emergency repair via RPC...");
      const rpcProbes = ['exec_sql', 'run_sql', 'execute_sql'];
      let repaired = false;
      for (const rpc of rpcProbes) {
        const { error } = await supabase.rpc(rpc, { sql });
        if (!error) {
          console.log(`[Shadow Protocol] ✅ Repair successful using RPC: ${rpc}`);
          repaired = true;
          break;
        }
      }
      
      if (!repaired) {
        console.error("[Shadow Protocol] ❌ AUTO-HEALING FAILED: No SQL RPC found on target.");
        console.log("\n[ACTION REQUIRED] Run the following SQL in the Supabase Dashboard SQL Editor:");
        console.log(sql);
      }
    } else {
      console.log("[Shadow Protocol] ✅ All profile columns present.");
    }
  }

  // 3. Community Messages check
  const { error: msgErr } = await supabase.from('community_messages').select('id').limit(1);
  if (msgErr) {
    console.log(`[Shadow Protocol] community_messages status: ${msgErr.code}`);
  } else {
    console.log("[Shadow Protocol] ✅ community_messages is accessible.");
  }

  console.log("[Shadow Protocol] Auto-healing cycle finished.\n");
}

heal();
