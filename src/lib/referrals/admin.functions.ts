import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-helpers.server";

export const adminUpdateReferralStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      referralId: z.string().uuid(),
      status: z.enum(["pending", "granted", "paid", "rejected"]),
      notes: z.string().trim().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("referrals")
      .update({
        reward_status: data.status,
        notes: data.notes || null,
        paid_at: data.status === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", data.referralId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
