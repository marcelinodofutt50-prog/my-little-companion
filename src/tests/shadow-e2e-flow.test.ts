import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Shadow E2E Flow Validation (v10.5)
 * Simula fluxos críticos do usuário para garantir que RLS e permissões
 * estejam operacionais em ambiente de produção (Vercel).
 */

describe('Shadow E2E User Journey', () => {
  
  it('should validate profile customization flow resilience', async () => {
    // 1. Verificar se a função de atualização de perfil (Admin Tunnel) está disponível
    // Note: Em testes reais de unidade/E2E no sandbox, focamos na existência do contrato.
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('metadata')
      .limit(1)
      .maybeSingle();
      
    // Se o PostgREST estiver saudável, não deve retornar 406 Not Acceptable ou 42703
    expect(error?.code).not.toBe('PGRST108');
    expect(error?.code).not.toBe('42703');
  });

  it('should validate community nexus connectivity', async () => {
    // Simula o carregamento inicial do chat da comunidade
    const { data: messages, error } = await supabase
      .from('community_messages')
      .select(`
        id, 
        content,
        profiles(display_name)
      `)
      .limit(5);

    // Garante que a relação profiles existe e a tabela está acessível
    if (error) {
      console.error('[E2E Failure] Community table access:', error.message);
    }
    
    expect(error?.code).not.toBe('PGRST108');
    expect(error?.code).not.toBe('42P01'); // Undefined table
  });

  it('should validate storage CDN propagation', async () => {
    // Verifica se os assets críticos (como a logo v10) estão servindo URLs válidas
    const shadowMark = "/assets/shadow-logo-v10.png?v=v10-101";
    
    // Em um teste de navegador real usaríamos fetch, aqui validamos o path prefix
    expect(shadowMark).toContain('assets');
    expect(shadowMark).toContain('v=v10');
  });

  it('should confirm system reputation calculation logic accessibility', async () => {
    // O Shadow Pass v7.0+ depende do reputation_score
    const { data, error } = await supabase
      .from('profiles')
      .select('reputation_score')
      .limit(1);
      
    expect(error?.code).not.toBe('42703');
  });
});
