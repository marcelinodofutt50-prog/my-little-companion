/**
 * Regras compartilhadas (cliente + servidor) para pausar/despausar uma licença.
 * O servidor é a fonte da verdade — o dashboard usa as mesmas funções apenas
 * para desabilitar botões e mostrar o motivo antes de tentar.
 */

export type PauseRuleCode =
  | "ok"
  | "not_found"
  | "disabled"
  | "revoked"
  | "already_paused"
  | "not_paused"
  | "expired"
  | "trial"
  | "no_expiry"
  | "too_short"
  | "cooldown"
  | "expired_at_pause"
  | "panel_error"

export type PauseRuleResult = { ok: boolean; code: PauseRuleCode; message: string }

export type PauseLicenseLike = {
  id?: string
  disabled_at?: string | null
  revoked?: boolean | null
  suspended_at?: string | null
  is_trial?: boolean | null
  expires_at?: string | null
  expires_at_before_suspend?: string | null
}

/** Tempo mínimo restante para valer a pena pausar. */
export const MIN_PAUSE_MS = 10 * 1000 // Reduzido para 10s para testes e UX imediata
/** Tempo mínimo pausada antes de poder despausar (evita flood no painel). */
export const RESUME_COOLDOWN_MS = 0 // Removido cooldown para permitir uso tático rápido

const ok: PauseRuleResult = { ok: true, code: "ok", message: "" }

export function canPauseLicense(lic: PauseLicenseLike | null | undefined, now = Date.now()): PauseRuleResult {
  if (!lic) return { ok: false, code: "not_found", message: "Licença não encontrada." }
  if (lic.disabled_at)
    return { ok: false, code: "disabled", message: "Esta licença foi desativada e não pode ser pausada." }
  if (lic.revoked)
    return { ok: false, code: "revoked", message: "Licença revogada. Regularize o servidor antes de pausar." }
  if (lic.suspended_at)
    return { ok: false, code: "already_paused", message: "Esta licença já está pausada." }
  if (lic.is_trial)
    return {
      ok: false,
      code: "trial",
      message: "Trials de 24h não podem ser pausados — o tempo corre até o fim.",
    }
  
  // Se a licença já expirou no banco, não faz sentido pausar (não há tempo a congelar)
  // Permitimos um buffer de 12h para cobrir discrepâncias de timezone entre banco e relógio local.
  if (lic.expires_at && new Date(lic.expires_at).getTime() < now - (12 * 60 * 60 * 1000)) {
    return { ok: false, code: "expired", message: "Licença já expirada — renove antes de pausar." }
  }

  // Licença vitalícia (sem expires_at) pode pausar: nada a congelar, apenas
  // bloqueia o login no painel.
  if (!lic.expires_at) return ok

  const left = new Date(lic.expires_at).getTime() - now
  if (left < MIN_PAUSE_MS)
    return {
      ok: false,
      code: "too_short",
      message: "Resta menos de 1 minuto nesta licença; não é possível pausar.",
    }
  return ok
}

export function canResumeLicense(lic: PauseLicenseLike | null | undefined, now = Date.now()): PauseRuleResult {
  if (!lic) return { ok: false, code: "not_found", message: "Licença não encontrada." }
  if (lic.disabled_at)
    return { ok: false, code: "disabled", message: "Licença desativada não pode ser despausada." }
  if (lic.revoked)
    return { ok: false, code: "revoked", message: "Licença revogada. Fale com o suporte para reativar." }
  if (!lic.suspended_at)
    return { ok: false, code: "not_paused", message: "Esta licença não está pausada." }

  const pausedAt = new Date(lic.suspended_at).getTime()
  if (now - pausedAt < RESUME_COOLDOWN_MS)
    return {
      ok: false,
      code: "cooldown",
      message: "Aguarde alguns instantes após pausar para despausar novamente.",
    }

  const baseline = lic.expires_at_before_suspend ?? lic.expires_at
  if (!baseline) return ok // vitalícia: nada de dias para restaurar
  if (new Date(baseline).getTime() - pausedAt <= 0)
    return {
      ok: false,
      code: "expired_at_pause",
      message: "A licença já estava expirada quando foi pausada — renove o plano.",
    }
  return ok
}

// ───────────────────────── Pausa com data de retorno ─────────────────────────

/** Duração máxima de uma pausa. */
export const MAX_PAUSE_DAYS = 30
const DAY_MS = 86_400_000

/** Dia AAAA-MM-DD no fuso de Brasília. */
export function spYmd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/** Meia-noite (Brasília) do dia informado. */
export function spMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00-03:00`)
}

/** Primeiro e último dia que o cliente pode escolher para o login voltar. */
export function pauseWindow(now = new Date()): { min: string; max: string } {
  const today = spMidnight(spYmd(now)).getTime()
  return {
    min: spYmd(new Date(today + DAY_MS + 3 * 3600_000)),
    max: spYmd(new Date(today + MAX_PAUSE_DAYS * DAY_MS + 3 * 3600_000)),
  }
}

/** Valida o dia de retorno escolhido (amanhã até hoje + 30 dias). */
export function validateResumeDay(ymd: string, now = new Date()): PauseRuleResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return { ok: false, code: 'too_short', message: 'Escolha a data de retorno no calendário.' }
  const { min, max } = pauseWindow(now)
  if (ymd < min) return { ok: false, code: 'too_short', message: 'A pausa precisa durar pelo menos 1 dia.' }
  if (ymd > max) return { ok: false, code: 'too_short', message: `A pausa pode durar no máximo ${MAX_PAUSE_DAYS} dias.` }
  return ok
}

/** Cliente só pausa 1 vez por mês (mês de Brasília). Equipe não tem limite. */
export function pausedThisMonth(lastPauseStartedAt: string | null | undefined, now = new Date()): boolean {
  if (!lastPauseStartedAt) return false
  return spYmd(new Date(lastPauseStartedAt)).slice(0, 7) === spYmd(now).slice(0, 7)
}

export type ResumeInput = {
  suspended_at: string
  expires_at?: string | null
  expires_at_before_suspend?: string | null
  server_paid_until?: string | null
  server_paid_until_before_suspend?: string | null
  plan_slug?: string | null
}

export type ResumePlan = {
  pausedMs: number
  newExpiresAt: string | null
  newServerPaidUntil: string | null
  panelYmd: string
}

/**
 * Calcula o retorno da pausa:
 * - dias da licença: devolve exatamente o que faltava no momento da pausa;
 * - taxa do servidor: o vencimento anda para frente o mesmo tempo que ficou
 *   pausado (pausou dia 16 faltando 4 dias p/ o dia 20, voltou dia 3 →
 *   vence dia 7);
 * - painel: menor data entre licença e servidor (vitalício no dia exato,
 *   mensal/semanal +1 dia de folga, igual à renovação).
 */
export function planResume(lic: ResumeInput, now = new Date()): ResumePlan {
  const pausedAt = new Date(lic.suspended_at).getTime()
  const pausedMs = Math.max(0, now.getTime() - pausedAt)
  const baseline = lic.expires_at_before_suspend ?? lic.expires_at ?? null
  const newExpires = baseline
    ? new Date(now.getTime() + Math.max(0, new Date(baseline).getTime() - pausedAt))
    : null
  const serverBase = lic.server_paid_until_before_suspend ?? lic.server_paid_until ?? null
  const newServer = serverBase ? new Date(new Date(serverBase).getTime() + pausedMs) : null

  const candidates = [newExpires, newServer].filter(Boolean) as Date[]
  const slug = String(lic.plan_slug ?? '').toLowerCase()
  const lifetime = !baseline || slug.includes('lifetime') || slug.includes('vitalicio')
  let panelYmd = '2099-12-31'
  if (candidates.length) {
    const panelDate = new Date(Math.min(...candidates.map((d) => d.getTime())))
    panelYmd = lifetime ? spYmd(panelDate) : spYmd(new Date(panelDate.getTime() + DAY_MS))
  }
  return {
    pausedMs,
    newExpiresAt: newExpires?.toISOString() ?? null,
    newServerPaidUntil: newServer?.toISOString() ?? null,
    panelYmd,
  }
}
