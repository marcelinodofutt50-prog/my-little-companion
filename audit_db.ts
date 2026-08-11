import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function audit() {
  const { data, error } = await supabaseAdmin.rpc('get_table_columns', { table_name: 'profiles' });
  if (error) {
    console.log('Error getting columns via RPC, trying direct query on information_schema');
    const { data: cols, error: colErr } = await supabaseAdmin.from('information_schema.columns' as any).select('column_name').eq('table_name', 'profiles');
    console.log('Columns:', cols?.map(c => c.column_name));
  } else {
    console.log('Columns:', data);
  }
}

audit();
