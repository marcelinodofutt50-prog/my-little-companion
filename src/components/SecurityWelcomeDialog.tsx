import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Lock, EyeOff, AlertTriangle, KeyRound, Copy, Download, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

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
  const [remaining, setRemaining] = useState(0);
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
        const left = count ?? 0;

        setHadCodes(Boolean(generatedAt));
        setRemaining(left);
        setExhausted(Boolean(generatedAt) && left === 0);
        if (!ackAt || left === 0) setOpen(true);
      })
      .catch(() => {});
  }, []);

  /** Plano B: gera no navegador e grava direto na tabela (RLS: só as próprias linhas). */
  async function generateViaTableFallback(userId: string): Promise<string[]> {
    const { generatePlainCode, hashCode, RECOVERY_CODE_COUNT } = await import("@/lib/recovery.shared");

    const plain: string[] = [];
    while (plain.length < RECOVERY_CODE_COUNT) {
      const c = generatePlainCode();
      if (!plain.includes(c)) plain.push(c);
    }
    const rows = await Promise.all(
      plain.map(async (c) => ({ user_id: userId, code_hash: await hashCode(c) })),
    );

    const del = await supabase.from("recovery_codes").delete().eq("user_id", userId);
    if (del.error) {
      console.error("[recovery] fallback delete falhou", del.error);
      throw new Error(`Falha ao limpar códigos antigos: ${del.error.message}`);
    }

    const ins = await supabase.from("recovery_codes").insert(rows);
    if (ins.error) {
      console.error("[recovery] fallback insert falhou", ins.error);
      throw new Error(`Falha ao salvar os novos códigos: ${ins.error.message}`);
    }

    const upd = await supabase
      .from("profiles")
      .update({ recovery_codes_generated_at: new Date().toISOString() })
      .eq("id", userId);
    if (upd.error) console.warn("[recovery] não deu para marcar a data de geração", upd.error);

    return plain;
  }

  async function handleGenerate() {
    if (loading) return;
    setErrorText(null);
    setLoading(true);
    const started = Date.now();
    try {
      const user = await getCurrentUser();
      console.info("[recovery] iniciando geração", { userId: user.id, hadCodes, exhausted });

      const isSchemaCache = (err: any) =>
        err?.code === "PGRST202" ||
        err?.code === "PGRST205" ||
        /schema cache|function .* not found|could not find/i.test(err?.message ?? "");

      let nextCodes: string[] = [];
      let via = "rpc";

      // Caminho principal: uma única chamada no backend.
      let result = await supabase.rpc("generate_my_recovery_codes");
      if (result.error) {
        console.warn("[recovery] RPC tentativa 1 falhou", {
          code: (result.error as any)?.code,
          message: result.error.message,
          details: (result.error as any)?.details,
          hint: (result.error as any)?.hint,
        });
        if (isSchemaCache(result.error)) {
          await new Promise((r) => setTimeout(r, 1500));
          result = await supabase.rpc("generate_my_recovery_codes");
          if (result.error) {
            console.warn("[recovery] RPC tentativa 2 falhou", {
              code: (result.error as any)?.code,
              message: result.error.message,
            });
          }
        }
      }

      if (!result.error) {
        nextCodes = ((result.data ?? []) as Array<{ code: string }>).map((row) => row.code).filter(Boolean);
      }

      // Fallback: grava direto na tabela quando o RPC não está disponível/retornou vazio.
      if (nextCodes.length === 0) {
        via = "tabela (fallback)";
        console.warn("[recovery] usando fallback direto na tabela", {
          rpcError: result.error
            ? { code: (result.error as any)?.code, message: result.error.message }
            : null,
        });
        nextCodes = await generateViaTableFallback(user.id);
      }

      if (nextCodes.length === 0) {
        throw new Error("Nenhum código foi gerado. Tente novamente em instantes.");
      }

      console.info("[recovery] códigos gerados com sucesso", {
        via,
        quantidade: nextCodes.length,
        ms: Date.now() - started,
      });

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
      console.error("[recovery] falha final ao gerar códigos", {
        message: e?.message,
        code: e?.code,
        details: e?.details,
        hint: e?.hint,
        ms: Date.now() - started,
        error: e,
      });
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
            {hasActiveCodes ? (
              <div className="flex items-start gap-3 rounded-md border border-neon/40 bg-neon/5 p-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
                <div>
                  <div className="text-xs font-semibold">Você já tem códigos de backup</div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Existem <span className="text-neon">{remaining} código(s) de recuperação ativos</span> na sua conta
                    {generatedLabel ? ` (gerados em ${generatedLabel})` : ""}. Por segurança eles não podem ser exibidos
                    de novo. Se você guardou o arquivo .txt, está tudo certo — é só continuar.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
                <div>
                  <div className="text-xs font-semibold">
                    {exhausted ? "Seus códigos acabaram" : "Recuperação de conta"}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {exhausted
                      ? "Você já usou todos os códigos anteriores. Gere um novo conjunto de 8 códigos para não perder o acesso."
                      : "Vamos gerar 8 códigos de uso único. Se você perder o acesso ao e-mail, use um deles em /recuperar para criar uma senha nova."}
                  </p>
                </div>
              </div>
            )}
            {hasActiveCodes ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={close} disabled={loading} className="w-full font-mono uppercase">
                  <Check className="mr-2 h-4 w-4" /> Entendi, continuar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full font-mono uppercase sm:w-auto"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Gerando..." : "Gerar novos"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={handleGenerate} disabled={loading} className="w-full font-mono uppercase">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Gerando..." : "Gerar meus códigos"}
                </Button>
                <Button variant="ghost" onClick={close} disabled={loading} className="w-full font-mono uppercase sm:w-auto">
                  Depois
                </Button>
              </div>
            )}
            {hasActiveCodes && (
              <p className="text-[11px] text-amber-400">
                Gerar novos códigos invalida imediatamente os antigos.
              </p>
            )}
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
