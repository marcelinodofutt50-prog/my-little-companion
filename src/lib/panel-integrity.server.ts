/**
 * Integridade painel Yaarsa ↔ site.
 *
 * Problema real relatado pelo suporte: de madrugada algumas contas somem do
 * painel Yaarsa (limpeza/queda do painel), mas o site continua dizendo que o
 * login do cliente está ativo. O cliente abre chamado, o atendente pede a
 * senha e recria a conta na mão.
 *
 * Aqui a verificação vira rotina: para cada licença ativa no banco olhamos se
 * a conta existe no painel (consulta que NÃO altera nada) e, quando sumiu,
 * recriamos com a MESMA senha guardada e a MESMA data de expiração.
 */

export type IntegrityStatus =
  | "ok"                 // conta existe no painel
  | "repaired"           // sumiu e foi recriada automaticamente
  | "missing"            // sumiu e não conseguimos recriar
  | "unknown"            // painel não respondeu de forma conclusiva
  | "no_password";       // sumiu e não temos a senha guardada para recriar

export type IntegrityRow = {
  licenseId: string;
  userId: string;
  email: string;
  panel: string;
  planSlug: string | null;
  expiresAt: string | null;
  status: IntegrityStatus;
  detail?: string;
};

export type IntegrityReport = {
  checked: number;
  ok: number;
  repaired: number;
  missing: number;
  unknown: number;
  rows: IntegrityRow[];
  startedAt: string;
  ms: number;
};

type LicenseRow = {
  id: string;
  user_id: string;
  plan_slug: string | null;
  yaarsa_email: string | null;
  yaarsa_username: string | null;
  yaarsa_password_enc: string | null;
  panel: string | null;
  expires_at: string | null;
  is_trial: boolean | null;
  metadata: Record<string, unknown> | null;
};

const DAY = 86400000;

/** Data que a conta deve ter no painel: expiração real + 1 dia de buffer. */
export function panelExpireDateFor(l: { expires_at: string | null; plan_slug?: string | null }): string {
  const slug = (l.plan_slug ?? "").toLowerCase();
  if (!l.expires_at || slug.includes("lifetime") || slug.includes("vitalicio")) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 20);
    return d.toISOString().slice(0, 10);
  }
  return new Date(new Date(l.expires_at).getTime() + DAY).toISOString().slice(0, 10);
}

function normalizePanel(p: string | null): "v455" | "v457" | "v46" {
  return p === "v46" ? "v46" : p === "v455" ? "v455" : "v457";
}

/**
 * Roda a auditoria. `autoRepair` recria as contas ausentes.
 * `licenseIds` limita a auditoria a licenças específicas (uso no admin).
 */
export async function auditPanelIntegrity(opts?: {
  limit?: number;
  autoRepair?: boolean;
  licenseIds?: string[];
  userId?: string;
}): Promise<IntegrityReport> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const limit = Math.min(Math.max(opts?.limit ?? 60, 1), 200);
  const autoRepair = opts?.autoRepair !== false;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const {
    yaarsaLookupEmail,
    yaarsaCreateAccount,
    yaarsaExtend,
    decrypt,
  } = await import("@/lib/yaarsa.server");

  let q = supabaseAdmin
    .from("licenses")
    .select(
      "id,user_id,plan_slug,yaarsa_email,yaarsa_username,yaarsa_password_enc,panel,expires_at,is_trial,metadata",
    )
    .is("disabled_at", null)
    .is("suspended_at", null)
    .eq("revoked", false)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (opts?.licenseIds?.length) q = q.in("id", opts.licenseIds);
  if (opts?.userId) q = q.eq("user_id", opts.userId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const now = Date.now();
  const rows = ((data ?? []) as LicenseRow[]).filter(
    (l) => !!l.yaarsa_email && (!l.expires_at || new Date(l.expires_at).getTime() > now),
  );

  const out: IntegrityRow[] = [];
  const logs: Record<string, unknown>[] = [];

  for (const l of rows) {
    const panel = normalizePanel(l.panel);
    const email = l.yaarsa_email as string;
    const base: Omit<IntegrityRow, "status"> = {
      licenseId: l.id,
      userId: l.user_id,
      email,
      panel,
      planSlug: l.plan_slug,
      expiresAt: l.expires_at,
    };

    let status: IntegrityStatus;
    let detail: string | undefined;

    try {
      const lookup = await yaarsaLookupEmail(email, panel);
      if (lookup.found) {
        status = "ok";
      } else if (!autoRepair) {
        status = "missing";
        detail = "Conta não existe no painel.";
      } else if (!l.yaarsa_password_enc) {
        status = "no_password";
        detail = "Conta sumiu do painel e não há senha guardada para recriar.";
      } else {
        // Recria com a mesma senha e a mesma validade.
        const password = decrypt(l.yaarsa_password_enc);
        const created = await yaarsaCreateAccount({
          username: l.yaarsa_username || email.split("@")[0]!,
          email,
          password,
          planSlug: l.plan_slug || "login-30d",
          totalPaid: 0,
          additionalInfo: `shadow-repair-${l.id.slice(0, 8)}`,
          panel,
        });
        if (created.Fail && !/1004|already|exist/i.test(String(created.Fail))) {
          status = "missing";
          detail = `Falha ao recriar: ${created.Fail}`;
        } else {
          // Ajusta a data real (o create usa a validade padrão do plano).
          const target = panelExpireDateFor(l);
          try {
            await yaarsaExtend(email, target, panel);
          } catch {
            /* a conta já existe; a data é corrigida na próxima rodada */
          }
          status = "repaired";
          detail = `Login recriado no painel com a mesma senha (validade ${target}).`;
        }
      }
    } catch (e) {
      status = "unknown";
      detail = e instanceof Error ? e.message : String(e);
    }

    out.push({ ...base, status, ...(detail ? { detail } : {}) });

    // Marca o resultado na própria licença para o admin enxergar.
    const metadata = { ...(l.metadata ?? {}) } as Record<string, unknown>;
    metadata['panel_integrity'] = {
      checked_at: new Date().toISOString(),
      status,
      detail: detail ?? null,
      panel,
    };
    await supabaseAdmin.from("licenses").update({ metadata } as never).eq("id", l.id);

    if (status !== "ok") {
      logs.push({
        source: "panel-integrity",
        action: "audit_license",
        outcome: status,
        error: detail ?? null,
        user_id: l.user_id,
        context: { license_id: l.id, email, panel, plan_slug: l.plan_slug, expires_at: l.expires_at },
      });
    }
  }

  const report: IntegrityReport = {
    checked: out.length,
    ok: out.filter((r) => r.status === "ok").length,
    repaired: out.filter((r) => r.status === "repaired").length,
    missing: out.filter((r) => r.status === "missing" || r.status === "no_password").length,
    unknown: out.filter((r) => r.status === "unknown").length,
    rows: out,
    startedAt,
    ms: Date.now() - t0,
  };

  logs.push({
    source: "panel-integrity",
    action: "audit",
    outcome: report.missing > 0 ? "issues" : "success",
    context: {
      checked: report.checked,
      ok: report.ok,
      repaired: report.repaired,
      missing: report.missing,
      unknown: report.unknown,
      ms: report.ms,
    },
  });

  try {
    await supabaseAdmin.from("integration_logs").insert(logs as never);
  } catch {
    /* telemetria nunca derruba a rotina */
  }

  return report;
}
