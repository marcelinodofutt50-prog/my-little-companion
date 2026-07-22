import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Upload, ShieldCheck, Clock, Loader2, CheckCircle2, XCircle, Download, X, AlertTriangle, Sparkles, Gift, FileArchive } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TutorialHintDialog } from "@/components/TutorialHintDialog";
import ppConfigAsset from "@/assets/play-protect-config.png.asset.json";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  getPlayProtectStatus,
  createApkJob,
  listApkJobs,
  cancelApkJob,
  getApkResultDownload,
} from "@/lib/apk-jobs.functions";

export const Route = createFileRoute("/_authenticated/play-protect")({
  head: () => ({
    meta: [
      { title: "Play Protect — Shadow" },
      { name: "description", content: "Bypass Play Protect: envie o APK, receba a versão tratada." },
    ],
  }),
  component: PlayProtectPage,
});

const MAX_MB = 200;

type Job = {
  id: string;
  status: "queued" | "claimed" | "sending" | "processing" | "done" | "failed" | "expired" | "cancelled";
  source_filename: string;
  source_size_bytes: number;
  result_filename: string | null;
  result_size_bytes: number | null;
  is_free_trial: boolean;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

const STATUS_META: Record<Job["status"], { label: string; tone: string; icon: any }> = {
  queued:     { label: "Na fila",       tone: "text-amber-400 border-amber-500/40 bg-amber-500/10",  icon: Clock },
  claimed:    { label: "Preparando",    tone: "text-sky-400 border-sky-500/40 bg-sky-500/10",        icon: Loader2 },
  sending:    { label: "Enviando",      tone: "text-sky-400 border-sky-500/40 bg-sky-500/10",        icon: Upload },
  processing: { label: "Processando",   tone: "text-primary border-primary/40 bg-primary/10",        icon: Loader2 },
  done:       { label: "Pronto",        tone: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10", icon: CheckCircle2 },
  failed:     { label: "Falhou",        tone: "text-red-400 border-red-500/40 bg-red-500/10",        icon: XCircle },
  expired:    { label: "Expirado",      tone: "text-muted-foreground border-border bg-muted/40",     icon: AlertTriangle },
  cancelled:  { label: "Cancelado",     tone: "text-muted-foreground border-border bg-muted/40",     icon: X },
};

function fmtBytes(n: number) {
  if (!n) return "—";
  const mb = n / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;
}

function PlayProtectPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getPlayProtectStatus>> | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const statusFn = useServerFn(getPlayProtectStatus);
  const createFn = useServerFn(createApkJob);
  const listFn = useServerFn(listApkJobs);
  const cancelFn = useServerFn(cancelApkJob);
  const dlFn = useServerFn(getApkResultDownload);

  async function refresh() {
    const [s, l] = await Promise.all([statusFn(), listFn()]);
    setStatus(s);
    setJobs(l as Job[]);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      if (cancelled) return;
      const uid = sess.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
        setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
      }
      await refresh();
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime updates to my jobs
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`apk_jobs:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "apk_jobs", filter: `user_id=eq.${userId}` }, (payload) => {
        setJobs((prev) => {
          const row = (payload.new ?? payload.old) as Job;
          if (payload.eventType === "DELETE") return prev.filter((j) => j.id !== row.id);
          const next = prev.filter((j) => j.id !== row.id);
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") next.unshift(row);
          return next.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        });
        // refresh entitlement counters
        statusFn().then(setStatus).catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const activeCount = useMemo(
    () => jobs.filter((j) => ["queued", "claimed", "sending", "processing"].includes(j.status)).length,
    [jobs],
  );

  async function handleFile(file: File) {
    if (!file) return;
    if (!/\.apk$/i.test(file.name)) { toast.error("Selecione um arquivo .apk"); return; }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Máximo ${MAX_MB} MB`); return; }
    if (!status?.canSubmit) {
      toast.error(status?.blockReason || "Envio bloqueado.");
      return;
    }
    setUploading(true);
    setUploadPct(0);
    try {
      const job = await createFn({ data: { filename: file.name, sizeBytes: file.size } });
      // Upload direct to signed URL via XHR (progress)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", job.uploadUrl, true);
        xhr.setRequestHeader("Content-Type", "application/vnd.android.package-archive");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload falhou (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Erro de rede no upload"));
        xhr.send(file);
      });
      toast.success("APK enviado. Aguarde o processamento.");
      setTutorialOpen(true);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha no envio");
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }

  async function onDownload(id: string) {
    try {
      const { url, filename } = await dlFn({ data: { id } });
      const a = document.createElement("a");
      a.href = url;
      if (filename) a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar download");
    }
  }

  async function onCancel(id: string) {
    try {
      await cancelFn({ data: { id } });
      toast.success("Job cancelado");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao cancelar");
    }
  }

  const hasPending = (status?.pendingJobs ?? 0) > 0;
  const banner = status && !status.hasActivePlan && status.freeTrialUsed && !hasPending;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar isAdmin={isAdmin} />
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h1 className="font-display text-lg font-semibold tracking-tight">Play Protect</h1>
            </div>
            <div className="ml-auto text-xs font-mono uppercase tracking-widest text-muted-foreground">
              fila: <span className="text-foreground">{activeCount}</span>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
            {/* Entitlement */}
            <section className="rounded-lg border border-border/70 bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Status da conta</p>
                  <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
                    {status?.hasActivePlan ? "Play Protect Mensal ativo" : status?.canSubmit ? "1 teste grátis disponível" : "Assinatura necessária"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status?.hasActivePlan
                      ? "Envios ilimitados enquanto o plano estiver ativo."
                      : status?.canSubmit
                      ? "Você pode enviar 1 APK grátis. Depois, ative o plano mensal (R$ 450) para continuar."
                      : "Você já usou seu envio grátis. Ative o plano Play Protect Mensal para enviar mais APKs."}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {!status?.hasActivePlan && (
                    <Button onClick={() => navigate({ to: "/planos" })} className="gap-2">
                      <Sparkles className="h-4 w-4" /> Ativar plano — R$ 450/mês
                    </Button>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Gift className="h-3.5 w-3.5" />
                    Teste grátis: {status?.freeTrialUsed ? <span className="text-foreground">utilizado</span> : <span className="text-emerald-400">disponível</span>}
                  </div>
                </div>
              </div>
              {hasPending && (
                <div className="mt-4 flex items-start gap-2 rounded border border-sky-500/40 bg-sky-500/10 p-3 text-sm text-sky-200">
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                  <div>Você tem <span className="font-semibold">{status?.pendingJobs}</span> APK em processamento. Aguarde finalizar para enviar o próximo — atualizamos essa tela em tempo real.</div>
                </div>
              )}
              {banner && (
                <div className="mt-4 flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>Novos envios exigem o plano mensal. Assine e volte a esta aba — envios são liberados imediatamente após a confirmação.</div>
                </div>
              )}
            </section>

            {/* Config guide */}
            <section className="rounded-lg border border-primary/40 bg-card p-5">
              <div className="grid gap-5 md:grid-cols-[1fr_320px]">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">// pré-requisito no build</p>
                  <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">
                    Para funcionar essas duas funções
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Antes de enviar o APK, gere o build do Shadow com as duas opções abaixo <span className="text-foreground font-semibold">desativadas</span>.
                    Se elas ficarem ativas o bypass do Play Protect não é aplicado corretamente.
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-sm border border-red-400/60" />
                      <div>
                        <span className="font-mono text-[11px] uppercase tracking-widest text-red-300">DEX-Protetor</span>
                        <span className="ml-2 text-muted-foreground">— deixe desativado.</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-sm border border-red-400/60" />
                      <div>
                        <span className="font-mono text-[11px] uppercase tracking-widest text-red-300">Criptografar APK</span>
                        <span className="ml-2 text-muted-foreground">— deixe desativado.</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2 opacity-70">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-sm border border-red-400/60" />
                      <div>
                        <span className="font-mono text-[11px] uppercase tracking-widest text-red-300">Pump size</span>
                        <span className="ml-2 text-muted-foreground">— deixe desativado.</span>
                      </div>
                    </li>
                  </ul>
                </div>
                <a
                  href={ppConfigAsset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative block overflow-hidden rounded-lg border border-border/70 bg-black/40"
                >
                  <img
                    src={ppConfigAsset.url}
                    alt="Configuração do build: desative DEX-Protetor e Criptografar APK"
                    className="w-full transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-center font-mono text-[10px] uppercase tracking-widest text-red-300">
                    desative as duas opções antes do build
                  </div>
                </a>
              </div>
            </section>

            {/* Upload */}
            <section className="rounded-lg border border-border/70 bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Enviar APK</p>
                  <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">Bypass Play Protect</h3>
                </div>
                <span className="text-xs text-muted-foreground">máx {MAX_MB} MB · .apk</span>
              </div>

              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-primary/5"
                } ${!status?.canSubmit || uploading ? "pointer-events-none opacity-60" : ""}`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  className="hidden"
                  disabled={!status?.canSubmit || uploading}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {uploading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <div className="text-sm">Enviando… {uploadPct}%</div>
                    <div className="h-1.5 w-64 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary transition-[width]" style={{ width: `${uploadPct}%` }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid h-14 w-14 place-items-center rounded-full border border-primary/40 bg-primary/10">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-sm">
                      <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold text-primary underline-offset-4 hover:underline">
                        Clique para selecionar
                      </button>{" "}
                      ou arraste o APK aqui
                    </div>
                    <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                      1 APK por vez · processado por fila
                    </div>
                  </>
                )}
              </label>
            </section>

            {/* Jobs */}
            <section className="rounded-lg border border-border/70 bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Histórico</p>
                  <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">Meus jobs</h3>
                </div>
                <div className="text-xs text-muted-foreground">{jobs.length} total</div>
              </div>

              {jobs.length === 0 ? (
                <div className="mt-6 rounded border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Nenhum envio ainda. Suba seu primeiro APK acima.
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  <AnimatePresence initial={false}>
                    {jobs.map((j) => {
                      const meta = STATUS_META[j.status];
                      const Icon = meta.icon;
                      const busy = ["claimed", "sending", "processing"].includes(j.status);
                      return (
                        <motion.li
                          key={j.id}
                          layout
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="flex flex-wrap items-center gap-3 rounded border border-border/70 bg-background/40 p-3"
                        >
                          <FileArchive className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-sm font-medium">{j.source_filename}</div>
                              {j.is_free_trial && (
                                <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-emerald-400">
                                  trial
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {fmtBytes(j.source_size_bytes)} · {new Date(j.created_at).toLocaleString("pt-BR")}
                              {j.error_message && <span className="ml-2 text-red-400">— {j.error_message}</span>}
                            </div>
                          </div>
                          <div className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${meta.tone}`}>
                            <Icon className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                            {meta.label}
                          </div>
                          {j.status === "done" && (
                            <Button size="sm" onClick={() => onDownload(j.id)} className="gap-1.5">
                              <Download className="h-3.5 w-3.5" /> Baixar
                            </Button>
                          )}
                          {j.status === "queued" && (
                            <Button size="sm" variant="ghost" onClick={() => onCancel(j.id)} className="gap-1.5 text-muted-foreground">
                              <X className="h-3.5 w-3.5" /> Cancelar
                            </Button>
                          )}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}

              <p className="mt-4 text-[11px] text-muted-foreground">
                Os arquivos ficam disponíveis por 48h e depois são removidos automaticamente.
              </p>
            </section>
          </main>
        </SidebarInset>
      </div>
      <TutorialHintDialog
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        title="APK enviado — tem dúvidas?"
        message="Enquanto processamos seu APK, dá uma olhada nos tutoriais do canal. Lá explicamos como desativar o antivírus, instalar o app e evitar bloqueios do Play Protect."
      />
    </SidebarProvider>
  );
}
