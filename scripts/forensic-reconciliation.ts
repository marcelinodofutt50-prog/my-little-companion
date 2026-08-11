import { createClient } from '@supabase/supabase-js';

async function audit() {
  const envUrl = process.env.VITE_SUPABASE_URL;
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const targets = [
    { name: "ENVIRONMENT", url: envUrl, key: envKey },
    { name: "LOVABLE_CLOUD", url: "https://yvvjaoqzhjqnchhwhwvy.supabase.co", key: envKey },
    { name: "VERCEL_PROD", url: "https://dvnksmqbpbzwgwmbnjjy.supabase.co", key: envKey }
  ];

  console.log("=== SHADOW PROTOCOL: FORENSIC RECONCILIATION ===");

  for (const target of targets) {
    console.log(`\n--- Testing Target: ${target.name} (${target.url}) ---`);
    if (!target.url || !target.key) {
      console.log("   Skipping: Missing URL or Key.");
      continue;
    }

    const supabase = createClient(target.url, target.key);
    
    // 1. Identity Check
    const { data: health, error: healthErr } = await supabase.from('profiles').select('id').limit(1);
    if (healthErr) {
      console.log(`   ❌ Connection Failed: ${healthErr.message} (${healthErr.code})`);
      continue;
    }
    console.log("   ✅ Connection established.");

    // 2. Schema Check
    const { data: columns, error: colErr } = await supabase.rpc('exec_sql', {
      sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND table_schema = 'public'"
    });

    let profileCols: string[] = [];
    if (colErr) {
      console.log("   ⚠️ exec_sql failed, trying direct probe...");
      const { data: probe } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
      profileCols = probe ? Object.keys(probe) : [];
    } else {
      profileCols = (columns as any[]).map(c => c.column_name);
    }

    const required = ['trial_started_at', 'trial_expires_at', 'metadata', 'vip_tier', 'reputation_score'];
    const status = required.map(c => ({ col: c, exists: profileCols.includes(c) }));
    console.log("   Profiles Columns Status:", status);

    const { error: commErr } = await supabase.from('community_messages').select('id').limit(1);
    console.log("   community_messages Status:", commErr ? `❌ ${commErr.code}` : "✅ EXISTS");
    
    const { data: bucket, error: bucketErr } = await supabase.storage.getBucket('avatars');
    console.log("   avatars bucket Status:", bucketErr ? `❌ ${bucketErr.message}` : "✅ EXISTS");
  }
}

audit();
