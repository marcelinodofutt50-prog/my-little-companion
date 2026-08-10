/**
 * Ondas de migração de servidor.
 *
 * Quando o dono troca a VPS de um painel (ex.: 4.6), quem já tem login criado
 * continua apontando para o servidor antigo. O admin publica uma "onda de
 * migração": o cliente elegível vê um aviso no painel, lê o checklist e clica
 * para gerar o login novo. Depois do prazo (padrão 48h) um cron revoga os
 * logins antigos daquele painel.
 *
 * Segurança: elegibilidade, prazo e revogação são decididos NO SERVIDOR.
 * A geração é idempotente — a trava é a unique (wave_id, old_license_id).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const panelEnum = z.enum(["v455", "v457", "v46"]);

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { assertAdminRole } = await import("@/lib/roles.server");
  await assertAdminRole(ctx);
}

// ---------------------------------------------------------------- cliente

/** Onda ativa que se aplica a este usuário + licenças que ele precisa migrar. */
export const getMyMigrationWave = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listEligibleForUser, activeWaves } = await import("@/lib/migration-wave.server");
    const waves = await activeWaves();
    for (const wave of waves) {
      const { pending, claimed } = await listEligibleForUser(wave, context.userId);
      if (pending.length === 0 && claimed.length === 0) continue;
      const isTest = !!(wave as any).is_test;
      const hasDeadline = (wave as any).has_deadline !== false;
      const expired = hasDeadline && new Date(wave.deadline_at).getTime() <= Date.now();
      const status: "pending" | "expired" | "migrated" =
        pending.length === 0 ? "migrated" : expired ? "expired" : "pending";
      return {
        status,
        canClaim: status === "pending",
        wave: {
          id: wave.id,
          isTest,
          hasDeadline,
          panel: wave.panel,
          title: wave.title,
          instructions: wave.instructions,
          serverLabel: wave.server_label as string | null,
          openedAt: wave.opened_at as string,
          deadlineAt: hasDeadline ? (wave.deadline_at as string) : null,
        },
        pending: pending.map((l: any) => ({
          id: l.id,
          plan_slug: l.plan_slug,
          yaarsa_username: l.yaarsa_username,
          expires_at: l.expires_at,
        })),
        alreadyMigrated: claimed.length > 0,
      };
    }
    return null;

  });

/** Gera o(s) login(s) novo(s) no servidor atual do painel da onda. */
export const claimMigrationWave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ waveId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { claimWaveForUser } = await import("@/lib/migration-wave.server");
    return claimWaveForUser(data.waveId, context.userId);
  });

// ------------------------------------------------------------------ admin

export const adminListMigrationWaves = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { listWavesForAdmin } = await import("@/lib/migration-wave.server");
    return listWavesForAdmin();
  });

export const adminOpenMigrationWave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        panel: panelEnum,
        title: z.string().trim().min(4).max(120),
        instructions: z.string().trim().max(4000).default(""),
        serverLabel: z.string().trim().max(120).optional().nullable(),
        deadlineHours: z.coerce.number().int().min(2).max(240).default(48),
        isTest: z.boolean().default(false),
        hasDeadline: z.boolean().default(true),
        testBaseUrl: z.string().trim().max(300).optional().nullable(),
        testAdminKey: z.string().trim().max(300).optional().nullable(),

      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { openWave } = await import("@/lib/migration-wave.server");
    return openWave({ ...data, actorId: context.userId });
  });

export const adminCloseMigrationWave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ waveId: z.string().uuid(), revokeOld: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { closeWave } = await import("@/lib/migration-wave.server");
    return closeWave(data.waveId, data.revokeOld);
  });

// --------------------------------------------------------------- votação

/** Estado da votação do servidor de teste para o cliente logado. */
export const getMigrationWaveVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ waveId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { getVoteStateForUser } = await import("@/lib/migration-wave.server");
    return getVoteStateForUser(data.waveId, context.userId);
  });

/** Voto do cliente: o servidor de teste deve virar oficial? */
export const voteMigrationWave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        waveId: z.string().uuid(),
        approve: z.boolean(),
        comment: z.string().trim().max(500).default(""),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { castWaveVote } = await import("@/lib/migration-wave.server");
    return castWaveVote(data.waveId, context.userId, data.approve, data.comment);
  });

/** Feedback completo da votação (admin). */
export const adminListMigrationWaveVotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ waveId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { listWaveVotesForAdmin } = await import("@/lib/migration-wave.server");
    return listWaveVotesForAdmin(data.waveId);
  });
