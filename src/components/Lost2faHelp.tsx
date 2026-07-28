import { Link } from "@tanstack/react-router";
import { KeyRound, LifeBuoy, ShieldAlert } from "lucide-react";

/**
 * Orientação para quem perdeu o autenticador 2FA do arquivo BTMob.
 * Não existe recuperação automática: o login antigo precisa ser removido
 * manualmente pelo suporte e um novo é gerado no lugar.
 */
export function Lost2faHelp({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-md border border-amber-500/30 bg-amber-500/5 p-4 ${className}`}>
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
        <div className="font-mono text-xs uppercase tracking-wider text-amber-300">
          Perdi meu autenticador 2FA
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        O código de 2 fatores do arquivo BTMob fica só no seu aparelho — nem nós conseguimos recuperá-lo. Se você
        trocou de celular, formatou ou apagou o app autenticador, o caminho é remover o login antigo e gerar um novo.
      </p>
      <ol className="mt-2 space-y-1 text-[11px] leading-snug text-muted-foreground">
        <li>1. Abra um chamado no suporte com o assunto “Perdi meu 2FA”.</li>
        <li>2. Informe o e-mail da conta e o usuário do painel.</li>
        <li>3. A equipe confere a titularidade, apaga o login antigo e devolve um novo acesso.</li>
        <li>4. Configure o autenticador de novo e guarde o QR/segredo em local seguro.</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
        <Link to="/suporte" className="inline-flex items-center gap-1 text-primary hover:underline">
          <LifeBuoy className="h-3.5 w-3.5" /> Abrir chamado no suporte
        </Link>
        <Link to="/recuperar" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <KeyRound className="h-3.5 w-3.5" /> Perdi o acesso ao e-mail
        </Link>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Por segurança, essa remoção nunca é automática — sempre passa por validação humana.
      </p>
    </div>
  );
}
