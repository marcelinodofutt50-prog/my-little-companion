import { createServerFn } from "@tanstack/react-start";

/**
 * Prova social HONESTA para reduzir "medo de golpe": contagens reais do banco,
 * arredondadas PRA BAIXO (nunca infladas). Público, sem PII, tolerante a erro.
 */
export const getTrustStats = createServerFn({ method: "GET" }).handler(async () => {
  const fallback = { entregues: 0, membros: 0, desde: "2026-07" };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [lic, prof] = await Promise.all([
      supabaseAdmin.from("licenses").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    // Arredonda pra baixo: "+900" só aparece quando há de fato >= 900.
    const floorTo = (n: number | null | undefined, step: number) =>
      Math.max(0, Math.floor((n ?? 0) / step) * step);
    return {
      entregues: floorTo(lic.count, 100),
      membros: floorTo(prof.count, 100),
      desde: "2026-07",
    };
  } catch {
    return fallback;
  }
});
