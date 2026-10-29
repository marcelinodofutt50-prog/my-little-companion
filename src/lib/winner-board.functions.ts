import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-helpers.server";
import { winnerNickname, publicWinnerRows } from "./winner-board";

const COLUMNS = "id, giveaway_title, nickname, prize_label, awarded_on, created_at";
const MAX_ROWS = 100;

type Row = { id: string; giveaway_title: string; nickname: string; prize_label: string; awarded_on: string; created_at: string };

/** Leitura pública: só apelido, nome do sorteio, prêmio e data. */
export const listPublicWinners = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const db = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await db
    .from("giveaway_winner_board" as any)
    .select(COLUMNS)
    .order("awarded_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (error) return { winners: [] as Row[], error: "Não foi possível carregar os vencedores agora." };
  const rows = (data ?? []) as unknown as Row[];
  const safe = new Set(publicWinnerRows(rows).map((r) => r.nickname));
  return { winners: rows.filter((r) => safe.has(r.nickname)), error: null as string | null };
});

/** Admin: lista os registros (RLS como o próprio usuário). */
export const adminListWinners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase as any)
      .from("giveaway_winner_board")
      .select(COLUMNS)
      .order("awarded_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    if (error) throw new Error("Não foi possível carregar os vencedores.");
    return (data ?? []) as Row[];
  });

export const adminAddWinner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      nickname: winnerNickname,
      giveaway_title: z.string().trim().min(3).max(100),
      prize_label: z.string().trim().min(2).max(120),
      awarded_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("giveaway_winner_board")
      .insert({ ...data, created_by: context.userId });
    if (error) throw new Error("Não foi possível registrar o vencedor.");
    return { ok: true };
  });

export const adminRemoveWinner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("giveaway_winner_board").delete().eq("id", data.id).select("id");
    if (error) throw new Error("Não foi possível remover o registro.");
    if (!rows?.length) throw new Error("Registro não encontrado. Atualize a lista.");
    return { ok: true };
  });
