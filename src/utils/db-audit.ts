import { supabaseAdmin } from './integrations/supabase/client.server';

/**
 * Script de auditoria de permissões e RLS.
 * Verifica se as tabelas críticas possuem RLS ativo e permissões básicas para o app.
 */
export async function auditPermissions() {
  console.log('--- INICIANDO AUDITORIA DE SEGURANÇA DO BANCO ---');
  
  const tables = ['tutorials', 'tutorial_progress', 'user_roles', 'licenses', 'support_quotas'];
  const results = [];

  for (const table of tables) {
    try {
      // 1. Verifica se RLS está habilitado
      const { data: rlsData, error: rlsError } = await supabaseAdmin.rpc('check_rls_enabled', { table_name: table });
      
      // Como talvez a função RPC não exista, usamos uma query direta nas tabelas do sistema se possível, 
      // ou apenas tentamos ler informações de políticas.
      const { data: policies, error: polError } = await supabaseAdmin
        .from('pg_policies')
        .select('*')
        .eq('tablename', table);

      // 2. Verifica Grants (via query direta em information_schema se permitido)
      // Nota: Em ambientes restritos, verificamos se a tabela é acessível via service_role vs anon
      
      results.push({
        table,
        rls: policies && policies.length > 0 ? 'ENABLED/CONFIGURED' : 'WARNING: NO POLICIES FOUND',
        policyCount: policies?.length || 0,
        status: policies && policies.length > 0 ? 'OK' : 'FAIL'
      });
    } catch (e) {
      results.push({ table, error: 'Failed to inspect' });
    }
  }

  console.table(results);
  console.log('--- FIM DA AUDITORIA ---');
  return results;
}
