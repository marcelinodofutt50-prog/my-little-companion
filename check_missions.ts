import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function check() {
  const { data, error } = await supabaseAdmin.from('loyalty_missions').select('*').limit(1);
  if (error) {
    console.log('loyalty_missions error:', error.code, error.message);
  } else {
    console.log('loyalty_missions exists. Columns:', data.length > 0 ? Object.keys(data[0]) : 'Empty');
  }
}
check();
