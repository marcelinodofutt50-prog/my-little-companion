import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Clock } from 'lucide-react'
import { remainingUntil } from '@/lib/expiry'

type Props = {
  /** Data alvo (ISO) vinda do servidor. */
  target: string | null | undefined
  /** Relógio autoritativo do servidor (ms). */
  serverNow: number
  /** Texto acima do número. */
  title?: string
  /** Texto explicando o que acontece quando zerar. */
  note?: string
  compact?: boolean
}

/**
 * Countdown vivo (1s) ancorado no relógio do servidor.
 * Abaixo de 48h mostra HH:MM:SS — o trial dura 24h reais mesmo que a conta
 * no painel tenha 2 dias (o painel corta na virada da meia-noite).
 */
export function LicenseCountdown({ target, serverNow, title = 'Tempo restante', note, compact }: Props) {
  const base = useRef({ serverNow, local: Date.now() })
  if (base.current.serverNow !== serverNow) base.current = { serverNow, local: Date.now() }

  const [, tick] = useState(0)
  useEffect(() => {
    const i = setInterval(() => tick((v) => v + 1), 1000)
    return () => clearInterval(i)
  }, [])

  const now = base.current.serverNow + (Date.now() - base.current.local)
  const rem = remainingUntil(target, now)
  if (!rem) return null

  const urgent = rem.expired || rem.totalMs < 24 * 3600_000
  const warn = !urgent && rem.totalMs < 72 * 3600_000
  const tone = rem.expired
    ? 'border-destructive/40 bg-destructive/10 text-destructive'
    : urgent
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
      : warn
        ? 'border-amber-500/30 bg-amber-500/5 text-amber-500'
        : 'border-primary/30 bg-primary/5 text-primary'

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tabular-nums ${tone}`}>
        {rem.expired ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
        {rem.expired ? 'Expirada' : rem.primary}
      </span>
    )
  }

  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border-2 px-6 py-5 font-mono ${tone}`}>
      <div className="text-[10px] font-bold uppercase">{title}</div>
      <div className="mt-1 text-4xl font-black tabular-nums md:text-5xl">{rem.primary}</div>
      <div className="text-[10px] uppercase opacity-80">{rem.unit}</div>
      <div className="mt-2 max-w-[16rem] text-center text-[10px] normal-case leading-relaxed text-muted-foreground">
        {rem.expired ? 'Esta licença foi encerrada automaticamente. Renove para voltar a usar.' : (note ?? rem.detail)}
      </div>
    </div>
  )
}
