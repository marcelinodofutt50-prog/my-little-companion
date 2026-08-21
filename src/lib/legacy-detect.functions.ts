import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Detects whether the currently authenticated user's email exists on the
// legacy Yaarsa panels (v4.5.7 and/or v4.6) and stores the result on the
// user's profile so the dashboard can offer the R$600 upgrade automatically.
//
// Result is cached in `profiles.legacy_status` (`unchecked | none | v457 | v46 | both`)
// and re-validated at most every 7 days.
export const detectLegacyForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims?.email as string | undefined)?.toLowerCase();
    if (!email) return { status: "unchecked", panels: [] as string[], cached: false, inconclusive: true };

    const { data: profile } = await supabase
      .from("profiles")
      .select("legacy_status, legacy_checked_at")
      .eq("id", userId)
      .maybeSingle();

    // Tudo que foi detectado antes desta data usou a lógica antiga (que marcava
    // qualquer falha do painel como "cliente antigo") — força uma re-checagem.
    const LOGIC_FIX_AT = Date.parse("2026-07-30T00:00:00Z");

    const cachedFresh =
      profile?.legacy_checked_at &&
      profile.legacy_status &&
      profile.legacy_status !== "unchecked" &&
      new Date(profile.legacy_checked_at).getTime() > LOGIC_FIX_AT &&
      Date.now() - new Date(profile.legacy_checked_at).getTime() < 7 * 24 * 60 * 60 * 1000;


    if (cachedFresh) {
      return {
        status: profile.legacy_status as string,
        panels: (profile.legacy_status === "both"
          ? ["v457", "v46"]
          : profile.legacy_status === "none"
            ? []
            : [profile.legacy_status]) as string[],
        cached: true,
        inconclusive: false,

      };
    }

    const { yaarsaLookupEmailAllPanels } = await import("./yaarsa.server");
    const result = await yaarsaLookupEmailAllPanels(email);

    // Painel indisponível / resposta ambígua: não gravamos nada e devolvemos
    // "unchecked" para o dashboard NÃO exibir o aviso de cliente antigo.
    if (!result.conclusive) {
      return { status: "unchecked", panels: [] as string[], cached: false, inconclusive: true };
    }

    const hitPanels = result.details.filter((d) => d.found).map((d) => d.panel);
    const status =
      hitPanels.length === 0
        ? "none"
        : hitPanels.length === 2
          ? "both"
          : hitPanels[0];

    // legacy_status é uma coluna protegida (o cliente não pode alterá-la
    // diretamente), então a gravação é feita pelo client administrativo.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({
        legacy_status: status,
        legacy_panel_hits: { email, details: result.details, checked_at: new Date().toISOString() } as any,
        legacy_checked_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return { status, panels: hitPanels, cached: false, inconclusive: false };

  });

// Cheap read of the cached legacy state — used by the dashboard on every load
// to decide whether to render the upgrade banner without re-hitting the panels.
export const getMyLegacyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("legacy_status, legacy_checked_at")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      status: (data?.legacy_status as string) ?? "unchecked",
      checkedAt: data?.legacy_checked_at ?? null,
    };
  });
