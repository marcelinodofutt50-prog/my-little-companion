import { createClient } from '@supabase/supabase-js';

async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const supabase = createClient(url, key);
  
  console.log("Probing for SQL execution RPCs...");
  const probes = ['exec_sql', 'run_sql', 'execute_sql', 'query', 'sql'];
  
  for (const p of probes) {
    const { error } = await supabase.rpc(p, { sql: "SELECT 1" });
    if (!error) {
      console.log(`✅ Found working RPC: ${p}`);
    } else {
      console.log(`❌ ${p}: ${error.message} (${error.code})`);
    }
  }
}

run();
