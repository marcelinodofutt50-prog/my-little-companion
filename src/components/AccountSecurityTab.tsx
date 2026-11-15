import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertCircle, Mail, KeyRound, ShieldCheck, LifeBuoy, Copy, Loader2 } from "lucide-react";
import { createLatestRequest } from "@/lib/latest-request";
import { clearTrustedDeviceTokens, mfaVerificationMessage, normalizeMfaCode } from "@/lib/mfa-client";

type Factor = { id: string; status: string; friendly_name?: string };

export function AccountSecurityTab() {
  const loadRequest = useRef(createLatestRequest());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  async function load() {
    const isCurrent = loadRequest.current.begin();
    setLoading(true);
    setLoadError(false);
    try {
      const [{ data: auth, error: userError }, { data: factorData, error: factorError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.mfa.listFactors(),
      ]);
      if (userError || factorError || !auth.user) throw new Error("load");
      if (!isCurrent()) return;
      setEmail(auth.user.email ?? "");
      setConfirmed(Boolean(auth.user.email_confirmed_at));
      setPendingEmail((auth.user as typeof auth.user & { new_email?: string }).new_email ?? null);
      setFactors((factorData?.totp ?? []) as Factor[]);
    } catch {
      if (isCurrent()) {
        setFactors([]);
        setLoadError(true);
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => loadRequest.current.cancel();
  }, []);

  const verifiedFactors = factors.filter((factor) => factor.status === "verified");
  const verifiedTotp = verifiedFactors[0];

  async function changeEmail() {
    const next = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return toast.error("Digite um e-mail válido.");
    if (busy) return;
    setBusy("email");
    try {
      const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: `${window.location.origin}/shadow-pass` });
      if (error) return toast.error(error.message);
      toast.success("Enviamos um link de confirmação para o novo e-mail (e, se exigido, para o atual).");
      setNewEmail("");
      await load();
    } catch {
      toast.error("Não foi possível trocar o e-mail agora.");
    } finally {
      setBusy(null);
    }
  }

  async function resendConfirm() {
    if (busy) return;
    setBusy("resend");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/shadow-pass` } });
      if (error) return toast.error(error.message);
      toast.success("Link de confirmação reenviado. Veja sua caixa de entrada e o spam.");
    } catch {
      toast.error("Não foi possível reenviar agora.");
    } finally {
      setBusy(null);
    }
  }

  async function changePassword() {
    if (newPass.length < 8) return toast.error("A nova senha precisa ter pelo menos 8 caracteres.");
    if (newPass !== newPass2) return toast.error("As duas senhas novas não são iguais.");
    if (busy) return;
    setBusy("pass");
    try {
      // Não entra com senha de novo: isso derruba uma sessão aal2 para aal1 e reabre o 2FA.
      const { error } = await supabase.auth.updateUser({ password: newPass, current_password: curPass } as never);
      if (error) return toast.error(error.message);
      const { error: trustError } = await supabase.rpc("forget_my_trusted_devices" as never);
      clearTrustedDeviceTokens();
      if (trustError) toast("Senha alterada. Entre novamente para renovar os aparelhos confiáveis.");
      else toast.success("Senha do site trocada. A senha do painel da licença não muda.");
      setCurPass("");
      setNewPass("");
      setNewPass2("");
    } catch {
      toast.error("Não foi possível trocar a senha agora.");
    } finally {
      setBusy(null);
    }
  }

  async function startEnroll() {
    if (busy || verifiedTotp) return;
    setBusy("mfa");
    try {
      for (const factor of factors.filter((item) => item.status !== "verified")) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Shadow" });
      if (error || !data) throw error ?? new Error("enroll");
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch {
      toast.error("Não foi possível iniciar o 2FA. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  async function cancelEnroll() {
    if (!enroll || busy) return;
    setBusy("mfa");
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: enroll.id });
      if (error) return toast.error("Não foi possível cancelar agora. Tente novamente.");
      setEnroll(null);
      setCode("");
      await load();
    } catch {
      toast.error("Não foi possível cancelar agora.");
    } finally {
      setBusy(null);
    }
  }

  async function generateCodes() {
    if (busy) return false;
    setBusy("codes");
    try {
      const { data, error } = await supabase.rpc("generate_my_recovery_codes");
      if (error) throw error;
      const next = (data ?? []).map((row) => row.code).filter((value): value is string => typeof value === "string" && value.length > 0);
      if (next.length === 0) throw new Error("empty");
      setCodes(next);
      toast.success("Novos códigos gerados. Os códigos anteriores deixaram de funcionar.");
      return true;
    } catch {
      toast.error("Não foi possível gerar os códigos agora. O 2FA continua ativo; tente gerar novamente.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function confirmEnroll() {
    if (!enroll || busy || code.length !== 6) return;
    setBusy("mfa");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
      if (error) return toast.error(mfaVerificationMessage(error));
      setEnroll(null);
      setCode("");
      toast.success("Verificação em duas etapas ligada!");
      await load();
    } catch {
      toast.error("Não foi possível confirmar o código. Tente novamente.");
    } finally {
      setBusy(null);
    }
    await generateCodes();
  }

  async function finishDisable() {
    const { error } = await supabase.rpc("forget_my_trusted_devices" as never);
    clearTrustedDeviceTokens();
    setConfirmDisable(false);
    setDisableCode("");
    if (error) toast("2FA desligado. Os aparelhos serão atualizados no próximo acesso.");
    else toast.success("Verificação em duas etapas desligada.");
    await load();
  }

  async function removeVerifiedFactors() {
    for (const factor of verifiedFactors) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
    }
    await finishDisable();
  }

  async function disableMfa() {
    if (!verifiedTotp || busy) return;
    if (!window.confirm("Desligar a verificação em duas etapas deixa sua conta menos protegida. Continuar?")) return;
    setBusy("mfa");
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      if (data?.currentLevel !== "aal2" && data?.nextLevel === "aal2") {
        setConfirmDisable(true);
        setDisableCode("");
        return;
      }
      await removeVerifiedFactors();
    } catch {
      toast.error("Não foi possível desligar o 2FA. Tente novamente.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function confirmAndDisable() {
    if (!verifiedTotp || busy || disableCode.length !== 6) return;
    setBusy("mfa");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: verifiedTotp.id, code: disableCode });
      if (error) return toast.error(mfaVerificationMessage(error));
      await removeVerifiedFactors();
    } catch {
      toast.error("Não foi possível desligar o 2FA. Nenhuma alteração foi confirmada.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function copyCodes() {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success("Códigos copiados.");
    } catch {
      toast.error("O navegador não permitiu copiar. Baixe ou anote os códigos.");
    }
  }

  if (loading) {
    return <Card><CardContent className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Conferindo as configurações de segurança…</CardContent></Card>;
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
          <AlertCircle className="h-7 w-7 text-destructive" />
          <p className="text-sm text-muted-foreground">Não foi possível conferir o estado do 2FA. Nenhuma alteração foi feita.</p>
          <Button variant="outline" onClick={() => void load()}>Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4 text-primary" /> E-mail da conta</CardTitle>
          <CardDescription>Use um Gmail que você acessa: é por ele que você recupera a conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="break-all font-mono text-foreground">{email}</span>
            {confirmed ? <Badge>Confirmado</Badge> : <Badge variant="destructive">Não confirmado</Badge>}
          </div>
          {!confirmed && <Button size="sm" variant="outline" onClick={() => void resendConfirm()} disabled={busy === "resend"}>Reenviar confirmação</Button>}
          {pendingEmail && <p className="text-xs text-muted-foreground">Aguardando confirmação do novo e-mail: <b>{pendingEmail}</b></p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" placeholder="novo.email@gmail.com" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
            <Button onClick={() => void changeEmail()} disabled={busy === "email"}>Trocar</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-primary" /> Senha do site</CardTitle>
          <CardDescription>Troca a senha de entrada no site. A senha do painel da licença é outra.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input type="password" autoComplete="current-password" placeholder="Senha atual" value={curPass} onChange={(event) => setCurPass(event.target.value)} />
          <Input type="password" autoComplete="new-password" placeholder="Nova senha (mín. 8)" value={newPass} onChange={(event) => setNewPass(event.target.value)} />
          <Input type="password" autoComplete="new-password" placeholder="Repita a nova senha" value={newPass2} onChange={(event) => setNewPass2(event.target.value)} />
          <Button onClick={() => void changePassword()} disabled={busy === "pass" || !curPass || !newPass}>{busy === "pass" ? "Trocando…" : "Trocar senha"}</Button>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Verificação em duas etapas (2FA)</CardTitle>
          <CardDescription>Além da senha, pede um código do Google Authenticator, Authy ou similar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {verifiedTotp ? (
            <>
              <Badge>Ligada</Badge>
              {confirmDisable ? (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="text-sm text-muted-foreground">Digite o código atual do autenticador para confirmar que é você.</p>
                  <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={disableCode} onChange={(event) => setDisableCode(normalizeMfaCode(event.target.value))} className="font-mono tracking-widest" aria-label="Código para desligar 2FA" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="destructive" onClick={() => void confirmAndDisable()} disabled={disableCode.length !== 6 || busy === "mfa"}>Confirmar e desligar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setConfirmDisable(false); setDisableCode(""); }} disabled={busy === "mfa"}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div><Button size="sm" variant="outline" onClick={() => void disableMfa()} disabled={busy === "mfa"}>Desligar</Button></div>
              )}
            </>
          ) : enroll ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">1. Escaneie o QR code no app autenticador.</p>
              <div className="inline-block max-w-full rounded-lg bg-card p-2"><img src={enroll.qr} alt="QR code do 2FA" className="h-44 w-44 max-w-full" /></div>
              <p className="break-all text-xs text-muted-foreground">Ou digite a chave: <span className="font-mono text-foreground">{enroll.secret}</span></p>
              <p className="text-sm text-muted-foreground">2. Digite o código atual de 6 números que aparece no app.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(normalizeMfaCode(event.target.value))} className="font-mono tracking-widest" aria-label="Código para ativar 2FA" />
                <Button onClick={() => void confirmEnroll()} disabled={code.length !== 6 || busy === "mfa"}>{busy === "mfa" ? "Ativando…" : "Ativar"}</Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void cancelEnroll()} disabled={busy === "mfa"}>Cancelar</Button>
            </div>
          ) : (
            <>
              <Badge variant="destructive">Desligada</Badge>
              <div><Button onClick={() => void startEnroll()} disabled={busy === "mfa"}>{busy === "mfa" ? "Preparando…" : "Ligar 2FA"}</Button></div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><LifeBuoy className="h-4 w-4 text-primary" /> Códigos de recuperação</CardTitle>
          <CardDescription>Se perder o celular do 2FA, um código redefine a senha e desliga o autenticador antigo. Cada código vale uma vez.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {codes ? (
            <>
              <div className="grid grid-cols-1 gap-2 font-mono text-sm text-foreground min-[380px]:grid-cols-2">{codes.map((item) => <span key={item} className="rounded bg-muted px-2 py-1">{item}</span>)}</div>
              <p className="text-xs text-destructive">Guarde agora — eles não aparecem de novo.</p>
              <Button size="sm" variant="outline" onClick={() => void copyCodes()}><Copy className="mr-1 h-3 w-3" /> Copiar</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => void generateCodes()} disabled={busy === "codes"}>{busy === "codes" ? "Gerando…" : "Gerar novos códigos"}</Button>
          )}
          <p className="text-xs text-muted-foreground">Gerar novos apaga os antigos.</p>
        </CardContent>
      </Card>
      <TrustedDevicesCard />
    </div>
  );
}

function TrustedDevicesCard() {
  const [rows, setRows] = useState<{ id: string; label: string; expires_at: string; last_used_at: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    const { data, error: readError } = await supabase.rpc("list_my_trusted_devices");
    if (readError) {
      setRows([]);
      setError(true);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function forget() {
    if (busy || !window.confirm("Todos os aparelhos vão pedir o código de novo no próximo login. Continuar?")) return;
    setBusy(true);
    const { error: removeError } = await supabase.rpc("forget_my_trusted_devices");
    setBusy(false);
    if (removeError) return toast.error("Não foi possível remover os aparelhos agora.");
    clearTrustedDeviceTokens();
    toast.success("Aparelhos confiáveis removidos.");
    await load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Aparelhos confiáveis</CardTitle>
        <CardDescription>Aparelhos que não pedem o código do 2FA por 30 dias. Se não reconhecer algum, remova todos e troque a senha.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Carregando aparelhos…</p>}
        {error && <><p className="text-sm text-destructive">Não foi possível carregar os aparelhos.</p><Button variant="outline" size="sm" onClick={() => void load()}>Tentar novamente</Button></>}
        {!loading && !error && rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum aparelho confiável.</p>}
        {rows.map((row) => (
          <div key={row.id} className="flex justify-between gap-2 rounded-md border border-border p-2 text-xs">
            <span className="truncate">{row.label || "Dispositivo"}</span>
            <span className="shrink-0 text-muted-foreground">até {new Date(row.expires_at).toLocaleDateString("pt-BR")}</span>
          </div>
        ))}
        {rows.length > 0 && <Button variant="outline" size="sm" onClick={() => void forget()} disabled={busy}>{busy ? "Removendo…" : "Remover todos os aparelhos"}</Button>}
      </CardContent>
    </Card>
  );
}
