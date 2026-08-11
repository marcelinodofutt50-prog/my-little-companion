import { createClient } from '@supabase/supabase-js';

async function audit() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const supabase = createClient(url, key);
  
  console.log("--- Profiles ---");
  const { data: p } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
  console.log("Profiles columns:", p ? Object.keys(p) : "Empty");

  console.log("--- Community Messages ---");
  const { error: c } = await supabase.from('community_messages').select('id').limit(1);
  console.log("Community messages status:", c ? `FAIL (${c.code})` : "OK");
}

audit();
