import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, Clock } from 'lucide-react'
import { licenseExpiryState, remainingUntil, severityColor, type ExpirySeverity } from '@/lib/expiry'
import { planLabel } from '@/lib/license-display'

type Props = {
  licenses: any[] | undefined
  serverNow: number
}

type Alert = {
  key: string
  label: string
  targetAt: string
  ms: number
  sev: Exclude<ExpirySeverity, null>
  trial: boolean
  isServerFee: boolean
}

const DAY = 86400000

/**
 * Aviso fixo no dashboard quando alguma licença (ou a mensalidade do servidor)
 * está prestes a vencer. Abaixo de 24h vira contagem regressiva ao vivo.
 */
export function ExpiryAlertBanner({ licenses, serverNow: baseNow }: Props) {
  // Tick local de 1s para o contador ficar vivo abaixo de 24h, ancorado no
  // relógio do servidor (que re-sincroniza sozinho).
  const [drift, setDrift] = useState(0)
  useEffect(() => {
    setDrift(0)
    const anchor = Date.now()
    const id = setInterval(() => setDrift(Date.now() - anchor), 1000)
    return () => clearInterval(id)
  }, [baseNow])
  const serverNow = baseNow + drift

  const alerts: Alert[] = []

  for (const l of licenses ?? []) {
    const st = licenseExpiryState(l, serverNow)
    if (!st.active) continue
    if (st.paused) continue // licença pausada não deve gerar alerta de expiração


    if (st.countdownAt) {
      const ms = new Date(st.countdownAt).getTime() - serverNow
      if (ms <= 5 * DAY) {
        alerts.push({
          key: `${l.id ?? l.plan_slug}-lic`,
          label: `${st.kind === 'trial' ? 'Teste grátis' : 'Licença'} ${planLabel(l.plan_slug) ?? ''}`.trim(),
          targetAt: st.countdownAt,
          ms,
          sev: ms <= 2 * DAY ? 'critical' : 'warning',
          trial: st.kind === 'trial',
          isServerFee: false,
        })
      }
    } else if (st.serverDueAt && st.serverSeverity) {
      const ms = new Date(st.serverDueAt).getTime() - serverNow
      alerts.push({
        key: `${l.id ?? l.plan_slug}-srv`,
        label: 'Mensalidade do servidor',
        targetAt: st.serverDueAt,
        ms,
        sev: st.serverSeverity,
        trial: false,
        isServerFee: true,
      })
    }
  }

  if (alerts.length === 0) return null

  alerts.sort((a, b) => a.ms - b.ms)
  const worst = alerts[0]!
  const c = severityColor(worst.sev)
  const rem = remainingUntil(worst.targetAt, serverNow)
  const under24h = worst.ms <= DAY

  const headline = !rem || rem.expired
    ? 'Vencido agora'
    : under24h
      ? `Vence em ${rem.primary}`
      : `Vence em ${rem.days} dia${rem.days === 1 ? '' : 's'}`

  return (
    <section
      role="alert"
      aria-live="polite"
      className={`enterprise-surface flex flex-wrap items-center gap-4 border-2 px-5 py-4 ${c.border} ${c.bg}`}
    >
      <span className={`relative flex h-2.5 w-2.5 shrink-0 ${under24h ? 'animate-pulse' : ''}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
      </span>
      <AlertTriangle className={`h-5 w-5 shrink-0 ${c.text}`} />

      <div className="min-w-0 flex-1">
        <div className={`font-mono text-sm font-black uppercase tracking-wide ${c.text}`}>
          {headline}
        </div>
        <div className="mt-0.5 truncate text-xs text-foreground/90">
          {worst.label}
          {alerts.length > 1 ? (
            <span className="text-muted-foreground"> · +{alerts.length - 1} item(ns) também próximo(s) do vencimento</span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase text-muted-foreground">
          <Clock className="h-3 w-3" />
          {under24h
            ? 'Renove antes do fim do contador para não perder o acesso.'
            : rem?.detail ?? ''}
        </div>
      </div>

      {worst.isServerFee ? (
        <Link to="/renovar-servidor" className="shrink-0">
          <span className="rgb-border inline-flex rounded-lg bg-primary/10 px-4 py-2 font-mono text-[10px] font-bold uppercase hover:bg-primary/20">
            <span className="rgb-text animate-rgb-text">Renovar servidor</span>
          </span>
        </Link>
      ) : (
        <Link to="/planos" className="shrink-0">
          <span className="inline-flex rounded-lg border border-primary/50 bg-primary/10 px-4 py-2 font-mono text-[10px] font-bold uppercase text-primary hover:bg-primary/20">
            {worst.trial ? 'Assinar agora' : 'Renovar agora'}
          </span>
        </Link>
      )}
    </section>
  )
}
