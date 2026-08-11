import { createClient } from '@supabase/supabase-js';

async function audit() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log("=== FINAL INFRASTRUCTURE AUDIT ===");
  console.log(`Target: ${url}`);
  
  const supabase = createClient(url!, key!);
  
  // 1. Check Profiles Columns
  console.log("\n[1/3] Checking profiles columns...");
  const { data: profile, error: pErr } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
  if (pErr) {
    console.error("❌ profiles check failed:", pErr.message);
  } else if (profile) {
    const cols = Object.keys(profile);
    const required = ['trial_started_at', 'trial_expires_at', 'metadata', 'vip_tier', 'reputation_score'];
    required.forEach(c => {
      if (cols.includes(c)) console.log(`✅ Column present: ${c}`);
      else console.error(`❌ Column MISSING: ${c}`);
    });
  } else {
    console.log("⚠️ Profiles table is empty, but accessible.");
  }

  // 2. Check community_messages
  console.log("\n[2/3] Checking community_messages...");
  const { error: msgErr } = await supabase.from('community_messages').select('id').limit(1);
  if (msgErr) {
    console.error(`❌ community_messages check failed: ${msgErr.message} (${msgErr.code})`);
  } else {
    console.log("✅ community_messages is present and accessible.");
  }

  // 3. Check storage buckets
  console.log("\n[3/3] Checking storage buckets...");
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketNames = buckets?.map(b => b.name) || [];
  ['avatars', 'tutorials'].forEach(b => {
    if (bucketNames.includes(b)) console.log(`✅ Bucket present: ${b}`);
    else console.error(`❌ Bucket MISSING: ${b}`);
  });
}

audit();
