import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FeedbackItem = {
  id: string;
  category: string;
  message: string;
  rating: number | null;
  is_anonymous: boolean;
  status: string;
  admin_note: string | null;
  created_at: string;
};

export const CATEGORIES = ["melhoria", "critica", "bug", "elogio"] as const;

/** Envia sugestão/crítica. Se anônimo, o vínculo com o usuário não é gravado. */
export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        category: z.enum(CATEGORIES),
        message: z.string().trim().min(10, "Escreva pelo menos 10 caracteres.").max(1500),
        rating: z.number().int().min(1).max(5).optional(),
        anonymous: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_feedback").insert({
      user_id: data.anonymous ? null : context.userId,
      category: data.category,
      message: data.message,
      rating: data.rating ?? null,
      is_anonymous: data.anonymous,
    } as any);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

/** Histórico do próprio usuário (só aparece o que ele enviou identificado). */
export const listMyFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedbackItem[]> => {
    const { data } = await context.supabase
      .from("product_feedback")
      .select("id, category, message, rating, is_anonymous, status, admin_note, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as FeedbackItem[];
  });
