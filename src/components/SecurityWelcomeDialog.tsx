import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Lock, EyeOff, AlertTriangle, KeyRound, Copy, Download, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { generatePlainCode, hashCode, RECOVERY_CODE_COUNT } from "@/lib/recovery.shared";

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
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"notice" | "codes">("notice");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  /** null = ainda carregando; true = já existiram códigos antes (regeneração) */
  const [hadCodes, setHadCodes] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const checked = useRef(false);

  async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Sua sessão expirou. Saia e entre novamente para gerar os códigos.");
    return data.user;
  }

  async function ackSecurityNoticeDirect() {
    try {
      const user = await getCurrentUser();
      await supabase
        .from("profiles")
        .update({ security_ack_at: new Date().toISOString() })
        .eq("id", user.id);
    } catch {
      // Não bloqueia o usuário: esse campo só controla se o aviso aparece de novo.
    }
  }

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    getCurrentUser()
      .then(async (user) => {
        const [{ data: profile }, { count }] = await Promise.all([
          supabase
            .from("profiles")
            .select("security_ack_at,recovery_codes_generated_at")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("recovery_codes")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .is("used_at", null),
        ]);

        const generatedAt = (profile as any)?.recovery_codes_generated_at ?? null;
        const ackAt = (profile as any)?.security_ack_at ?? null;
        const remaining = count ?? 0;

        setHadCodes(Boolean(generatedAt));
        setExhausted(Boolean(generatedAt) && remaining === 0);
        if (!ackAt || remaining === 0) setOpen(true);
      })
      .catch(() => {});
  }, []);

  async function handleGenerate() {
    if (loading) return;
    setErrorText(null);
    setLoading(true);
    try {
      const user = await getCurrentUser();
      const nextCodes: string[] = [];
      while (nextCodes.length < RECOVERY_CODE_COUNT) {
        const code = generatePlainCode();
        if (!nextCodes.includes(code)) nextCodes.push(code);
      }

      const rows = await Promise.all(
        nextCodes.map(async (code) => ({ user_id: user.id, code_hash: await hashCode(code) })),
      );

      // PGRST205 = cache de schema desatualizado no backend. Tentamos de novo em silêncio.
      const isSchemaCache = (err: any) =>
        err?.code === "PGRST205" || /schema cache/i.test(err?.message ?? "");

      let deleteError: any = (await supabase.from("recovery_codes").delete().eq("user_id", user.id)).error;
      if (deleteError && isSchemaCache(deleteError)) {
        await new Promise((r) => setTimeout(r, 1200));
        deleteError = (await supabase.from("recovery_codes").delete().eq("user_id", user.id)).error;
      }
      if (deleteError) {
        throw new Error(
          isSchemaCache(deleteError)
            ? "O backend ainda está atualizando o cache de tabelas. Aguarde alguns segundos e toque em gerar novamente."
            : `Falha ao limpar códigos antigos: ${deleteError.message}`,
        );
      }

      let insertError: any = (await supabase.from("recovery_codes").insert(rows)).error;
      if (insertError && isSchemaCache(insertError)) {
        await new Promise((r) => setTimeout(r, 1200));
        insertError = (await supabase.from("recovery_codes").insert(rows)).error;
      }
      if (insertError) {
        throw new Error(
          isSchemaCache(insertError)
            ? "O backend ainda está atualizando o cache de tabelas. Aguarde alguns segundos e toque em gerar novamente."
            : `Falha ao salvar os códigos: ${insertError.message}`,
        );
      }


      await supabase
        .from("profiles")
        .update({ recovery_codes_generated_at: new Date().toISOString(), security_ack_at: new Date().toISOString() })
        .eq("id", user.id);

      setCodes(nextCodes);
      setSaved(false);
      setStep("codes");
      toast.success(
        hadCodes
          ? `${nextCodes.length} novos códigos gerados — os antigos foram invalidados`
          : `${nextCodes.length} códigos de recuperação gerados com sucesso`,
      );
      setHadCodes(true);
      setExhausted(false);
    } catch (e: any) {
      const msg = e?.message ?? "Falha ao gerar os códigos. Tente novamente em instantes.";
      setErrorText(msg);
      toast.error(msg);
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
    if (codes && saved) toast.success("Tudo certo — seus códigos de recuperação estão ativos");
    await ackSecurityNoticeDirect();
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
                <div className="text-xs font-semibold">
                  {exhausted
                    ? "Seus códigos acabaram"
                    : hadCodes
                      ? "Gerar novos códigos"
                      : "Recuperação de conta"}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {exhausted
                    ? "Você já usou todos os códigos anteriores. Gere um novo conjunto de 8 códigos para não perder o acesso."
                    : hadCodes
                      ? "Ao gerar um novo conjunto, todos os códigos antigos deixam de funcionar imediatamente."
                      : "Vamos gerar 8 códigos de uso único. Se você perder o acesso ao e-mail, use um deles em /recuperar para criar uma senha nova."}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={handleGenerate} disabled={loading} className="w-full font-mono uppercase">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Gerando..." : hadCodes ? "Gerar novos códigos" : "Gerar meus códigos"}
              </Button>
              <Button variant="ghost" onClick={close} disabled={loading} className="w-full font-mono uppercase sm:w-auto">
                Depois
              </Button>
            </div>
            {errorText && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[11px] leading-snug text-destructive">
                <span className="font-semibold">Não consegui gerar ainda.</span> Motivo: {errorText}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-neon/40 bg-neon/5 p-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
              <p className="text-[11px] leading-snug">
                <span className="font-semibold">
                  {codes?.length} códigos gerados com sucesso.
                </span>{" "}
                {hadCodes
                  ? "Os códigos anteriores foram invalidados — use apenas os desta lista."
                  : "Salve agora: esta é a única vez que eles aparecem."}
              </p>
            </div>
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
