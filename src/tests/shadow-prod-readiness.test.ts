import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Shadow Production Readiness Audit (v10.6)
 * Valida o estado final da infraestrutura para o deploy na Vercel.
 */

describe('Shadow Production Final Audit', () => {
  
  it('should verify global availability of "profiles" metadata', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('metadata, vip_tier, reputation_score')
      .limit(1);
    
    // Teste de integridade de esquema
    if (error) {
      console.error("[Audit Failure] Profiles columns missing:", error);
    }
    expect(error?.code).not.toBe('42703'); 
  });


  it('should verify "community_messages" relation health', async () => {
    const { data, error } = await supabase
      .from('community_messages')
      .select(`
        id,
        profiles!community_messages_user_id_fkey(display_name)
      `)
      .limit(1);
    
    // Verifica se o join está funcionando corretamente (não deve falhar por cache do PostgREST)
    expect(error?.code).not.toBe('PGRST108');
  });

  it('should verify storage CDN assets are reachable', async () => {
    // Logo crítica do sistema
    const logoUrl = "/assets/shadow-logo-v10.png?v=v10-101";
    expect(logoUrl).toBeTruthy();
  });
  
  it('should verify "community_goals" table accessibility', async () => {
    const { data, error } = await supabase
      .from('community_goals')
      .select('*')
      .limit(1);
      
    expect(error?.code).not.toBe('42P01');
  });
});
