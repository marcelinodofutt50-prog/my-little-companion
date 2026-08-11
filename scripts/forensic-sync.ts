import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing URL or Service Role Key');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  
  console.log('--- SYNC AUDIT: Project dvnksmqbpbzwgwmbnjjy ---');
  
  // 1. Force Column Check
  const { data: cols } = await supabase.rpc('run_sql', { 
    sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND table_schema = 'public'" 
  }).catch(() => ({ data: null }));
  
  if (cols) {
    console.log('Detected Columns:', cols.map((c: any) => c.column_name));
  } else {
    // Fallback direct check
    const { data: profiles } = await supabase.from('profiles').select('*').limit(1);
    console.log('Profiles Row Keys:', profiles?.[0] ? Object.keys(profiles[0]) : 'No data');
  }

  // 2. Storage Bucket Deep Check
  const { data: bucket, error: bucketErr } = await supabase.storage.getBucket('avatars');
  console.log('Storage Bucket "avatars":', bucketErr ? `NOT FOUND: ${bucketErr.message}` : 'EXISTS');
  
  // 3. Table existence
  const { error: commErr } = await supabase.from('community_messages').select('id').limit(1);
  console.log('Table "community_messages":', commErr ? `MISSING/CACHE: ${commErr.message}` : 'EXISTS');

  // 4. Force Reload Trigger
  console.log('Triggering PostgREST Schema Reload...');
  await supabase.rpc('force_refresh_schema_permissions').catch(() => {});
  
  // 5. Final Handshake
  const { data: test } = await supabase.from('profiles').select('trial_started_at').limit(1);
  console.log('Final Handshake (trial_started_at):', test ? 'OK' : 'FAIL');
}

main().catch(console.error);
