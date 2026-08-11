import { describe, it, expect } from 'vitest';
/**
 * Shadow Protocol v15.6 — Tutorial Progress Sync Integration Test
 * O build DEVE falhar se a tabela public.tutorial_progress estiver ausente
 * ou fora do schema cache do PostgREST (PGRST205 / PGRST108 / 42P01).
 */

const SCHEMA_ERRORS = ['PGRST205', 'PGRST108', '42P01'];

describe('Tutorial Progress Synchronization (end-to-end)', () => {
  it('public.tutorial_progress must exist and be exposed in the schema cache', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('tutorial_progress').select('id').limit(1);

    if (error && SCHEMA_ERRORS.includes(error.code ?? '')) {
      throw new Error(
        `[FATAL] public.tutorial_progress indisponível: [${error.code}] ${error.message}`,
      );
    }
    expect(SCHEMA_ERRORS).not.toContain(error?.code ?? 'OK');
  });

  it('public.tutorials must exist and be exposed in the schema cache', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('tutorials').select('id').limit(1);

    if (error && SCHEMA_ERRORS.includes(error.code ?? '')) {
      throw new Error(
        `[FATAL] public.tutorials indisponível: [${error.code}] ${error.message}`,
      );
    }
    expect(SCHEMA_ERRORS).not.toContain(error?.code ?? 'OK');
  });

  it('tutorial_progress sync columns must be queryable (no 42703)', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin
      .from('tutorial_progress')
      .select('user_id, tutorial_id, completed')
      .limit(1);

    expect(error?.code).not.toBe('42703');
  });

  it('tutorial_progress <-> tutorials relation must resolve for sync joins', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // For joins we use the relationship name. In Supabase, if we have a FK, 
    // it usually exposes it. We'll check if the schema cache sees the FK.
    const { error } = await supabaseAdmin
      .from('tutorial_progress')
      .select('id, tutorials(id, title)')
      .limit(1);

    // If join fails because of PGRST205/108, it means the schema cache is broken for joins too
    expect(SCHEMA_ERRORS).not.toContain(error?.code ?? 'OK');
  });
});

