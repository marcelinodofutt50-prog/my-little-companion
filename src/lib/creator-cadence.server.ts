// Enforcement de cadência de creator (peça 3).
//
// Regra: creator aprovado precisa de 1 vídeo APROVADO a cada 14 dias, senão
// perde o cargo (supporter_applications -> 'revoked') E a licença concedida como
// creator (banco revoked + remoção no painel yaarsa). Reaproveita o mesmo fluxo
// de corte do expire-licenses (removeAccountAnyPanel / hasOtherActiveLicense).
//
// Segurança:
//  - dryRun=true: NÃO corta nada, só loga quem venceria ('would_lapse'). É o
//    padrão até CREATOR_CADENCE_ENFORCE=on no ambiente.
//  - Só age em creator ainda aprovado. Update condicional evita corrida.
//  - license_id null (creator antigo sem licença ligada) -> tira o cargo e loga
//    'needs_manual_license', sem revogar nada no escuro.
//  - Se as colunas da migration ainda não existem, devolve {skipped:'not_configured'}.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DAY = 86400000;

export async function enforceCreatorCadence(opts: { dryRun: boolean }) {
  const nowIso = () => new Date().toISOString();

  const { data: claims, error } = await supabaseAdmin
    .from("creator_license_claims")
    .select("id, user_id, license_id, cadence_anchor, reviewed_at, status")
    .eq("status", "delivered")
    .is("lapsed_at", null)
    .limit(500);

  // Migration ainda não aplicada (colunas inexistentes) -> não faz nada.
  if (error) {
    if (/column .* does not exist|lapsed_at|cadence_anchor|license_id/i.test(error.message)) {
      return { skipped: "not_configured" as const };
    }
    throw new Error(error.message);
  }

  const rows = (claims ?? []) as Array<{
    id: string; user_id: string; license_id: string | null;
    cadence_anchor: string | null; reviewed_at: string | null; status: string;
  }>;
  if (rows.length === 0) return { checked: 0, warned: 0, lapsed: 0, dryRun: opts.dryRun };

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

  const { data: apps } = await supabaseAdmin
    .from("supporter_applications").select("user_id").eq("status", "approved").in("user_id", userIds);
  const approved = new Set((apps ?? []).map((a: any) => a.user_id));

  const { data: vids } = await supabaseAdmin
    .from("creator_videos").select("user_id, created_at").eq("status", "approved").in("user_id", userIds);
  const lastApproved = new Map<string, number>();
  for (const v of (vids ?? []) as any[]) {
    const t = +new Date(v.created_at);
    if (t > (lastApproved.get(v.user_id) ?? 0)) lastApproved.set(v.user_id, t);
  }

  const { removeAccountAnyPanel, hasOtherActiveLicense } = await import("./license-cron.server");

  const now = Date.now();
  let warned = 0, lapsed = 0;
  const logs: any[] = [];

  for (const c of rows) {
    if (!approved.has(c.user_id)) continue; // já não é creator aprovado
    const anchorBase = c.cadence_anchor ? +new Date(c.cadence_anchor) : (c.reviewed_at ? +new Date(c.reviewed_at) : 0);
    const anchor = Math.max(anchorBase, lastApproved.get(c.user_id) ?? 0);
    if (!anchor) continue; // sem âncora confiável -> não age
    const deadline = anchor + 14 * DAY;

    if (now < deadline) {
      if (now >= deadline - 3 * DAY) {
        warned++;
        if (!opts.dryRun) {
          await supabaseAdmin.from("creator_license_claims")
            .update({ warned_at: nowIso() })
            .eq("id", c.id)
            .or(`warned_at.is.null,warned_at.lt.${new Date(anchor).toISOString()}`);
        }
      }
      continue;
    }

    // VENCIDO
    if (opts.dryRun) {
      lapsed++;
      logs.push({ source: "creator-cadence", action: "would_lapse", outcome: "dry_run",
        context: { user_id: c.user_id, claim_id: c.id, license_id: c.license_id,
          deadline: new Date(deadline).toISOString() } as any });
      continue;
    }

    // Marca lapsado de forma condicional (evita corrida entre rodadas).
    const { data: claimed } = await supabaseAdmin.from("creator_license_claims")
      .update({ status: "lapsed", lapsed_at: nowIso() })
      .eq("id", c.id).eq("status", "delivered").is("lapsed_at", null).select("id");
    if (!claimed?.length) continue;

    // Tira o cargo de creator.
    await supabaseAdmin.from("supporter_applications")
      .update({ status: "revoked", updated_at: nowIso() })
      .eq("user_id", c.user_id).eq("status", "approved");

    // Revoga SÓ a licença ligada (banco + painel).
    let licenseRevoked = false; let panelOutcome: string | null = null;
    if (c.license_id) {
      const { data: licRows } = await supabaseAdmin.from("licenses")
        .select("id, yaarsa_email, panel, revoked")
        .eq("id", c.license_id).limit(1);
      const lic = (licRows ?? [])[0] as any;
      if (lic && !lic.revoked) {
        const { data: upd } = await supabaseAdmin.from("licenses")
          .update({ revoked: true, disabled_at: nowIso() })
          .eq("id", lic.id).eq("revoked", false).select("id");
        licenseRevoked = !!upd?.length;
        if (licenseRevoked && lic.yaarsa_email) {
          if (await hasOtherActiveLicense(supabaseAdmin, lic.yaarsa_email, lic.id)) {
            panelOutcome = "skipped_shared_login";
          } else {
            const res = await removeAccountAnyPanel(lic.yaarsa_email, lic.panel);
            panelOutcome = res.status;
          }
        }
      }
    }

    logs.push({ source: "creator-cadence", action: "lapse", outcome: "success",
      context: { user_id: c.user_id, claim_id: c.id, license_id: c.license_id,
        license_revoked: licenseRevoked, panel: panelOutcome,
        needs_manual_license: !c.license_id,
        deadline: new Date(deadline).toISOString() } as any });
    lapsed++;
  }

  if (logs.length) await supabaseAdmin.from("integration_logs").insert(logs as any);
  return { checked: rows.length, warned, lapsed, dryRun: opts.dryRun };
}
