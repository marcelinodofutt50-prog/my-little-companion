import { createClient } from '@supabase/supabase-js';

const PROD_URL = "https://yvvjaoqzhjqnchhwhwvy.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  if (!SERVICE_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  console.log(`[AUDIT] Targeting: ${PROD_URL}`);
  const supabase = createClient(PROD_URL, SERVICE_KEY);

  // 1. Check Profiles Columns
  const { data: profileSample, error: pErr } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
  if (pErr) {
    console.error("Profiles error:", pErr.message);
  } else if (profileSample) {
    const cols = Object.keys(profileSample);
    const required = ['trial_started_at', 'trial_expires_at', 'metadata', 'vip_tier', 'reputation_score'];
    console.log("Profiles columns:", cols.filter(c => required.includes(c)));
    const missing = required.filter(c => !cols.includes(c));
    if (missing.length > 0) console.error("MISSING COLUMNS:", missing);
  } else {
    console.log("Profiles table is empty, cannot probe via SELECT *");
  }

  // 2. Check community_messages
  const { error: cErr } = await supabase.from('community_messages').select('id').limit(1);
  console.log("community_messages:", cErr ? `FAIL (${cErr.code})` : "PASS");

  // 3. Check Buckets
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketNames = buckets?.map(b => b.name) || [];
  console.log("Buckets:", bucketNames);
}

run();
