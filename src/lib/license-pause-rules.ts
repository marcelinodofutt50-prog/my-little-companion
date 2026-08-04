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
export const MIN_PAUSE_MS = 60 * 60 * 1000 // 1 hora
/** Tempo mínimo pausada antes de poder despausar (evita flood no painel). */
export const RESUME_COOLDOWN_MS = 2 * 60 * 1000 // 2 minutos

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
      message: "Resta menos de 1 hora nesta licença; não é possível pausar.",
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
