import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recoverAccountWithCode } from "@/lib/recovery.functions";

export const Route = createFileRoute("/recuperar")({
  head: () => ({
    meta: [
      { title: "Recuperar conta — Shadow" },
      { name: "description", content: "Recupere o acesso à sua conta Shadow usando um código de recuperação de uso único." },
      { property: "og:title", content: "Recuperar conta — Shadow" },
      { property: "og:description", content: "Recupere o acesso à sua conta Shadow com um código de recuperação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecoverPage,
});

function RecoverPage() {
  const navigate = useNavigate();
  const recoverFn = useServerFn(recoverAccountWithCode);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return toast.error("As senhas não conferem");
    setLoading(true);
    try {
      const r = await recoverFn({ data: { email, code, newPassword: password } });
      toast.success(`Senha redefinida! Restam ${r.codesRemaining} códigos.`);
      navigate({ to: "/auth" });
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível recuperar a conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-neon" />
          <h1 className="font-display text-2xl tracking-tight">Recuperar conta</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Perdeu o acesso ao seu e-mail? Use um dos códigos de recuperação gerados no painel para definir uma senha nova.
        </p>

        <form onSubmit={submit} className="terminal-card scanlines relative mt-8 space-y-4 p-6">
          <div>
            <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">E-mail da conta</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Código de recuperação</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SHDW-XXXX-XXXX"
              className="font-mono tracking-wider"
              required
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Nova senha</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Confirmar nova senha</label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} autoComplete="new-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full font-mono uppercase tracking-wider">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Redefinir senha
          </Button>
        </form>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Cada código só pode ser usado uma vez. Depois de recuperar o acesso, gere novos códigos no painel.
        </p>
        <Link to="/auth" className="mt-3 text-xs text-muted-foreground hover:text-foreground">← Voltar ao login</Link>
      </main>
    </div>
  );
}
