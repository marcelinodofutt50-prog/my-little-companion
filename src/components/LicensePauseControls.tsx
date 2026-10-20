import { useMemo, useState } from 'react'
import { PauseCircle, PlayCircle, Loader2, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  suspendMyLicense,
  reactivateMyLicense,
  staffPauseLicense,
  staffResumeLicense,
} from '@/lib/license.functions'
import { licenseExpiryState, type LicenseExpiryState } from '@/lib/expiry'
import {
  canPauseLicense,
  canResumeLicense,
  pauseWindow,
  pausedThisMonth,
  planResume,
  spMidnight,
  spYmd,
  MAX_PAUSE_DAYS,
} from '@/lib/license-pause-rules'
import { friendlyPanelError } from '@/lib/panel-errors'

type Props = {
  license: any
  state?: LicenseExpiryState
  onDone: () => void
  /** Equipe: pausa qualquer licença, sem o limite de 1x por mês. */
  staff?: boolean
}

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function humanLeft(ms: number | null): string {
  if (ms === null) return 'vitalício'
  const mins = Math.floor(ms / 60000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  if (days > 0) return `${days}d e ${hours}h`
  if (hours > 0) return `${hours}h e ${mins % 60}min`
  return `${mins % 60}min`
}

/** Converte um Date do calendário (horário local) para AAAA-MM-DD sem mudar o dia. */
function localYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function ymdToLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

/**
 * Pausar / despausar o login. Enquanto pausado o login fica bloqueado no
 * BTmob, os dias da licença não contam e a taxa do servidor fica congelada.
 * O login volta sozinho no dia escolhido (ou antes, pelo botão).
 */
export function LicensePauseControls({ license, state: stateProp, onDone, staff = false }: Props) {
  const pause = useServerFn(staff ? staffPauseLicense : suspendMyLicense)
  const resume = useServerFn(staff ? staffResumeLicense : reactivateMyLicense)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState<string | null>(null)

  const state = stateProp ?? licenseExpiryState(license)
  const paused = state.paused
  const pauseGate = canPauseLicense(license)
  const resumeGate = canResumeLicense(license)
  const usedThisMonth = !staff && pausedThisMonth(license.last_pause_started_at)
  const win = useMemo(() => pauseWindow(), [open])

  // Simula o retorno no dia escolhido para mostrar as novas datas antes de confirmar.
  const preview = useMemo(() => {
    if (!day) return null
    const now = new Date()
    return planResume(
      {
        suspended_at: now.toISOString(),
        expires_at: license.expires_at,
        server_paid_until: license.server_paid_until,
        plan_slug: license.plan_slug,
      },
      spMidnight(day),
    )
  }, [day, license.expires_at, license.server_paid_until, license.plan_slug])

  const resumePreview = useMemo(
    () => (paused && license.suspended_at ? planResume(license) : null),
    [paused, license],
  )

  if (license.disabled_at) return null
  if (license.revoked && !paused) return null

  const run = async (fn: () => Promise<any>, ok: string, loading: string) => {
    if (busy) return
    setBusy(true)
    const t = toast.loading(loading)
    const attempt = async () => {
      const res = await fn()
      if (!res || !res.ok) throw new Error(res?.message || 'O servidor não confirmou a operação')
      return res
    }
    try {
      try {
        await attempt()
      } catch (first: any) {
        const msg = String(first?.message ?? first)
        if (!/não está respondendo|timeout|rede|conex|indispon/i.test(msg)) throw first
        toast.loading('O servidor demorou a responder — tentando de novo…', { id: t })
        await new Promise((r) => setTimeout(r, 1500))
        await attempt()
      }
      toast.success(ok, { id: t })
      setOpen(false)
      setDay(null)
      onDone()
    } catch (e: any) {
      toast.error('Não foi possível concluir agora', {
        id: t,
        description: friendlyPanelError(e, 'O servidor não respondeu ao comando'),
        duration: 9000,
      })
    } finally {
      setBusy(false)
    }
  }

  if (paused) {
    return (
      <div className="space-y-2 rounded-md border border-amber-400/40 bg-amber-400/10 p-3">
        <div className="font-mono text-[10px] font-bold uppercase text-amber-500">Login pausado</div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          O login está bloqueado no BTmob e nenhum dia está sendo contado. Guardamos{' '}
          <span className="font-semibold text-foreground">{humanLeft(state.pausedMsLeft)}</span> de licença.
          {license.pause_until && (
            <>
              {' '}Volta sozinho em <span className="font-semibold text-foreground">{fmtDay(license.pause_until)}</span>.
            </>
          )}
        </p>
        {resumePreview?.newServerPaidUntil && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Se voltar agora, a taxa do servidor passa a vencer em{' '}
            <span className="font-semibold text-foreground">{fmtDay(resumePreview.newServerPaidUntil)}</span>.
          </p>
        )}
        {!resumeGate.ok && <p className="text-[11px] font-medium text-amber-500">{resumeGate.message}</p>}
        <Button
          size="sm"
          className="font-mono text-[10px] uppercase"
          disabled={busy || !resumeGate.ok}
          onClick={() =>
            void run(
              () => resume({ data: { licenseId: license.id } }),
              'Login reativado — a senha original voltou a funcionar',
              'Reativando o login no painel…',
            )
          }
        >
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="mr-1.5 h-3.5 w-3.5" />}
          Voltar agora
        </Button>
      </div>
    )
  }

  if (!state.active && !pauseGate.ok) return null
  if (!pauseGate.ok) {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Pausa indisponível:</span> {pauseGate.message}
      </p>
    )
  }
  if (usedThisMonth) {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Pausa indisponível:</span> você já pausou esta licença
        este mês. Poderá pausar de novo no mês que vem.
      </p>
    )
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="font-mono text-[10px] uppercase" onClick={() => setOpen(true)}>
        <PauseCircle className="mr-1.5 h-3.5 w-3.5" /> Pausar login
      </Button>
    )
  }

  const nDays = day
    ? Math.round((spMidnight(day).getTime() - spMidnight(spYmd(new Date())).getTime()) / 86_400_000)
    : null

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-background/60 p-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase text-foreground">
        <CalendarDays className="h-3.5 w-3.5" /> Até quando quer pausar?
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Escolha o dia em que o login volta (até {MAX_PAUSE_DAYS} dias
        {staff ? '' : ', 1 pausa por mês'}). Enquanto pausado o login não funciona no BTmob, mas você não
        perde dias e a taxa do servidor fica congelada. Dá para voltar antes pelo botão.
      </p>
      <Calendar
        mode="single"
        selected={day ? ymdToLocal(day) : undefined}
        onSelect={(d) => setDay(d ? localYmd(d) : null)}
        disabled={[{ before: ymdToLocal(win.min) }, { after: ymdToLocal(win.max) }]}
        startMonth={ymdToLocal(win.min)}
        endMonth={ymdToLocal(win.max)}
        className="rounded-md border border-border/50"
      />
      {day && preview && (
        <div className="space-y-1 rounded-md border border-border/50 bg-card/40 p-2 text-[11px] text-muted-foreground">
          <div>
            Pausa de <span className="font-semibold text-foreground">{nDays} dia(s)</span> · volta em{' '}
            <span className="font-semibold text-foreground">{fmtDay(spMidnight(day).toISOString())}</span>
          </div>
          {preview.newExpiresAt && (
            <div>
              Licença passa a vencer em <span className="font-semibold text-foreground">{fmtDay(preview.newExpiresAt)}</span>
            </div>
          )}
          {preview.newServerPaidUntil && (
            <div>
              Taxa do servidor: de {fmtDay(license.server_paid_until)} para{' '}
              <span className="font-semibold text-foreground">{fmtDay(preview.newServerPaidUntil)}</span>
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          className="font-mono text-[10px] uppercase"
          disabled={busy || !day}
          onClick={() =>
            day &&
            void run(
              () => pause({ data: { licenseId: license.id, resumeOn: day } }),
              'Login pausado — nenhum dia será contado',
              'Pausando o login no painel…',
            )
          }
        >
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="mr-1.5 h-3.5 w-3.5" />}
          Confirmar pausa
        </Button>
        <Button size="sm" variant="outline" className="font-mono text-[10px] uppercase" disabled={busy} onClick={() => { setOpen(false); setDay(null) }}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
