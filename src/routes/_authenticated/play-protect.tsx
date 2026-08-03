import { createFileRoute, Link } from "@tanstack/react-router";
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
import { getMyBuildJobs, createBuildJob } from "@/lib/apk-builder.functions";
import { fetchMyRole, isStaffRole } from "@/lib/roles";
import { useQuery } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { tierFromPlanSlug, getTierFeatures } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/play-protect")({
  head: () => ({ meta: [{ title: "Shadow Play Protect — APK Builder" }] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["build-jobs"],
      queryFn: () => getMyBuildJobs(),
    });
  },
  component: PlayProtectPage,
});

function PlayProtectPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const getJobs = useServerFn(getMyBuildJobs);
  const createJob = useServerFn(createBuildJob);

  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [appName, setAppName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<File | null>(null);

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

  const { data: license } = useQuery({
    queryKey: ['my-license', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('licenses')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (error) {
          console.error("Supabase license query error:", error);
          return null;
        }
        return data;
      } catch (err) {
        console.error("Error fetching license:", err);
        return null;
      }
    }
  });

  const tier = tierFromPlanSlug(license?.plan_slug);
  const features = getTierFeatures(tier);
  const hasAccess = features.bypass_play_protect || isAdmin;

  const { data: jobs } = useSuspenseQuery({
    queryKey: ["build-jobs"],
    queryFn: () => getJobs(),
    refetchInterval: (query) => {
      const anyProcessing = query.state.data?.some(j => j.status === 'processing' || j.status === 'pending');
      return anyProcessing ? 3000 : false;
    }
  });


  const handleBuild = async () => {
    if (!selectedFile || !appName) {
      toast.error("Por favor, preencha o nome do app e selecione um APK.");
      return;
    }

    setUploading(true);
    try {
      // 1. Upload APK to storage
      const apkPath = `builds/${crypto.randomUUID()}_${selectedFile.name}`;
      const { data: apkData, error: apkError } = await supabase.storage
        .from("shadow-builds")
        .upload(apkPath, selectedFile);

      if (apkError) throw apkError;

      // 2. Upload Icon (optional)
      let iconUrl = "";
      if (selectedIcon) {
        const iconPath = `icons/${crypto.randomUUID()}_${selectedIcon.name}`;
        const { data: iconData, error: iconError } = await supabase.storage
          .from("shadow-builds")
          .upload(iconPath, selectedIcon);
        if (!iconError) {
          iconUrl = supabase.storage.from("shadow-builds").getPublicUrl(iconPath).data.publicUrl;
        }
      }

      const apkUrl = supabase.storage.from("shadow-builds").getPublicUrl(apkPath).data.publicUrl;

      // 3. Create Job
      await createJob({
        data: {
          appName,
          originalApkUrl: apkUrl,
          originalIconUrl: iconUrl || undefined,
        }
      });

      toast.success("Build iniciada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["build-jobs"] });
      setAppName("");
      setSelectedFile(null);
      setSelectedIcon(null);
    } catch (error: any) {
      toast.error("Erro ao iniciar build: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="client-enterprise flex min-h-screen w-full">
        <AppSidebar isAdmin={isAdmin} />
        <SidebarInset className="min-w-0 flex-1">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
            <div className="osint-label text-primary/80">{t("pp.title" as any)}</div>
          </header>

          <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <h1 className="rainbow-text font-display text-3xl font-bold tracking-tight">{t("pp.header" as any)}</h1>
              <p className="mt-2 text-muted-foreground">{t("pp.desc" as any)}</p>
              {!hasAccess && (
                <div className="mt-4 flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {t("pp.no_access" as any)}
                </div>
              )}
            </motion.div>

            <div className={`grid gap-6 md:grid-cols-2 ${!hasAccess ? 'pointer-events-none opacity-50 grayscale' : ''}`}>

              {/* Build Section */}
              <div className="osint-panel p-6">
                <div className="mb-6 flex items-center gap-3">
                  <Settings className="h-5 w-5 text-primary" />
                  <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">Nova Operação</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block font-mono text-[10px] uppercase text-muted-foreground">Nome do Aplicativo</label>
                    <Input
                      placeholder="Ex: Banco Shadow"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      className="rounded-none border-border/60 bg-background/50"
                    />
                  </div>

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

                  <div>
                    <label className="mb-2 block font-mono text-[10px] uppercase text-muted-foreground">Ícone Customizado (Opcional)</label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSelectedIcon(e.target.files?.[0] || null)}
                        className="hidden"
                        id="icon-upload"
                      />
                      <label
                        htmlFor="icon-upload"
                        className="flex cursor-pointer items-center justify-between border border-dashed border-border/60 bg-background/50 p-3 transition-colors hover:bg-background/80"
                      >
                        <span className="truncate text-sm text-muted-foreground">
                          {selectedIcon ? selectedIcon.name : "Selecionar Ícone..."}
                        </span>
                        <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </label>
                    </div>
                  </div>


                  <Button
                    onClick={handleBuild}
                    disabled={uploading || !selectedFile || !appName}
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
                      O APK Tool processa os arquivos em servidores remotos. O tempo estimado de build é de 2 a 5 minutos.
                    </p>
                  </div>
                </div>
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
                          <span className="font-display text-sm font-bold text-foreground">{job.app_name}</span>
                          <span className={`font-mono text-[9px] uppercase tracking-tighter ${
                            job.status === 'completed' ? 'text-neon' : 
                            job.status === 'failed' ? 'text-danger' : 'text-amber-400'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        
                        {(job.status === 'pending' || job.status === 'processing') && (
                          <div className="space-y-1.5">
                            <Progress value={job.progress} className="h-1" />
                            <div className="flex justify-between font-mono text-[8px] text-muted-foreground/60">
                              <span>Processando em cluster...</span>
                              <span>{job.progress}%</span>
                            </div>
                          </div>
                        )}

                        {job.status === 'completed' && (
                          <div className="flex items-center justify-between gap-2 mt-2">
                            <div className="flex items-center gap-1.5 text-neon/80">
                              <CheckCircle2 className="h-3 w-3" />
                              <span className="font-mono text-[9px] uppercase">Pronto para implantação</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-none px-2 font-mono text-[9px] hover:text-neon"
                              onClick={() => job.output_apk_url && window.open(job.output_apk_url, '_blank')}
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
                <h2 className="text-xl font-bold font-display">Serviço Gerenciado (Play Protect Cloak)</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Precisa de um bypass manual persistente ou suporte para APKs complexos? 
                O serviço gerenciado permite que você envie o arquivo para nossa equipe processar.
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
