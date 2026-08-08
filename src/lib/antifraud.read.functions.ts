import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SignupIpReport, SignupIpRow } from "@/lib/antifraud-read.server";

export type { SignupIpReport, SignupIpRow };

/** Lista os cadastros registrados pelo antifraude (somente admin). */
export const getSignupIpReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        days: z.number().int().min(1).max(90).default(7),
        minAccounts: z.number().int().min(1).max(50).default(1),
        onlySuspicious: z.boolean().default(false),
        search: z.string().max(120).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<SignupIpReport> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { loadSignupIpReport } = await import("@/lib/antifraud-read.server");
    return loadSignupIpReport(data);
  });
