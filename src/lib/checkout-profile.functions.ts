import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cadastro rápido do checkout: guardado no próprio pedido (metadata) para
 * acompanhar conversão, origem e indicação, e para o pós-venda.
 * É gravado ANTES de abrir o provedor de pagamento.
 */
export const saveCheckoutProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        fullName: z.string().trim().min(3).max(80),
        contact: z.string().trim().min(5).max(120),
        contactKind: z.enum(["email", "phone"]),
        firstTime: z.enum(["sim", "nao"]),
        referred: z.enum(["sim", "nao"]),
        referrer: z.string().trim().max(60).optional().default(""),
        source: z.string().trim().max(60).optional().default(""),
        lgpdConsent: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { supabase, userId } = context;

    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, metadata")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!order) return { ok: false, error: "Pedido não encontrado." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const metadata = {
      ...(((order as any).metadata ?? {}) as Record<string, unknown>),
      checkout_profile: {
        full_name: data.fullName,
        contact: data.contact,
        contact_kind: data.contactKind,
        first_time: data.firstTime === "sim",
        referred: data.referred === "sim",
        referrer: data.referred === "sim" ? data.referrer : null,
        source: data.source || null,
        lgpd_consent_at: new Date().toISOString(),
      },
    };

    const { error } = await supabaseAdmin.from("orders").update({ metadata } as any).eq("id", data.orderId);
    if (error) return { ok: false, error: error.message };

    // Guarda o nome no perfil quando ainda estiver vazio (não sobrescreve escolha do cliente).
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .eq("id", userId)
        .maybeSingle();
      if (profile && !(profile as any).display_name) {
        await supabaseAdmin.from("profiles").update({ display_name: data.fullName }).eq("id", userId);
      }
    } catch {
      /* opcional: nunca bloqueia o pagamento */
    }

    return { ok: true };
  });
