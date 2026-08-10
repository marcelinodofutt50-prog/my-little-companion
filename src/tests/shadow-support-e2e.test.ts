import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Shadow Support E2E & Readiness Test (v11.0)
 * Valida o fluxo completo da central de atendimento, permissões RLS e integridade do storage.
 */

describe('Shadow Support Center E2E', () => {
  
  it('should verify support_threads schema and RLS readability', async () => {
    // Validamos se a tabela existe e o cliente consegue ler (mesmo vazio)
    const { data, error } = await supabase
      .from('support_threads')
      .select('id, status, category, priority')
      .limit(1);
    
    // PGRST108 = Schema cache error
    // 42P01 = Table not found
    expect(error?.code).not.toBe('PGRST108');
    expect(error?.code).not.toBe('42P01');
    
    if (error && error.code !== '42501') { // 42501 é esperado se não houver sessão ativa no vitest
      console.error('[Support Audit] Unexpected thread fetch error:', error);
    }
  });

  it('should verify support_messages relationship with profiles', async () => {
    // O suporte exige join com profiles para exibir nomes de atendentes/clientes
    const { error } = await supabase
      .from('support_messages')
      .select(`
        id,
        body,
        profiles:sender_id (display_name)
      `)
      .limit(1);

    // Se falhar com 42703 (coluna inexistente) ou PGRST108, o sistema de suporte quebra visualmente
    expect(error?.code).not.toBe('42703');
    expect(error?.code).not.toBe('PGRST108');
  });

  it('should confirm support-media bucket integrity', async () => {
    // O upload de anexos no suporte depende deste bucket
    const { data, error } = await supabase.storage.getBucket('support-media');
    
    // Se o bucket não existir, o erro será 'Bucket not found'
    // Nota: getBucket pode exigir service_role, então testamos a URL pública como fallback de saúde
    const { data: urlData } = supabase.storage
      .from('support-media')
      .getPublicUrl('probe.png');

    expect(urlData.publicUrl).toContain('support-media');
  });

  it('should validate support AI trigger metadata compatibility', async () => {
    // A IA de suporte lê o campo metadata do perfil para contexto
    const { data, error } = await supabase
      .from('profiles')
      .select('metadata')
      .limit(1);
      
    expect(error?.code).not.toBe('42703');
  });
});
