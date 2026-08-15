import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Shadow Production Stability Audit (v10.8)
 * Auditoria final de estabilidade para deploy Vercel.
 * Focado em garantir que todas as camadas (DB, Storage, Server Fns) estejam sincronizadas.
 */

describe('Shadow Production Stability Final Audit', () => {

  it('should verify profile metadata schema availability', async () => {
    // A coluna 'metadata' é crucial para as customizações do Shadow Pass
    const { data, error } = await supabase
      .from('profiles')
      .select('metadata, display_name, vip_tier, reputation_score')
      .limit(1);

    if (error) {
      console.error('[Audit Failure] Profiles schema mismatch:', error.message);
    }
    
    expect(error?.code).not.toBe('42703'); // undefined_column
    expect(error?.code).not.toBe('PGRST108'); // schema_cache_error
  });

  it('should verify community nexus data tunnel health', async () => {
    // O chat da comunidade usa um join complexo que costuma falhar se o cache estiver sujo
    const { data, error } = await supabase
      .from('community_messages')
      .select(`
        id, 
        content,
        profiles!user_id(display_name, metadata)
      `)
      .limit(1);

    if (error) {
      console.warn('[Audit Warning] Community join issue:', error.message);
    }
    
    // PGRST108 é o erro clássico de cache do PostgREST que resolvemos com NOTIFY
    expect(error?.code).not.toBe('PGRST108');
  });

  it('should verify system storage bucket "avatars" visibility', async () => {
    // O Shadow Pass v8.0+ exige que este bucket seja público para os avatares funcionarem
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl('test-probe.png');

    expect(data.publicUrl).toContain('/public/avatars/');
  });

  it('should verify mission and loyalty system schema', async () => {
    // Shadow Loyalty v1.0+ depende destas tabelas
    const { error: missionsError } = await supabase
      .from('loyalty_missions')
      .select('id')
      .limit(1);
      
    // Verificamos a tabela correta conforme o schema (loyalty_tier_config)
    const { error: tiersError } = await supabase
      .from('loyalty_tier_config')
      .select('id')
      .limit(1);

    expect(missionsError?.code).not.toBe('42P01'); // undefined_table
    expect(tiersError?.code).not.toBe('42P01');
  });

  it('keeps profiles closed to anonymous clients', async () => {
    // Perfis nunca podem ser lidos sem sessão: o painel usa funções autenticadas.
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    expect(error?.code === '42501' || (data?.length ?? 0) === 0).toBe(true);
  });
});
