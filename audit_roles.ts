import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function audit() {
  const { data, error } = await supabaseAdmin.from('user_roles').select('*').limit(5);
  console.log('User Roles Status:', error ? 'Error: ' + error.code : 'Exists');
  if (data) console.log('Sample Roles:', data);
}

audit();
