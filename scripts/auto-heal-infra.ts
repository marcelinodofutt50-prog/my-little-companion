import { createClient } from '@supabase/supabase-js';

async function heal() {
  const frontendUrl = process.env.VITE_SUPABASE_URL;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Extração do Project ID da URL
  const projectId = url?.split('//')[1]?.split('.')[0];

  console.log("\n[Shadow Protocol] Build Pipeline Verification...");
  console.log(`[Shadow Protocol] Target URL: ${url}`);
  console.log(`[Shadow Protocol] Project ID: ${projectId}`);

  if (!frontendUrl || !url || !key) {
    console.error("[Shadow Protocol] ❌ FALHA CRÍTICA: VITE_SUPABASE_URL, SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.");
    process.exit(1);
  }

  const frontendProjectId = frontendUrl.split('//')[1]?.split('.')[0];
  if (!projectId || frontendProjectId !== projectId) {
    console.error(`[Shadow Protocol] ❌ IDENTIDADE DIVERGENTE: frontend=${frontendProjectId}, auto-healing=${projectId}.`);
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
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) throw new Error(`[Shadow Protocol] Storage authentication failed: ${bucketsError.message}`);
  const bucketNames = buckets?.map(b => b.name) || [];
  
  if (!bucketNames.includes('avatars')) {
    console.log("[Shadow Protocol] Creating 'avatars' bucket...");
    const { error } = await supabase.storage.createBucket('avatars', { public: true });
    if (error) throw new Error(`[Shadow Protocol] Could not create avatars bucket: ${error.message}`);
  }

  // 2. Schema Probe & Repair
  console.log("[Shadow Protocol] Probing schema...");
  const { error: pErr } = await supabase
    .from('profiles')
    .select('trial_started_at, trial_expires_at, metadata, vip_tier, reputation_score')
    .limit(1);
  
  if (pErr) throw new Error(`[Shadow Protocol] Required profile columns are unavailable: [${pErr.code}] ${pErr.message}`);
  console.log("[Shadow Protocol] ✅ All profile columns present.");

  // 3. Community Messages check
  const { error: msgErr } = await supabase.from('community_messages').select('id').limit(1);
  if (msgErr) {
    throw new Error(`[Shadow Protocol] community_messages is unavailable: [${msgErr.code}] ${msgErr.message}`);
  } else {
    console.log("[Shadow Protocol] ✅ community_messages is accessible.");
  }

  console.log("[Shadow Protocol] Auto-healing cycle finished.\n");
}

heal().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
