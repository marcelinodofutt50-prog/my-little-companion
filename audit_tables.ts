import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function audit() {
  const tables = ['user_loyalty', 'loyalty_tier_config', 'community_goals', 'missions', 'user_missions', 'points_history', 'staff_messages'];
  for (const table of tables) {
    const { error } = await supabaseAdmin.from(table).select('*').limit(1);
    console.log(`Table ${table}: ${error ? 'Missing or error: ' + error.code : 'Exists'}`);
  }
}

audit();
