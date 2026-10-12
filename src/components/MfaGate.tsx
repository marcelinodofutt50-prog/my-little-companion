import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";

/**
 * Quando a conta tem verificação em duas etapas ligada e a sessão ainda não
 * passou pelo código, bloqueia a tela até o cliente digitar o código do app.
 */
export function MfaGate({ children }: { children?: ReactNode }) {
  const [need, setNeed] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [trust, setTrust] = useState(false);

  async function check() {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data && data.currentLevel === "aal1" && data.nextLevel === "aal2") {
      const { data: f } = await supabase.auth.mfa.listFactors();
      const totp = f?.totp?.find((x) => x.status === "verified");
      if (totp) {
        // Aparelho confiável: o banco confere o token (guardado só como hash) e libera esta sessão.
        const { data: u } = await supabase.auth.getUser();
        const key = u.user ? `shadow:mfa-trust:${u.user.id}` : null;
        const tok = key ? localStorage.getItem(key) : null;
        if (tok) {
          const { data: ok } = await supabase.rpc("redeem_trusted_device" as any, { _token: tok } as any);
          if (ok === true) { setNeed(false); return; }
          localStorage.removeItem(key!);
        }
        setFactorId(totp.id); setNeed(true); return;
      }
    }
    setNeed(false);
  }

  useEffect(() => {
    check();
    const { data } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "MFA_CHALLENGE_VERIFIED") check();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function verify() {
    if (!factorId) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) { setErr("Código incorreto ou vencido. Confira o app e tente de novo."); return; }
    if (trust) {
      const { data: u } = await supabase.auth.getUser();
      const label = `${navigator.platform || "Dispositivo"} · ${(navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg|OPR)\/[\d]+/) || ["navegador"])[0]}`;
      const { data: tok } = await supabase.rpc("trust_this_device" as any, { _label: label } as any);
      if (u.user && typeof tok === "string") localStorage.setItem(`shadow:mfa-trust:${u.user.id}`, tok);
    }
    setCode(""); setNeed(false);
  }

  // Com 2FA pendente o conteúdo do site nem é montado; o banco também recusa
  // qualquer leitura/gravação até o código ser confirmado.
  if (!need) return <>{children}</>;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Verificação em duas etapas</h2>
        <p className="text-sm text-muted-foreground">Digite o código de 6 números do seu app autenticador.</p>
        <Input inputMode="numeric" maxLength={6} value={code} autoFocus
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()}
          className="text-center font-mono text-xl tracking-[0.5em]" />
        <label className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="h-4 w-4 accent-primary" />
          Confiar neste dispositivo por 30 dias
        </label>
        <p className="text-[11px] text-muted-foreground">Não marque em computador público ou de outra pessoa.</p>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="w-full" disabled={busy || code.length !== 6} onClick={verify}>{busy ? "Conferindo…" : "Confirmar"}</Button>
        <button className="text-xs text-muted-foreground underline" onClick={() => supabase.auth.signOut()}>Sair da conta</button>
        <p className="text-xs text-muted-foreground">Perdeu o celular? Use a página "Recuperar acesso" com um código de recuperação.</p>
      </div>
    </div>
  );
}
