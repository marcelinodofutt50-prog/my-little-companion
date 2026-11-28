import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Acesso ao painel da Gangstar (/painel). Só quem tem linha em gangstar_access
 * entra. A escrita é feita pelo admin; a leitura, pelo próprio cliente.
 */

/** O cliente logado tem acesso liberado ao painel da Gangstar? */
export const myGangstarAccess = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { data } = await context.supabase
        .from('gangstar_access')
        .select('user_id')
        .eq('user_id', context.userId)
        .maybeSingle();
      return { hasAccess: !!data };
    } catch {
      // Tabela ainda não migrada: sem acesso (não derruba a página).
      return { hasAccess: false };
    }
  });

/** Admin libera ou remove o acesso Gangstar de um cliente. */
export const adminSetGangstarAccess = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ userId: z.string().uuid(), enabled: z.boolean(), note: z.string().trim().max(200).optional() }).parse(v))
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import('@/lib/admin-helpers.server');
    await assertStaff(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const db = supabaseAdmin as any;
    if (data.enabled) {
      const { error } = await db.from('gangstar_access').upsert(
        { user_id: data.userId, granted_by: context.userId, granted_at: new Date().toISOString(), note: data.note ?? null },
        { onConflict: 'user_id' },
      );
      if (error) throw new Error(error.message.includes('gangstar_access') ? 'Rode o SQL db/gangstar_access.sql nos dois bancos primeiro.' : error.message);
    } else {
      const { error } = await db.from('gangstar_access').delete().eq('user_id', data.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true, enabled: data.enabled };
  });

/** Staff consulta se um cliente tem acesso (para a ficha / menu de ações). */
export const adminGetGangstarAccess = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ userId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import('@/lib/admin-helpers.server');
    await assertStaff(context);
    try {
      const { data: row } = await context.supabase.from('gangstar_access').select('user_id').eq('user_id', data.userId).maybeSingle();
      return { hasAccess: !!row };
    } catch {
      return { hasAccess: false };
    }
  });
