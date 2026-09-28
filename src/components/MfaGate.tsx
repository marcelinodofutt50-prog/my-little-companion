import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";

/**
 * Quando a conta tem verificação em duas etapas ligada e a sessão ainda não
 * passou pelo código, bloqueia a tela até o cliente digitar o código do app.
 */
export function MfaGate() {
  const [need, setNeed] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function check() {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data && data.currentLevel === "aal1" && data.nextLevel === "aal2") {
      const { data: f } = await supabase.auth.mfa.listFactors();
      const totp = f?.totp?.find((x) => x.status === "verified");
      if (totp) { setFactorId(totp.id); setNeed(true); return; }
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
    setCode(""); setNeed(false);
  }

  if (!need) return null;
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
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="w-full" disabled={busy || code.length !== 6} onClick={verify}>{busy ? "Conferindo…" : "Confirmar"}</Button>
        <button className="text-xs text-muted-foreground underline" onClick={() => supabase.auth.signOut()}>Sair da conta</button>
        <p className="text-xs text-muted-foreground">Perdeu o celular? Use a página "Recuperar acesso" com um código de recuperação.</p>
      </div>
    </div>
  );
}
