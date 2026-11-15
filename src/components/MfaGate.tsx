import { getBrowserAuthUser } from "@/lib/browser-auth-user";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createLatestRequest } from "@/lib/latest-request";
import {
  mfaVerificationMessage,
  normalizeMfaCode,
  readTrustedDeviceToken,
  removeTrustedDeviceToken,
  trustedDeviceLabel,
  writeTrustedDeviceToken,
} from "@/lib/mfa-client";

type GateState = "checking" | "ready" | "required" | "error";

/** Bloqueia a interface enquanto uma conta com 2FA ainda estiver em aal1. */
export function MfaGate({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const requests = useRef(createLatestRequest());
  const [state, setState] = useState<GateState>("checking");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [trust, setTrust] = useState(false);

  async function check() {
    const isCurrent = requests.current.begin();
    setState("checking");
    setErr(null);
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      if (data?.currentLevel !== "aal1" || data.nextLevel !== "aal2") {
        if (isCurrent()) {
          setFactorId(null);
          setState("ready");
        }
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const totp = factors?.totp?.find((factor) => factor.status === "verified");
      if (!totp) {
        if (isCurrent()) {
          setFactorId(null);
          setState("ready");
        }
        return;
      }

      const { data: auth, error: userError } = await getBrowserAuthUser();
      if (userError) throw userError;
      const userId = auth.user?.id;
      const token = userId ? readTrustedDeviceToken(userId) : null;
      if (userId && token) {
        const { data: accepted, error: redeemError } = await supabase.rpc(
          "redeem_trusted_device" as never,
          { _token: token } as never,
        );
        if (!isCurrent()) return;
        if (!redeemError && accepted === true) {
          setFactorId(null);
          setState("ready");
          return;
        }
        // Uma falha de rede não apaga um aparelho válido. Só uma recusa explícita o remove.
        if (!redeemError && accepted === false) removeTrustedDeviceToken(userId);
      }

      if (isCurrent()) {
        setFactorId(totp.id);
        setCode("");
        setState("required");
      }
    } catch {
      if (isCurrent()) setState("error");
    }
  }

  useEffect(() => {
    void check();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        requests.current.cancel();
        setFactorId(null);
        setCode("");
        setErr(null);
        setState("ready");
        return;
      }
      if (event === "MFA_CHALLENGE_VERIFIED") {
        requests.current.cancel();
        setState("ready");
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") void check();
    });
    return () => {
      requests.current.cancel();
      data.subscription.unsubscribe();
    };
  }, []);

  async function rememberDevice() {
    try {
      const { data: auth, error: userError } = await getBrowserAuthUser();
      if (userError || !auth.user) throw new Error("user");
      const { data: token, error } = await supabase.rpc(
        "trust_this_device" as never,
        { _label: trustedDeviceLabel() } as never,
      );
      if (error || typeof token !== "string") throw new Error("trust");
      if (!writeTrustedDeviceToken(auth.user.id, token)) {
        toast("2FA confirmado, mas o navegador não permitiu lembrar deste aparelho.");
      }
    } catch {
      toast("2FA confirmado, mas não foi possível lembrar deste aparelho. Ele pedirá o código no próximo acesso.");
    }
  }

  async function verify(event?: React.FormEvent) {
    event?.preventDefault();
    if (!factorId || busy || code.length !== 6) return;
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) {
        setErr(mfaVerificationMessage(error));
        return;
      }
      requests.current.cancel();
      setCode("");
      setState("ready");
      if (trust) void rememberDevice();
    } catch (error) {
      setErr(mfaVerificationMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function leave(destination: "/auth" | "/recuperar") {
    if (busy) return;
    setBusy(true);
    requests.current.cancel();
    await supabase.auth.signOut().catch(() => undefined);
    setFactorId(null);
    setCode("");
    setState("ready");
    setBusy(false);
    navigate({ to: destination, replace: true });
  }

  if (state === "ready") return <>{children}</>;

  if (state === "checking") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-4" role="status" aria-label="Conferindo segurança da conta">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Conferindo a segurança da conta…
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Não foi possível conferir o 2FA</h2>
          <p className="text-sm text-muted-foreground">Sua sessão continua protegida. Verifique sua internet e tente novamente.</p>
          <Button className="w-full" onClick={() => void check()}>Tentar novamente</Button>
          <Button className="w-full" variant="outline" disabled={busy} onClick={() => void leave("/auth")}>Sair da conta</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur">
      <form onSubmit={verify} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Verificação em duas etapas</h2>
        <p className="text-sm text-muted-foreground">Digite o código atual de 6 números do seu app autenticador.</p>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          autoFocus
          disabled={busy}
          aria-label="Código de verificação de seis números"
          onChange={(event) => setCode(normalizeMfaCode(event.target.value))}
          className="text-center font-mono text-xl tracking-[0.5em]"
        />
        <label className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={trust} disabled={busy} onChange={(event) => setTrust(event.target.checked)} className="h-4 w-4 accent-primary" />
          Confiar neste dispositivo por 30 dias
        </label>
        <p className="text-[11px] text-muted-foreground">Não marque em computador público ou de outra pessoa.</p>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{busy ? "Conferindo…" : "Confirmar"}
        </Button>
        <div className="flex flex-col gap-2 text-xs sm:flex-row sm:justify-center">
          <button type="button" className="text-muted-foreground underline" disabled={busy} onClick={() => void leave("/auth")}>Sair da conta</button>
          <button type="button" className="text-muted-foreground underline" disabled={busy} onClick={() => void leave("/recuperar")}>Perdi meu autenticador</button>
        </div>
      </form>
    </div>
  );
}
