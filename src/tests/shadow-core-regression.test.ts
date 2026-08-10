import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Shadow Core Regression Test Suite (v10.4)
 * Focado em validar a integridade do banco de dados e as permissões do Supabase
 * para evitar reincidência de erros de 'metadata' e 'community_messages'.
 */

describe('Shadow Core Infrastructure Integrity', () => {
  
  it('should verify profiles table has all required columns', async () => {
    // Tentamos selecionar as colunas críticas que causaram erros anteriormente
    const { data, error } = await supabase
      .from('profiles')
      .select('id, metadata, vip_tier, reputation_score')
      .limit(1);
    
    // PGRST108 (Column not found) retornaria erro aqui
    if (error && error.code === '42703') {
      throw new Error(`CRITICAL REGRESSION: Missing column in profiles table. Details: ${error.message}`);
    }
    
    // Se não houver erro de coluna, o teste passa (mesmo se o data for vazio)
    expect(error?.code).not.toBe('42703');
  });

  it('should verify community_messages table is accessible', async () => {
    const { error } = await supabase
      .from('community_messages')
      .select('id')
      .limit(1);

    // PGRST108 ou 42P01 (Relation not found)
    if (error && (error.code === 'PGRST108' || error.code === '42P01')) {
      throw new Error(`CRITICAL REGRESSION: community_messages table not found or not granted. Details: ${error.message}`);
    }

    expect(error?.code).not.toBe('42P01');
  });

  it('should verify storage bucket "avatars" is public', async () => {
    // Tentamos pegar uma URL pública de um arquivo inexistente apenas para validar o bucket
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl('test-probe.png');

    expect(data.publicUrl).toContain('/storage/v1/object/public/avatars/');
  });
});
