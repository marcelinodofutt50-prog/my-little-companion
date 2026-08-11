import { createClient } from '@supabase/supabase-js';

async function main() {
  const env_url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const env_key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('--- AUDITORIA DE IDENTIDADE REAL ---');
  console.log('Ambiente:', env_url);

  if (!env_url || !env_key) {
    process.exit(1);
  }

  const supabase = createClient(env_url, env_key);

  const { data: buckets } = await supabase.storage.listBuckets();
  console.log('Buckets detectados:', buckets?.map(b => b.name));

  const { data: profiles } = await supabase.from('profiles').select('*').limit(1);
  const keys = profiles?.[0] ? Object.keys(profiles[0]) : [];
  console.log('Colunas profiles:', keys);

  const urlObj = new URL(env_url);
  console.log('Project ID extraído:', urlObj.hostname.split('.')[0]);
}

main().catch(console.error);
