import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function audit() {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').limit(1).single();
  if (data) {
    console.log('Profile keys:', Object.keys(data));
  } else {
    console.log('Error or no profiles:', error);
  }
}

audit();
