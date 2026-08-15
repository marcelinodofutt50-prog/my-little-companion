import { createServerFn } from "@tanstack/react-start";

/**
 * Contagem agregada de vendas pagas para o selo de prova social da home.
 *
 * Público de propósito: devolve APENAS um número agregado, nunca linhas de
 * pedidos. Antes essa contagem era feita no browser com a chave anônima, o que
 * gerava um erro de rede em toda visita (RLS bloqueia `orders` para anon).
 */
export const getPaidOrdersCount = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "paid");
    if (error) return { count: null as number | null };
    return { count: typeof count === "number" ? count : null };
  } catch {
    return { count: null as number | null };
  }
});
