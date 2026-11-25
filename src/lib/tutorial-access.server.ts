/**
 * Gating do Centro de Treinamento por plano. Server-only.
 *
 * Regra: tutorial.allowed_plans NULL/vazio = público. Caso contrário, só é
 * visível para usuários com LICENÇA ATIVA cujo plan_slug esteja na lista
 * (staff/admin vê tudo). A checagem roda no servidor (service role), porque as
 * listagens de tutoriais já usam supabaseAdmin e ignoram RLS.
 *
 * Backward-compatible: se a coluna allowed_plans ainda não existir no banco,
 * row.allowed_plans vem undefined => tratado como público, nada muda.
 */

export function tutorialAllowedPlans(row: any): string[] {
  const ap = row?.allowed_plans;
  return Array.isArray(ap) ? ap.map((s: any) => String(s ?? "").trim()).filter(Boolean) : [];
}

export function isTutorialPublic(row: any): boolean {
  return tutorialAllowedPlans(row).length === 0;
}

/** Listagens públicas/anônimas: remove qualquer tutorial restrito. */
export function filterPublicTutorials<T>(rows: T[]): T[] {
  return (rows || []).filter((r) => isTutorialPublic(r));
}

/**
 * Conjunto de plan_slug (lowercase) de licenças ATIVAS do usuário.
 * Ativa = não revogada e (sem expires_at [vitalícia] OU expires_at no futuro).
 * Em erro, devolve conjunto vazio (fail-closed: restritos ficam escondidos).
 */
async function activePlanSlugs(userId: string): Promise<Set<string>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("licenses")
      .select("plan_slug, expires_at, revoked, suspended_at")
      .eq("user_id", userId);
    const now = Date.now();
    return new Set(
      (data ?? [])
        // Ativa = não revogada, não pausada e não vencida (mesma semântica do resto do app).
        .filter((l: any) => !l.revoked && !l.suspended_at && (!l.expires_at || new Date(l.expires_at).getTime() > now))
        .map((l: any) => String(l.plan_slug ?? "").toLowerCase())
        .filter(Boolean),
    );
  } catch {
    return new Set<string>();
  }
}

/**
 * Viewer autenticado: staff vê tudo; demais veem públicos + os restritos que o
 * plano ativo liberar. Faz no máximo 2 queries extras, e só quando há tutorial
 * restrito na lista (lista 100% pública passa direto, sem custo).
 */
export async function gateTutorialsForUser<T extends Record<string, any>>(
  rows: T[],
  ctx: { supabase: any; userId: string },
): Promise<T[]> {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];
  if (rows.every((r) => isTutorialPublic(r))) return rows;

  try {
    const { resolveRoles } = await import("@/lib/roles.server");
    const { isStaff } = await resolveRoles(ctx);
    if (isStaff) return rows;
  } catch {
    // trata como não-staff
  }

  const mine = await activePlanSlugs(ctx.userId);
  return rows.filter((r) => {
    const ap = tutorialAllowedPlans(r).map((s) => s.toLowerCase());
    if (ap.length === 0) return true;
    return ap.some((s) => mine.has(s));
  });
}

/**
 * Resolve o usuário atual pelo Bearer token do request, SEM lançar (anônimo => null).
 * Usado em endpoints públicos que precisam de uma checagem opcional de direito.
 */
export async function optionalUserId(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req: any = getRequest();
    const auth: string = req?.headers?.get?.("authorization") || "";
    if (!auth.startsWith("Bearer ")) return null;
    const token = auth.slice(7);
    if (token.split(".").length !== 3) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.getClaims(token);
    const sub = (data as any)?.claims?.sub;
    return typeof sub === "string" && sub ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Pode acessar a MÍDIA deste tutorial? Público => sempre. Restrito => só usuário
 * com licença ativa de um dos planos liberados. Fecha o furo de assinar mídia
 * restrita por quem adivinha o caminho.
 */
export async function canAccessTutorial(row: any, userId: string | null): Promise<boolean> {
  if (isTutorialPublic(row)) return true;
  if (!userId) return false;
  const mine = await activePlanSlugs(userId);
  const ap = tutorialAllowedPlans(row).map((s) => s.toLowerCase());
  return ap.some((s) => mine.has(s));
}
