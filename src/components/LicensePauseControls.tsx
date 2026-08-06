import { useState } from 'react'
import { PauseCircle, PlayCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@/components/ui/button'
import { suspendMyLicense, reactivateMyLicense } from '@/lib/license.functions'
import type { LicenseExpiryState } from '@/lib/expiry'
import { canPauseLicense, canResumeLicense } from '@/lib/license-pause-rules'

type Props = {
  license: any
  state: LicenseExpiryState
  onDone: () => void
}

function humanLeft(ms: number | null): string {
  if (ms === null) return '—'
  const mins = Math.floor(ms / 60000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  if (days > 0) return `${days} dia${days === 1 ? '' : 's'} e ${hours}h`
  return `${hours}h ${mins % 60}min`
}

/**
 * Pausar / despausar a licença. Enquanto pausada nenhum dia é contado e a
 * senha do painel é trocada por uma aleatória; ao despausar o cliente recebe
 * de volta o tempo exato que faltava e a senha original.
 */
export function LicensePauseControls({ license, state, onDone }: Props) {
  const pause = useServerFn(suspendMyLicense)
  const resume = useServerFn(reactivateMyLicense)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const paused = state.paused
  const pauseGate = canPauseLicense(license)
  const resumeGate = canResumeLicense(license)
  if (license.disabled_at) return null
  if (license.revoked && !paused) return null

  const run = async (fn: () => Promise<any>, ok: string) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      onDone()
    } catch (e: any) {
      const msg = e?.message ?? 'Não foi possível concluir a operação'
      toast.error(msg, {
        description: 'Se o problema continuar, abra um chamado no suporte que a equipe destrava manualmente.',
      })
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }


  if (paused) {
    return (
      <div className="space-y-2 rounded-md border border-amber-400/40 bg-amber-400/10 p-3">
        <div className="font-mono text-[10px] font-bold uppercase text-amber-500">Licença pausada</div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Nenhum dia está sendo contado. Guardamos{' '}
          <span className="font-semibold text-foreground">{humanLeft(state.pausedMsLeft)}</span> de acesso
          para quando você despausar. O login está bloqueado no servidor até lá.
        </p>
        {!resumeGate.ok && (
          <p className="text-[11px] font-medium text-amber-500">{resumeGate.message}</p>
        )}
        <Button
          size="sm"
          className="font-mono text-[10px] uppercase"
          disabled={busy || !resumeGate.ok}
          onClick={() => void run(() => resume({ data: { licenseId: license.id } }), 'Licença despausada — sua senha original voltou a funcionar')}
        >
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="mr-1.5 h-3.5 w-3.5" />}
          Despausar login
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

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="space-y-2 rounded-md border border-border/60 bg-background/60 p-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Ao pausar, sua senha do painel é trocada por uma senha aleatória e o login para de funcionar
            na hora. Os dias restantes ficam congelados e voltam quando você despausar.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="font-mono text-[10px] uppercase"
              disabled={busy}
              onClick={() => void run(() => pause({ data: { licenseId: license.id } }), 'Login pausado — nenhum dia será contado')}
            >
              {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="mr-1.5 h-3.5 w-3.5" />}
              Confirmar pausa
            </Button>
            <Button size="sm" variant="outline" className="font-mono text-[10px] uppercase" disabled={busy} onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="font-mono text-[10px] uppercase"
          onClick={() => setConfirming(true)}
        >
          <PauseCircle className="mr-1.5 h-3.5 w-3.5" /> Pausar login
        </Button>
      )}
    </div>
  )
}
