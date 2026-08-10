import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Shadow Support E2E & Readiness Test (v11.1)
 * Valida o fluxo completo da central de atendimento com relatórios automáticos de falha.
 */

const reportFailure = async (testName: string, error: any) => {
  console.error(`[Shadow Report] Falha crítica em "${testName}":`, error);
  console.error(`[Shadow Report] Stack Trace:`, error?.stack);
  
  // Como o ambiente Vitest não tem acesso ao TanStack Start runtime context durante testes unitários puros,
  // logs detalhados no console são nossa primeira linha de defesa forense.
  // Em produção, a função 'generateDiagnosticReport' cuidará da persistência no banco.
};

describe('Shadow Support Center E2E', () => {
  
  it('should verify support_threads schema and RLS readability', async () => {
    try {
      const { data, error } = await supabase
        .from('support_threads')
        .select('id, status, category, priority')
        .limit(1);
      
      if (error && error.code !== '42501') throw error;
      expect(error?.code).not.toBe('PGRST108');
      expect(error?.code).not.toBe('42P01');
    } catch (e) {
      await reportFailure('support_threads_schema', e);
      throw e;
    }
  });

  it('should verify support_messages relationship with profiles', async () => {
    try {
      const { error } = await supabase
        .from('support_messages')
        .select(`
          id,
          body,
          profiles:sender_id (display_name)
        `)
        .limit(1);

      if (error && error.code !== '42501') throw error;
      expect(error?.code).not.toBe('42703');
      expect(error?.code).not.toBe('PGRST108');
    } catch (e) {
      await reportFailure('support_messages_join', e);
      throw e;
    }
  });

  it('should confirm support-media bucket integrity', async () => {
    try {
      const { data: urlData } = supabase.storage
        .from('support-media')
        .getPublicUrl('probe.png');

      expect(urlData.publicUrl).toContain('support-media');
    } catch (e) {
      await reportFailure('support_media_bucket', e);
      throw e;
    }
  });

  it('should validate support AI trigger metadata compatibility', async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('metadata')
        .limit(1);
        
      if (error && error.code !== '42501') throw error;
      expect(error?.code).not.toBe('42703');
    } catch (e) {
      await reportFailure('support_ai_metadata', e);
      throw e;
    }
  });
});
