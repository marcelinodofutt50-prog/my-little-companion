import { DEFAULT_BAN_PRICE_MULTIPLIER, shouldBanGroup } from "./ban-rules";

type Signals = {
  deviceHash?: string | null;
  attrsHash?: string | null;
  ipPrefixHash?: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type ActiveBan = { id: string; reason: string; price_multiplier: number; created_at: string };

export async function getActiveBan(userId: string): Promise<ActiveBan | null> {
  const db = await admin();
  const { data } = await db
    .from("account_bans")
    .select("id, reason, price_multiplier, created_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  return (data as ActiveBan) ?? null;
}

export async function requireNotBanned(userId: string, feature: string): Promise<void> {
  const ban = await getActiveBan(userId);
  if (ban) {
    throw new Error(
      `Sua conta está banida por violar as regras do site (várias contas). ${feature} está bloqueado. Fale com o suporte se achar que é um engano.`,
    );
  }
}

async function isStaff(db: any, userId: string): Promise<boolean> {
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r: any) => ["admin", "moderator", "support"].includes(r.role));
}

async function banUsers(
  db: any,
  userIds: string[],
  reason: string,
  evidence: Record<string, unknown>,
  fingerprints: Array<{ kind: string; value: string }>,
) {
  const groupId = crypto.randomUUID();
  for (const uid of userIds) {
    if (await isStaff(db, uid)) continue;
    const { data: existing } = await db.from("account_bans").select("id, revoked_at").eq("user_id", uid).maybeSingle();
    if (existing && existing.revoked_at) continue; // admin desbaniu manualmente: respeita
    let banId = existing?.id as string | undefined;
    if (!banId) {
      const { data: ins } = await db
        .from("account_bans")
        .insert({ user_id: uid, reason, source: "auto", price_multiplier: DEFAULT_BAN_PRICE_MULTIPLIER, linked_group_id: groupId, evidence })
        .select("id")
        .single();
      banId = ins?.id;
    }
    if (banId && fingerprints.length) {
      await db
        .from("ban_fingerprints")
        .upsert(fingerprints.map((f) => ({ ...f, ban_id: banId })), { onConflict: "kind,value,ban_id", ignoreDuplicates: true });
    }
  }
}

/**
 * Liga a conta às outras da mesma pessoa e aplica o banimento:
 * - herda banimento se aparelho / e-mail canônico / (hardware + rede) já pertence a alguém banido;
 * - bane o grupo inteiro quando chega a 4 contas ligadas.
 * Nunca lança: falha aqui não pode derrubar login/cadastro.
 */
export async function linkAccountsAndEnforce(userId: string, sig: Signals): Promise<{ banned: boolean }> {
  try {
    const db = await admin();
    if (await isStaff(db, userId)) return { banned: false };

    const { data: me } = await db.from("profiles").select("email_canonical").eq("id", userId).maybeSingle();
    const canonical: string | null = me?.email_canonical ?? null;
    const comboKey = sig.attrsHash && sig.ipPrefixHash ? `${sig.attrsHash}:${sig.ipPrefixHash}` : null;

    const fps: Array<{ kind: string; value: string }> = [];
    if (sig.deviceHash) fps.push({ kind: "device", value: sig.deviceHash });
    if (canonical) fps.push({ kind: "email", value: canonical });
    if (comboKey) fps.push({ kind: "attrs_net", value: comboKey });

    // 1) Herança de banimento
    for (const f of fps) {
      const { data: hit } = await db
        .from("ban_fingerprints")
        .select("ban_id, account_bans!inner(revoked_at)")
        .eq("kind", f.kind)
        .eq("value", f.value)
        .is("account_bans.revoked_at", null)
        .limit(1);
      if (hit && hit.length) {
        await banUsers(db, [userId], "Conta nova ligada a uma conta banida", { inherited_from: hit[0].ban_id, match: f.kind }, fps);
        return { banned: true };
      }
    }

    // 2) Monta o grupo de contas ligadas
    const group = new Set<string>([userId]);
    if (sig.deviceHash) {
      const { data } = await db.from("device_identities").select("user_id").eq("device_hash", sig.deviceHash).limit(50);
      (data ?? []).forEach((r: any) => r.user_id && group.add(r.user_id));
    }
    if (sig.attrsHash && sig.ipPrefixHash) {
      const { data } = await db
        .from("device_identities")
        .select("user_id")
        .eq("attrs_hash", sig.attrsHash)
        .eq("ip_prefix_hash", sig.ipPrefixHash)
        .limit(50);
      (data ?? []).forEach((r: any) => r.user_id && group.add(r.user_id));
    }
    if (canonical) {
      const { data } = await db.from("profiles").select("id").eq("email_canonical", canonical).limit(50);
      (data ?? []).forEach((r: any) => r.id && group.add(r.id));
    }

    if (shouldBanGroup(group.size)) {
      await banUsers(
        db,
        [...group],
        `Várias contas da mesma pessoa (${group.size} contas ligadas)`,
        { linked_accounts: [...group], device: sig.deviceHash ?? null, email: canonical },
        fps,
      );
      return { banned: true };
    }
    return { banned: false };
  } catch (e) {
    console.error("[ban-engine] linkAccountsAndEnforce falhou:", e);
    return { banned: false };
  }
}
