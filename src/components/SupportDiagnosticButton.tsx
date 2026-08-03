import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { LifeBuoy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getOrCreateThread, sendMessage } from '@/lib/support.functions'

type Props = {
  licenses?: any[] | null
  error?: unknown
  context?: string
  label?: string
  className?: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
}

function describeError(error: unknown): string | null {
  if (!error) return null
  if (typeof error === 'string') return error
  const e = error as any
  return e?.message || e?.error_description || e?.details || JSON.stringify(e).slice(0, 500)
}

function describeLicense(l: any): string {
  const parts = [
    `- ID: ${l?.id ?? '—'}`,
    `  Plano: ${l?.plan_slug ?? '—'} | Tier: ${l?.version_tier ?? '—'}`,
    `  Painel: ${l?.panel ?? '—'} | Usuário: ${l?.yaarsa_username ?? l?.yaarsa_email ?? '—'}`,
    `  Expira: ${l?.expires_at ?? 'sem data'} | Revogada: ${l?.revoked ? 'sim' : 'não'} | Desativada: ${l?.disabled_at ? 'sim' : 'não'}`,
  ]
  return parts.join('\n')
}

export function SupportDiagnosticButton({
  licenses,
  error,
  context,
  label = 'Enviar erro ao suporte',
  className,
  variant = 'outline',
  size = 'sm',
}: Props) {
  const [sending, setSending] = useState(false)
  const navigate = useNavigate()
  const openThread = useServerFn(getOrCreateThread)
  const postMessage = useServerFn(sendMessage)

  const buildReport = () => {
    const errMsg = describeError(error)
    const list = licenses ?? []
    const lines = [
      '🛠️ **Relatório automático do painel**',
      context ? `Contexto: ${context}` : null,
      `Data: ${new Date().toLocaleString('pt-BR')}`,
      typeof window !== 'undefined' ? `Página: ${window.location.pathname}` : null,
      '',
      errMsg ? `❌ Erro detectado: ${errMsg}` : '✅ Nenhum erro técnico capturado na tela.',
      '',
      `📄 Licenças (${list.length}):`,
      list.length ? list.map(describeLicense).join('\n') : '- Nenhuma licença encontrada na conta.',
    ].filter(Boolean)
    return lines.join('\n').slice(0, 3900)
  }

  const handleClick = async () => {
    if (sending) return
    setSending(true)
    try {
      const thread: any = await openThread({})
      const threadId = thread?.id
      if (!threadId) throw new Error('Não foi possível abrir o atendimento agora.')
      await postMessage({ data: { threadId, body: buildReport() } })
      toast.success('Relatório enviado ao suporte')
      void navigate({ to: '/suporte' })
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao enviar o relatório ao suporte')
    } finally {
      setSending(false)
    }
  }

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={handleClick} disabled={sending}>
      {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LifeBuoy className="mr-2 h-4 w-4" />}
      {sending ? 'Enviando…' : label}
    </Button>
  )
}
