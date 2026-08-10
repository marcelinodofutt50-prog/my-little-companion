import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Libera manualmente uma conexão bloqueada pelo antifraude (somente admin). */
export const allowSignupConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        ipHash: z.string().min(16).max(128),
        reason: z.string().max(200).optional(),
        hours: z.number().int().min(1).max(720).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { allowConnection } = await import("@/lib/antifraud-allow.server");
    return allowConnection({
      ipHash: data.ipHash,
      reason: data.reason ?? null,
      adminId: context.userId,
      adminEmail: (context.claims as { email?: string } | null)?.email ?? null,
      hours: data.hours ?? null,
    });
  });

/** Remove a liberação manual de uma conexão (somente admin). */
export const revokeSignupConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ ipHash: z.string().min(16).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { revokeConnection } = await import("@/lib/antifraud-allow.server");
    return revokeConnection(data.ipHash);
  });
