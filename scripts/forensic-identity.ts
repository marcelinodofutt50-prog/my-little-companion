import { createClient } from '@supabase/supabase-js';

async function main() {
  const env_url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const env_key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('--- AUDITORIA DE IDENTIDADE DE AMBIENTE ---');
  console.log('1. VITE_SUPABASE_URL (Build/Vercel):', process.env.VITE_SUPABASE_URL);
  console.log('2. SUPABASE_URL (Admin/Scripts):', process.env.SUPABASE_URL);
  console.log('3. URL utilizada no script:', env_url);

  if (!env_url || !env_key) {
    console.error('ERRO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes.');
    process.exit(1);
  }

  const supabase = createClient(env_url, env_key);

  // Descobrir o Project ID real via hostname
  const urlObj = new URL(env_url);
  const hostnameParts = urlObj.hostname.split('.');
  const projectId = hostnameParts[0];
  console.log('4. Project ID detectado via URL:', projectId);
  console.log('5. Project ID esperado (Produção): dvnksmqbpbzwgwmbnjjy');
  
  if (projectId === 'dvnksmqbpbzwgwmbnjjy') {
    console.log('✅ IDENTIDADE CONFIRMADA: O script está apontando para o banco de PRODUÇÃO.');
  } else if (projectId === 'yvvjaoqzhjqnchhwhwvy') {
    console.log('⚠️ ALERTA: O script está apontando para o banco GERENCIADO/PREVIEW (yvvjaoqzhjqnchhwhwvy).');
  } else {
    console.log('❌ DIVERGÊNCIA: O Project ID', projectId, 'não coincide com o esperado.');
  }

  console.log('\n--- VERIFICAÇÃO OBJETIVA DE RECURSOS ---');
  
  // Buckets
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  const hasAvatars = buckets?.some(b => b.name === 'avatars');
  console.log('Bucket "avatars":', hasAvatars ? 'EXISTE' : 'NÃO ENCONTRADO');
  if (bErr) console.log('Erro Storage:', bErr.message);

  // Profiles Columns
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(1);
  const keys = profiles?.[0] ? Object.keys(profiles[0]) : [];
  console.log('Coluna profiles.trial_started_at:', keys.includes('trial_started_at') ? 'EXISTE' : 'NÃO EXISTE');
  console.log('Coluna profiles.trial_expires_at:', keys.includes('trial_expires_at') ? 'EXISTE' : 'NÃO EXISTE');
  if (pErr) console.log('Erro Profiles:', pErr.message);

  // community_messages
  const { error: cErr } = await supabase.from('community_messages').select('id').limit(1);
  console.log('Tabela community_messages:', cErr ? `FALHA (${cErr.code}): ${cErr.message}` : 'EXISTE');

  // Schema Cache Handshake
  console.log('\n--- CONCLUSÃO ---');
  if (hasAvatars && keys.includes('trial_started_at') && !cErr) {
    console.log('O banco consultado possui todos os recursos.');
  } else {
    console.log('O banco consultado ESTÁ FALTANDO recursos críticos.');
  }
}

main().catch(console.error);
