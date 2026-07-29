import { useEffect, useState } from "react";
import { MailWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { siteUrl } from "@/lib/site-url";

/**
 * Cadastro não exige confirmação de e-mail: o cliente entra na hora.
 * Este aviso aparece só enquanto o e-mail ainda não foi confirmado,
 * lembrando de confirmar quando a mensagem chegar.
 */
export function EmailConfirmBanner() {
  const [email, setEmail] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(true);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const user = data.user;
      if (!user) return;
      setEmail(user.email ?? null);
      setConfirmed(Boolean((user as any).email_confirmed_at ?? (user as any).confirmed_at));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (confirmed || !email) return null;

  const resend = async () => {
    if (sending || cooldown > 0) return;
    setSending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: siteUrl() },
      });
      if (error) throw error;
      toast.success("E-mail de confirmação enviado. Confirme assim que chegar.");
      setCooldown(60);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar agora. Tente mais tarde.");
      setCooldown(60);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="text-sm">
            <p className="font-mono uppercase tracking-wider text-amber-300">
              Confirme seu e-mail
            </p>
            <p className="text-muted-foreground">
              Sua conta já está ativa e você pode usar tudo normalmente. Quando o e-mail de
              confirmação chegar, clique no link para proteger sua conta e garantir a recuperação
              de senha.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resend}
          disabled={sending || cooldown > 0}
          className="shrink-0 font-mono uppercase tracking-wider"
        >
          {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Enviar confirmação"}
        </Button>
      </div>
    </div>
  );
}
