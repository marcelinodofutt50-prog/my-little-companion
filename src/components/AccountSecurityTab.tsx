import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, KeyRound, ShieldCheck, LifeBuoy, Copy } from "lucide-react";

type Factor = { id: string; status: string; friendly_name?: string };

export function AccountSecurityTab() {
  const [email, setEmail] = useState<string>("");
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

  async function load() {
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    if (u) {
      setEmail(u.email ?? "");
      setConfirmed(!!u.email_confirmed_at);
      setPendingEmail((u as any).new_email ?? null);
    }
    const { data: f } = await supabase.auth.mfa.listFactors();
    setFactors((f?.all ?? []) as Factor[]);
  }
  useEffect(() => { load(); }, []);

  const verifiedTotp = factors.find((f) => f.status === "verified");

  async function changeEmail() {
    const e = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toast.error("Digite um e-mail válido.");
    setBusy("email");
    const { error } = await supabase.auth.updateUser({ email: e }, { emailRedirectTo: `${window.location.origin}/shadow-pass` });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link de confirmação para o novo e-mail (e, se exigido, para o atual).");
    setNewEmail(""); load();
  }

  async function resendConfirm() {
    setBusy("resend");
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/shadow-pass` } });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Link de confirmação reenviado. Veja sua caixa de entrada e o spam.");
  }

  async function changePassword() {
    if (newPass.length < 8) return toast.error("A nova senha precisa ter pelo menos 8 caracteres.");
    if (newPass !== newPass2) return toast.error("As duas senhas novas não são iguais.");
    setBusy("pass");
    const { error: e1 } = await supabase.auth.signInWithPassword({ email, password: curPass });
    if (e1) { setBusy(null); return toast.error("Senha atual incorreta."); }
    const { error } = await supabase.auth.updateUser({ password: newPass, current_password: curPass } as any);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Senha do site trocada. (A senha do painel da licença não muda.)");
    setCurPass(""); setNewPass(""); setNewPass2("");
  }

  async function startEnroll() {
    setBusy("mfa");
    // Remove tentativas antigas não concluídas.
    for (const f of factors.filter((x) => x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Shadow ${Date.now()}` });
    setBusy(null);
    if (error || !data) return toast.error(error?.message ?? "Não deu para iniciar.");
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll() {
    if (!enroll) return;
    setBusy("mfa");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    setBusy(null);
    if (error) return toast.error("Código incorreto. Confira o horário do celular e tente de novo.");
    toast.success("Verificação em duas etapas ligada!");
    setEnroll(null); setCode(""); load();
    generateCodes();
  }

  async function disableMfa() {
    if (!verifiedTotp) return;
    if (!confirm("Desligar a verificação em duas etapas deixa sua conta menos protegida. Continuar?")) return;
    setBusy("mfa");
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedTotp.id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Verificação em duas etapas desligada.");
    load();
  }

  async function generateCodes() {
    setBusy("codes");
    const { data, error } = await (supabase.rpc as any)("generate_my_recovery_codes");
    setBusy(null);
    if (error) return toast.error(error.message);
    setCodes((data ?? []).map((r: any) => r.code));
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
            <span className="font-mono text-foreground">{email}</span>
            {confirmed ? <Badge>Confirmado</Badge> : <Badge variant="destructive">Não confirmado</Badge>}
          </div>
          {!confirmed && <Button size="sm" variant="outline" onClick={resendConfirm} disabled={busy === "resend"}>Reenviar confirmação</Button>}
          {pendingEmail && <p className="text-xs text-muted-foreground">Aguardando confirmação do novo e-mail: <b>{pendingEmail}</b></p>}
          <div className="flex gap-2">
            <Input type="email" placeholder="novo.email@gmail.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Button onClick={changeEmail} disabled={busy === "email"}>Trocar</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-primary" /> Senha do site</CardTitle>
          <CardDescription>Troca a senha de entrada no site. A senha do painel da licença é outra.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input type="password" placeholder="Senha atual" value={curPass} onChange={(e) => setCurPass(e.target.value)} />
          <Input type="password" placeholder="Nova senha (mín. 8)" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
          <Input type="password" placeholder="Repita a nova senha" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} />
          <Button onClick={changePassword} disabled={busy === "pass" || !curPass || !newPass}>{busy === "pass" ? "Trocando…" : "Trocar senha"}</Button>
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
              <div><Button size="sm" variant="outline" onClick={disableMfa} disabled={busy === "mfa"}>Desligar</Button></div>
            </>
          ) : enroll ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">1. Escaneie o QR code no app autenticador.</p>
              <div className="inline-block rounded-lg bg-card p-2"><img src={enroll.qr} alt="QR code do 2FA" className="h-44 w-44" /></div>
              <p className="break-all text-xs text-muted-foreground">Ou digite a chave: <span className="font-mono text-foreground">{enroll.secret}</span></p>
              <p className="text-sm text-muted-foreground">2. Digite o código de 6 números que aparece no app.</p>
              <div className="flex gap-2">
                <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="font-mono tracking-widest" />
                <Button onClick={confirmEnroll} disabled={code.length !== 6 || busy === "mfa"}>Ativar</Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEnroll(null)}>Cancelar</Button>
            </div>
          ) : (
            <>
              <Badge variant="destructive">Desligada</Badge>
              <div><Button onClick={startEnroll} disabled={busy === "mfa"}>Ligar 2FA</Button></div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><LifeBuoy className="h-4 w-4 text-primary" /> Códigos de recuperação</CardTitle>
          <CardDescription>Se perder o celular do 2FA, um desses códigos devolve o acesso. Cada um vale uma vez.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {codes ? (
            <>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm text-foreground">{codes.map((c) => <span key={c} className="rounded bg-muted px-2 py-1">{c}</span>)}</div>
              <p className="text-xs text-destructive">Guarde agora — eles não aparecem de novo.</p>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(codes.join("\n")); toast.success("Copiados."); }}><Copy className="mr-1 h-3 w-3" /> Copiar</Button>
            </>
          ) : (
            <Button variant="outline" onClick={generateCodes} disabled={busy === "codes"}>Gerar novos códigos</Button>
          )}
          <p className="text-xs text-muted-foreground">Gerar novos apaga os antigos.</p>
        </CardContent>
      </Card>
    </div>
  );
}
