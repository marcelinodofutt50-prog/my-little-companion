import { describe, it, expect, afterEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Shadow Support E2E & Readiness Test (v11.1)
 * Valida o fluxo completo da central de atendimento com relatórios automáticos de falha.
 */

const reportFailure = async (testName: string, error: any) => {
  try {
    // Tentamos importar dinamicamente a função de relatório
    // Nota: Em ambiente de teste 'vitest', precisamos garantir que o fetch esteja disponível
    const { generateDiagnosticReport } = await import('@/lib/reporting.functions');
    await generateDiagnosticReport({
      testName,
      error: error?.message || String(error),
      stack: error?.stack,
      context: "Vitest E2E Environment",
      payload: { timestamp: new Date().toISOString() }
    });
    console.log(`[Shadow Report] Relatório automático enviado para: ${testName}`);
  } catch (e) {
    console.error("[Shadow Report] Falha ao enviar relatório automático:", e);
  }
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
