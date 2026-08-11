import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function main() {
  const tables = ['tutorials','tutorial_progress','user_roles','user_missions','loyalty_missions','reward_missions','user_mission_progress','vip_tier','vip_configs','play_protect_grants','support_threads','support_messages','shadow_pass','shadow_pass_progress','community_messages'];
  for (const t of tables) {
    const { data, error } = await supabaseAdmin.from(t).select('*').limit(1);
    if (error) console.log(t, '-> ERROR', error.code, error.message);
    else console.log(t, '-> OK columns:', data && data.length ? Object.keys(data[0]) : '(empty table, no columns known)');
  }
}
main();
