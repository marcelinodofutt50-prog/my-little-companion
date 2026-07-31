/**
 * Regras da onda de migração (somente servidor).
 */
import type { YaarsaPanel } from "@/lib/yaarsa.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type Wave = {
  id: string;
  panel: YaarsaPanel;
  title: string;
  instructions: string;
  server_label: string | null;
  opened_at: string;
  deadline_at: string;
  has_deadline: boolean;
  is_active: boolean;
  is_test: boolean;
  closed_at: string | null;
};

function panelOf(l: any): YaarsaPanel {
  const p = String(l?.panel ?? "").toLowerCase();
  if (p === "v455" || p === "v457" || p === "v46") return p;
  const tier = l?.version_tier;
  return tier === "lifetime_46" ? "v46" : tier === "weekly" ? "v455" : "v457";
}

function isLive(l: any): boolean {
  if (l.revoked || l.disabled_at) return false;
  if (l.expires_at && new Date(l.expires_at).getTime() <= Date.now()) return false;
  return true;
}

/** Ondas ativas e ainda dentro do prazo. */
export async function activeWaves(): Promise<Wave[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("migration_waves")
    .select("*")
    .eq("is_active", true)
    .order("opened_at", { ascending: false });
  if (error) {
    if (/does not exist|42P01/i.test(error.message ?? "")) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as Wave[];
}

/** Licenças do usuário que ainda precisam migrar + as que já migraram. */
export async function listEligibleForUser(wave: Wave, userId: string) {
  const supabase = await db();
  const { data: lics } = await supabase
    .from("licenses")
    .select("*")
    .eq("user_id", userId);

  const candidates = (lics ?? []).filter(
    (l: any) =>
      panelOf(l) === wave.panel &&
      new Date(l.created_at).getTime() < new Date(wave.opened_at).getTime() &&
      isLive(l),
  );

  const { data: claims } = await supabase
    .from("migration_wave_claims")
    .select("old_license_id,new_license_id")
    .eq("wave_id", wave.id)
    .eq("user_id", userId);

  const done = new Set((claims ?? []).map((c: any) => c.old_license_id));
  return {
    pending: candidates.filter((l: any) => !done.has(l.id)),
    claimed: claims ?? [],
  };
}

/** Gera os logins novos do usuário para a onda. Idempotente. */
export async function claimWaveForUser(waveId: string, userId: string) {
  const supabase = await db();
  const {
    yaarsaCreateAccount,
    yaarsaExtend,
    generateCredentials,
    encrypt,
    decrypt,
    withPanelConfig,
    resolvePanelServerHost,

  } = await import("@/lib/yaarsa.server");

  const { data: wave } = await supabase
    .from("migration_waves")
    .select("*")
    .eq("id", waveId)
    .maybeSingle();
  if (!wave || !wave.is_active) throw new Error("Esta migração não está mais aberta.");
  if (wave.has_deadline !== false && new Date(wave.deadline_at).getTime() < Date.now()) {
    throw new Error("O prazo desta migração já encerrou. Fale com o suporte.");
  }

  const { pending, claimed } = await listEligibleForUser(wave as Wave, userId);
  if (pending.length === 0) {
    throw new Error(
      claimed.length > 0
        ? "Você já gerou o login novo desta migração. Atualize a página para ver os dados."
        : "Nenhum login seu é elegível para esta migração (só entram logins ativos do painel, criados antes da onda).",
    );
  }

  const run = async () => {
  const serverIp = await resolvePanelServerHost(wave.panel as YaarsaPanel);
  const created: { username: string; email: string; password: string; server_ip: string }[] = [];

  for (const old of pending.slice(0, 5)) {

    // Trava atômica: a unique (wave_id, old_license_id) impede gerar 2x.
    const { error: claimErr } = await supabase.from("migration_wave_claims").insert({
      wave_id: wave.id,
      user_id: userId,
      old_license_id: old.id,
      status: "pending",
    });
    if (claimErr) {
      if (/duplicate key|unique/i.test(claimErr.message)) continue;
      throw new Error(claimErr.message);
    }

    try {
      const creds = generateCredentials();
      const yr = await yaarsaCreateAccount({
        username: creds.username,
        email: creds.email,
        password: creds.password,
        planSlug: old.plan_slug,
        totalPaid: 0,
        additionalInfo: `shadow-migracao-${wave.id.slice(0, 8)}`,
        panel: wave.panel as YaarsaPanel,
      });
      if (yr.Fail && !/1004|already|exist|existe/i.test(yr.Fail)) {
        throw new Error(`Painel: ${yr.Fail}`);
      }
      if (old.expires_at) {
        await yaarsaExtend(
          creds.email,
          new Date(old.expires_at).toISOString().slice(0, 10),
          wave.panel as YaarsaPanel,
        );
      }

      const { data: lic, error: licErr } = await supabase
        .from("licenses")
        .insert({
          user_id: userId,
          order_id: old.order_id ?? null,
          plan_slug: old.plan_slug,
          yaarsa_username: creds.username,
          yaarsa_email: creds.email,
          yaarsa_password_enc: encrypt(creds.password),
          server_ip: serverIp,
          expires_at: old.expires_at,
          server_paid_until: old.server_paid_until,
          version_tier: old.version_tier,
          panel: wave.panel,
          is_trial: false,
          paid_externally: old.paid_externally ?? false,
          paid_externally_until: old.paid_externally_until ?? null,
          upgraded_from_license_id: old.id,
        })
        .select("*")
        .single();
      if (licErr || !lic) throw new Error(licErr?.message || "Falha ao gravar a licença nova");

      await supabase
        .from("migration_wave_claims")
        .update({ new_license_id: lic.id, status: "migrated" })
        .eq("wave_id", wave.id)
        .eq("old_license_id", old.id);

      created.push({
        username: creds.username,
        email: creds.email,
        password: creds.password,
        server_ip: serverIp,
      });
    } catch (e: any) {
      // Libera a trava para o cliente poder tentar de novo.
      await supabase
        .from("migration_wave_claims")
        .delete()
        .eq("wave_id", wave.id)
        .eq("old_license_id", old.id)
        .is("new_license_id", null);
      throw e;
    }
  }

    if (created.length === 0) throw new Error("Seu login novo já foi gerado. Atualize a página.");
    return { ok: true, credentials: created, deadlineAt: wave.deadline_at as string };
  };

  // VPS própria da onda (servidor beta): usa o endereço/admin key da onda,
  // sem mexer na configuração oficial do painel.
  if (wave.test_base_url && wave.test_admin_key_enc) {
    let adminKey = "";
    try {
      adminKey = decrypt(wave.test_admin_key_enc);
    } catch {
      throw new Error("A admin key da VPS de teste está inválida. Reconfigure a onda no admin.");
    }
    return withPanelConfig(
      wave.panel as YaarsaPanel,
      { baseUrl: String(wave.test_base_url), adminKey },
      run,
    );
  }
  return run();
}


// ------------------------------------------------------------------ admin

export async function listWavesForAdmin() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("migration_waves")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    if (/does not exist|42P01/i.test(error.message ?? "")) return [];
    throw new Error(error.message);
  }
  const waves = (data ?? []) as Wave[];
  const out: any[] = [];
  for (const w of waves) {
    const { count } = await supabase
      .from("migration_wave_claims")
      .select("id", { count: "exact", head: true })
      .eq("wave_id", w.id)
      .eq("status", "migrated");
    const { test_admin_key_enc, ...safe } = w as any;
    out.push({
      ...safe,
      hasTestVps: !!test_admin_key_enc,
      migratedCount: count ?? 0,
      pendingCount: await pendingCount(w),
      votes: w.is_test ? await tallyWaveVotes(w.id) : null,
    });

  }
  return out;
}

async function pendingCount(wave: Wave) {
  const supabase = await db();
  const { data: lics } = await supabase
    .from("licenses")
    .select("id,panel,version_tier,created_at,revoked,disabled_at,expires_at")
    .lt("created_at", wave.opened_at);
  const eligible = (lics ?? []).filter((l: any) => panelOf(l) === wave.panel && isLive(l));
  const { data: claims } = await supabase
    .from("migration_wave_claims")
    .select("old_license_id")
    .eq("wave_id", wave.id);
  const done = new Set((claims ?? []).map((c: any) => c.old_license_id));
  return eligible.filter((l: any) => !done.has(l.id)).length;
}

export async function openWave(input: {
  panel: YaarsaPanel;
  title: string;
  instructions: string;
  serverLabel?: string | null;
  deadlineHours: number;
  isTest?: boolean;
  hasDeadline?: boolean;
  testBaseUrl?: string | null;
  testAdminKey?: string | null;
  actorId: string;
}) {
  const supabase = await db();
  // Só uma onda ativa por painel.
  await supabase
    .from("migration_waves")
    .update({ is_active: false, closed_at: new Date().toISOString() })
    .eq("panel", input.panel)
    .eq("is_test", !!input.isTest)
    .eq("is_active", true);

  let testAdminKeyEnc: string | null = null;
  if (input.testBaseUrl && input.testAdminKey) {
    const { encrypt } = await import("@/lib/yaarsa.server");
    testAdminKeyEnc = encrypt(input.testAdminKey.trim());
  }

  const deadline = new Date(Date.now() + input.deadlineHours * 3600_000).toISOString();
  const { data, error } = await supabase
    .from("migration_waves")
    .insert({
      panel: input.panel,
      title: input.title,
      instructions: input.instructions,
      server_label: input.serverLabel ?? null,
      deadline_at: deadline,
      created_by: input.actorId,
      is_test: !!input.isTest,
      has_deadline: input.hasDeadline !== false,
      test_base_url: testAdminKeyEnc ? input.testBaseUrl!.trim() : null,
      test_admin_key_enc: testAdminKeyEnc,
      is_active: true,
    })

    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Wave;
}

/** Fecha a onda; opcionalmente revoga os logins antigos que sobraram. */
export async function closeWave(waveId: string, revokeOld: boolean) {
  const supabase = await db();
  const { data: wave } = await supabase
    .from("migration_waves")
    .select("*")
    .eq("id", waveId)
    .maybeSingle();
  if (!wave) throw new Error("Onda não encontrada");

  let revoked = 0;
  // Onda de teste nunca revoga nada — é opcional para o cliente.
  if (revokeOld && !wave.is_test) revoked = await revokeOldLicenses(wave as Wave);

  await supabase
    .from("migration_waves")
    .update({ is_active: false, closed_at: new Date().toISOString() })
    .eq("id", waveId);
  return { ok: true, revoked };
}

/** Revoga (e remove no painel) os logins criados antes da onda. */
export async function revokeOldLicenses(wave: Wave) {
  const supabase = await db();
  const { yaarsaRemoveAccount } = await import("@/lib/yaarsa.server");
  const { data: lics } = await supabase
    .from("licenses")
    .select("*")
    .lt("created_at", wave.opened_at)
    .eq("revoked", false);

  const targets = (lics ?? []).filter((l: any) => panelOf(l) === wave.panel && isLive(l));
  let n = 0;
  for (const l of targets) {
    try {
      await yaarsaRemoveAccount(l.yaarsa_email, wave.panel);
    } catch {
      // best-effort: o importante é revogar no nosso banco
    }
    await supabase
      .from("licenses")
      .update({ revoked: true, disabled_at: new Date().toISOString() })
      .eq("id", l.id);
    await supabase
      .from("migration_wave_claims")
      .update({ old_revoked_at: new Date().toISOString() })
      .eq("wave_id", wave.id)
      .eq("old_license_id", l.id);
    n++;
  }
  await supabase.from("integration_logs").insert({
    source: `yaarsa-${wave.panel}`,
    action: "migration_wave_revoke",
    outcome: "success",
    context: { wave_id: wave.id, revoked: n } as any,
  } as any);
  return n;
}

/** Rotina do cron: fecha as ondas vencidas revogando o que ficou para trás. */
export async function enforceExpiredWaves() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("migration_waves")
    .select("*")
    .eq("is_active", true)
    .eq("has_deadline", true)
    .lt("deadline_at", new Date().toISOString());
  if (error) {
    if (/does not exist|42P01/i.test(error.message ?? "")) return { waves: 0, revoked: 0 };
    throw new Error(error.message);
  }
  let revoked = 0;
  for (const w of (data ?? []) as Wave[]) {
    // Ondas de teste apenas encerram: nada é revogado.
    if (!w.is_test) revoked += await revokeOldLicenses(w);
    await supabase
      .from("migration_waves")
      .update({ is_active: false, closed_at: new Date().toISOString() })
      .eq("id", w.id);
  }
  return { waves: (data ?? []).length, revoked };
}

// ------------------------------------------------------------------ votação

export type VoteTally = { approve: number; reject: number; total: number; approvePct: number };

/** Apuração dos votos de uma onda de teste. */
export async function tallyWaveVotes(waveId: string): Promise<VoteTally> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("migration_wave_votes")
    .select("approve")
    .eq("wave_id", waveId);
  if (error) {
    if (/does not exist|42P01/i.test(error.message ?? "")) {
      return { approve: 0, reject: 0, total: 0, approvePct: 0 };
    }
    throw new Error(error.message);
  }
  const rows = data ?? [];
  const approve = rows.filter((r: any) => r.approve).length;
  const total = rows.length;
  return {
    approve,
    reject: total - approve,
    total,
    approvePct: total === 0 ? 0 : Math.round((approve / total) * 100),
  };
}

/** Estado da votação para o cliente: só pode votar quem criou o login de teste. */
export async function getVoteStateForUser(waveId: string, userId: string) {
  const supabase = await db();
  const { data: claims } = await supabase
    .from("migration_wave_claims")
    .select("id")
    .eq("wave_id", waveId)
    .eq("user_id", userId)
    .limit(1);
  const { data: mine } = await supabase
    .from("migration_wave_votes")
    .select("approve,comment")
    .eq("wave_id", waveId)
    .eq("user_id", userId)
    .maybeSingle();
  return {
    canVote: (claims ?? []).length > 0,
    myVote: mine ? { approve: !!mine.approve, comment: (mine.comment ?? "") as string } : null,
    tally: await tallyWaveVotes(waveId),
  };
}

/** Registra (ou troca) o voto do cliente sobre o servidor de teste. */
export async function castWaveVote(
  waveId: string,
  userId: string,
  approve: boolean,
  comment: string,
) {
  const supabase = await db();
  const { data: wave } = await supabase
    .from("migration_waves")
    .select("id,is_test,is_active")
    .eq("id", waveId)
    .maybeSingle();
  if (!wave) throw new Error("Onda não encontrada.");
  if (!wave.is_test) throw new Error("Esta onda não é um teste — não há votação.");
  if (!wave.is_active) throw new Error("A votação deste teste já foi encerrada.");

  const { data: claims } = await supabase
    .from("migration_wave_claims")
    .select("id")
    .eq("wave_id", waveId)
    .eq("user_id", userId)
    .limit(1);
  if ((claims ?? []).length === 0) {
    throw new Error("Crie e teste o login do servidor novo antes de votar.");
  }

  const { error } = await supabase
    .from("migration_wave_votes")
    .upsert(
      { wave_id: waveId, user_id: userId, approve, comment: comment || null, updated_at: new Date().toISOString() },
      { onConflict: "wave_id,user_id" },
    );
  if (error) throw new Error(error.message);
  return { ok: true, tally: await tallyWaveVotes(waveId) };
}

/** Lista os votos com comentário para o admin ler o feedback. */
export async function listWaveVotesForAdmin(waveId: string) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("migration_wave_votes")
    .select("approve,comment,updated_at")
    .eq("wave_id", waveId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    if (/does not exist|42P01/i.test(error.message ?? "")) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}
