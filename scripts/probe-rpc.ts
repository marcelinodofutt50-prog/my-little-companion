import { createClient } from '@supabase/supabase-js';

async function probe() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const supabase = createClient(url, key);
  
  const rpcs = ['exec_sql', 'run_sql', 'execute_sql', 'manage_infra'];
  for (const rpc of rpcs) {
    const { error } = await supabase.rpc(rpc, { sql: 'SELECT 1' });
    if (!error) {
      console.log(`✅ RPC FOUND: ${rpc}`);
    } else {
      console.log(`❌ RPC NOT FOUND: ${rpc} (${error.message})`);
    }
  }
}
probe();
