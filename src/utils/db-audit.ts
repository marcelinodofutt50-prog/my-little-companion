import { supabaseAdmin } from '@/integrations/supabase/client.server';

/**
 * Script de auditoria de permissões e RLS.
 * Utiliza rpc e queries cruas para verificar integridade entre ambientes.
 */
export async function auditPermissions() {
  console.log('--- INICIANDO AUDITORIA DE SEGURANÇA DO BANCO ---');
  
  const tables = ['tutorials', 'tutorial_progress', 'user_roles', 'licenses', 'support_quotas'];
  const results = [];

  for (const table of tables) {
    try {
      // 1. Verifica RLS usando query crua (contornando tipagem estrita do cliente gerado)
      const { data: rlsCheck, error: rlsError } = await (supabaseAdmin as any).rpc('check_rls_enabled', { 
        table_name: table 
      });

      // 2. Verifica se existem políticas de segurança
      // Usamos query direta no schema do sistema para evitar restrições do cliente public
      const { data: policies, error: polError } = await (supabaseAdmin as any)
        .from('pg_policies')
        .select('*')
        .eq('tablename', table);

      results.push({
        table,
        rls: rlsCheck ? 'ENABLED' : 'WARNING: DISABLED',
        policyCount: policies?.length || 0,
        status: (rlsCheck && policies && policies.length > 0) ? 'OK' : 'FAIL',
        details: polError ? `Error: ${polError.message}` : 'Clean'
      });
    } catch (e: any) {
      results.push({ table, error: e.message || 'Failed to inspect' });
    }
  }

  console.table(results);
  return results;
}
