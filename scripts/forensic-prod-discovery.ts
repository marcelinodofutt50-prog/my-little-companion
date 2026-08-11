import { createClient } from '@supabase/supabase-js';

async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`[AUDIT] VITE_SUPABASE_URL: ${url}`);
  console.log(`[AUDIT] SUPABASE_SERVICE_ROLE_KEY presence: ${!!key}`);

  if (!url || !key) {
    console.error("Missing credentials");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log("\n--- TABLE: profiles ---");
  const { data: profileCols, error: profileErr } = await supabase.rpc('exec_sql', { 
    sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND table_schema = 'public'" 
  });

  if (profileErr) {
    console.log("exec_sql failed, trying direct query...");
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    if (error) {
      console.error("Direct query failed:", error);
    } else if (data && data.length > 0) {
      console.log("Columns found via keys:", Object.keys(data[0]));
    } else {
      console.log("Table profiles is empty, trying to insert a dummy to see schema...");
      // This is risky if it fails, but we need to know.
    }
  } else {
    console.log("Columns:", profileCols);
  }

  console.log("\n--- TABLE: community_messages ---");
  const { error: msgErr } = await supabase.from('community_messages').select('id').limit(1);
  if (msgErr) {
    console.log("community_messages error:", msgErr.code, msgErr.message);
  } else {
    console.log("community_messages table exists and is accessible.");
  }
}

run();
