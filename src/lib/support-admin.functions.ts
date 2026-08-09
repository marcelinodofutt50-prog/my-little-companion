import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/admin-helpers.server";
import { SUPPORT_CATEGORIES } from "./support-categories";

export const adminSetThreadPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    threadId: z.string().uuid(),
    priority: z.enum(["normal", "alta", "critica"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_threads")
      .update({ priority: data.priority })
      .eq("id", data.threadId);
    if (error) throw error;
    return { ok: true };
  });

export const adminUpdateThreadCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    threadId: z.string().uuid(),
    category: z.enum(SUPPORT_CATEGORIES as any),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_threads")
      .update({ category: data.category })
      .eq("id", data.threadId);
    if (error) throw error;
    return { ok: true };
  });
