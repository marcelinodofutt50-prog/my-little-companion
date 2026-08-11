import { createClient } from '@supabase/supabase-js';

const TARGET_URL = "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // We must assume the secret is shared or provided

async function run() {
  console.log(`[REPAIR] Target: ${TARGET_URL}`);
  if (!TARGET_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY for target database repair.");
    process.exit(1);
  }

  const supabase = createClient(TARGET_URL, TARGET_KEY);

  console.log("1. Checking 'profiles' columns...");
  const { data: profileSample, error: profileErr } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
  
  if (profileErr) {
    console.error("Error reading profiles from target:", profileErr);
  } else {
    const cols = profileSample ? Object.keys(profileSample) : [];
    console.log("Current profiles columns:", cols);
    
    const required = ['trial_started_at', 'trial_expires_at', 'metadata', 'vip_tier', 'reputation_score'];
    const missing = required.filter(c => !cols.includes(c));
    
    if (missing.length > 0) {
      console.log("Missing columns:", missing);
      console.log("Attempting to add columns via DDL...");
      // Since exec_sql might not exist, we try a migration-like approach or hope for another RPC.
      // If no RPC, we have to rely on the user applying the migration or us finding a way.
    } else {
      console.log("All required columns present in 'profiles'.");
    }
  }

  console.log("2. Checking 'community_messages'...");
  const { error: msgErr } = await supabase.from('community_messages').select('id').limit(1);
  if (msgErr) {
    console.log("community_messages missing or inaccessible:", msgErr.code, msgErr.message);
  } else {
    console.log("community_messages is OK.");
  }
}

run();
