import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing URL or Service Role Key');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  
  console.log('--- Environment Info ---');
  console.log('URL:', url);
  
  const { data: profileColumns, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
  
  if (profileError) {
    console.error('Error reading profiles:', profileError);
  } else {
    const row = profileColumns?.[0];
    const keys = row ? Object.keys(row) : [];
    console.log('Profiles columns:', keys);
    console.log('trial_started_at exists:', keys.includes('trial_started_at'));
  }

  const { error: communityError } = await supabase
    .from('community_messages')
    .select('id')
    .limit(1);
  
  console.log('community_messages accessibility:', communityError ? communityError.message : 'OK');

  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) {
    console.error('Error listing buckets:', bucketsError);
  } else {
    console.log('Buckets found:', buckets.map(b => b.name));
    console.log('avatars exists:', buckets.some(b => b.name === 'avatars'));
  }
}

main().catch(console.error);
