import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, Lock, EyeOff, AlertTriangle, KeyRound, Copy, Download, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getSecurityStatus, ackSecurityNotice, generateRecoveryCodes } from "@/lib/recovery.functions";

const bullets = [
  {
    icon: Lock,
    title: "Seus dados são criptografados",
    body: "Credenciais de painel e senhas ficam cifradas (AES-256) no nosso banco. Nem no suporte a gente vê sua senha em texto puro.",
  },
  {
    icon: EyeOff,
    title: "Anonimato por padrão",
    body: "Seu e-mail nunca aparece publicamente. Defina um apelido no painel e é só ele que os outros veem.",
  },
  {
    icon: AlertTriangle,
    title: "Cuidado por parte sua também",
    body: "Nunca compartilhe suas credenciais, códigos ou prints do painel. A equipe Shadow jamais pede sua senha por chat, Telegram ou WhatsApp.",
  },
];

export function SecurityWelcomeDialog() {
  const statusFn = useServerFn(getSecurityStatus);
  const ackFn = useServerFn(ackSecurityNotice);
  const genFn = useServerFn(generateRecoveryCodes);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"notice" | "codes">("notice");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    statusFn()
      .then((s) => {
        if (!s.ackAt || s.codesRemaining === 0) setOpen(true);
      })
      .catch(() => {});
  }, [statusFn]);

  async function handleGenerate() {
    setLoading(true);
    try {
      const r = await genFn();
      setCodes(r.codes);
      setStep("codes");
      await ackFn().catch(() => {});
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar os códigos");
    } finally {
      setLoading(false);
    }
  }

  function copyAll() {
    if (!codes) return;
    navigator.clipboard.writeText(codes.join("\n"));
    setSaved(true);
    toast.success("Códigos copiados");
  }

  function downloadTxt() {
    if (!codes) return;
    const content =
      "Shadow — códigos de recuperação de conta\n" +
      "Guarde em local seguro. Cada código só pode ser usado uma vez.\n" +
      "Use em: /recuperar\n\n" +
      codes.join("\n") + "\n";
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "shadow-codigos-recuperacao.txt";
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  }

  async function close() {
    await ackFn().catch(() => {});
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono uppercase tracking-wider">
            <ShieldCheck className="h-5 w-5 text-neon" />
            {step === "notice" ? "Segurança & anonimato" : "Seus códigos de recuperação"}
          </DialogTitle>
          <DialogDescription>
            {step === "notice"
              ? "Leia antes de continuar — leva 30 segundos."
              : "Anote agora. Eles não serão mostrados novamente."}
          </DialogDescription>
        </DialogHeader>

        {step === "notice" ? (
          <div className="space-y-3">
            {bullets.map((b) => (
              <div key={b.title} className="flex items-start gap-3 rounded-md border border-border/60 bg-card/50 p-3">
                <b.icon className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
                <div>
                  <div className="text-xs font-semibold">{b.title}</div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{b.body}</p>
                </div>
              </div>
            ))}
            <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
              <div>
                <div className="text-xs font-semibold">Recuperação de conta</div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  Vamos gerar 8 códigos de uso único. Se você perder o acesso ao e-mail, use um deles em{" "}
                  <span className="font-mono">/recuperar</span> para criar uma senha nova.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={handleGenerate} disabled={loading} className="w-full font-mono uppercase">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar meus códigos
              </Button>
              <Button variant="ghost" onClick={close} className="w-full font-mono uppercase sm:w-auto">
                Depois
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border/60 bg-black/40 p-3 font-mono text-xs">
              {codes?.map((c) => (
                <div key={c} className="tracking-wider text-neon">{c}</div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cada código funciona uma única vez. Guarde offline (papel ou gerenciador de senhas) e nunca envie para ninguém —
              nem para o suporte.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyAll} className="font-mono uppercase">
                <Copy className="mr-2 h-3.5 w-3.5" /> Copiar
              </Button>
              <Button variant="outline" size="sm" onClick={downloadTxt} className="font-mono uppercase">
                <Download className="mr-2 h-3.5 w-3.5" /> Baixar .txt
              </Button>
              <Button size="sm" onClick={close} disabled={!saved} className="ml-auto font-mono uppercase">
                <Check className="mr-2 h-3.5 w-3.5" /> Guardei
              </Button>
            </div>
            {!saved && (
              <p className="text-[11px] text-amber-400">Copie ou baixe os códigos para liberar o botão de concluir.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
