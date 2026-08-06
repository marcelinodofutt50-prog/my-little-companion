import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Video, Youtube, ChevronRight, Play, BookOpen, Star, Info, CheckCircle2, Circle, Trophy } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { listTutorials } from "@/lib/tutorials.functions";
import { getTutorialProgress, toggleTutorialStatus } from "@/lib/tutorial-progress.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tutoriais")({
  head: () => ({ meta: [{ title: "Tutorials Hub — Shadow" }] }),
  component: TutorialsPage,
});

function TutorialsPage() {
  const [tutorials, setTutorials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  
  const listFn = useServerFn(listTutorials);
  const getProgressFn = useServerFn(getTutorialProgress);
  const toggleFn = useServerFn(toggleTutorialStatus);

  useEffect(() => {
    Promise.all([listFn(), getProgressFn()])
      .then(([tData, pData]) => {
        setTutorials(tData);
        setCompletedIds(pData);
      })
      .finally(() => setLoading(false));
  }, []);

  const progress = useMemo(() => {
    if (tutorials.length === 0) return 0;
    return Math.round((completedIds.length / tutorials.length) * 100);
  }, [tutorials, completedIds]);

  const handleToggle = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const isCompleted = completedIds.includes(id);
    const newIds = isCompleted 
      ? completedIds.filter(i => i !== id)
      : [...completedIds, id];
    
    setCompletedIds(newIds);
    try {
      await toggleFn({ data: { tutorialId: id, completed: !isCompleted } });
      toast.success(isCompleted ? "Marcado como não assistido" : "Tutorial concluído!");
    } catch (err) {
      setCompletedIds(completedIds); // Revert on error
      toast.error("Erro ao atualizar progresso");
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#030711]">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <SiteHeader />
          <div className="container mx-auto px-4 py-8">
            <div className="mb-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="text-center md:text-left">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                    Shadow Knowledge Base
                  </div>
                  <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                    Centro de <span className="text-primary italic">Treinamento</span>
                  </h1>
                  <p className="mt-4 max-w-2xl text-muted-foreground">
                    Domine o ecossistema Shadow. De configurações básicas a técnicas avançadas de bypass e gestão de ativos.
                  </p>
                </div>
                
                {tutorials.length > 0 && (
                  <div className="w-full md:w-64 space-y-3 enterprise-surface p-4 rounded-xl border-primary/20 bg-primary/5">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
                      <span className="flex items-center gap-2"><Trophy className="h-3 w-3 text-primary" /> Progresso Global</span>
                      <span className="text-primary">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5 bg-primary/10" />
                    <div className="text-[9px] text-muted-foreground text-center uppercase tracking-tighter">
                      {completedIds.length} de {tutorials.length} módulos finalizados
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selected && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12"
              >
                <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card/40 backdrop-blur-xl shadow-2xl">
                  <div className="aspect-video w-full bg-black relative">
                    {selected.video_url ? (
                      <video 
                        src={selected.video_url} 
                        controls 
                        className="h-full w-full"
                        poster={selected.image_url}
                      />
                    ) : selected.youtube_url ? (
                      <iframe
                        className="h-full w-full"
                        src={selected.youtube_url.replace("watch?v=", "embed/")}
                        title={selected.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-muted-foreground">
                        <Video className="h-16 w-16 opacity-20" />
                        <p className="font-mono text-xs uppercase tracking-widest">Sem mídia disponível</p>
                      </div>
                    )}
                  </div>
                  <div className="p-6 md:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{selected.category}</div>
                        <h2 className="text-2xl font-bold text-foreground md:text-3xl">{selected.title}</h2>
                        <p className="text-muted-foreground leading-relaxed">{selected.description}</p>
                      </div>
                      <div className="flex gap-2">
                         <Button 
                           variant={completedIds.includes(selected.id) ? "default" : "outline"} 
                           size="sm" 
                           onClick={(e) => handleToggle(e, selected.id)}
                           className="gap-2"
                         >
                           {completedIds.includes(selected.id) ? (
                             <><CheckCircle2 className="h-4 w-4" /> Concluído</>
                           ) : (
                             <><Circle className="h-4 w-4" /> Marcar como Assistido</>
                           )}
                         </Button>
                         {selected.youtube_url && (
                           <Button variant="outline" size="sm" asChild className="gap-2 border-red-500/20 hover:bg-red-500/10 hover:text-red-500">
                             <a href={selected.youtube_url} target="_blank" rel="noopener noreferrer">
                               <Youtube className="h-4 w-4" /> Detalhes no YouTube
                             </a>
                           </Button>
                         )}
                         <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Fechar</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tutorials.map((t, idx) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card 
                    className="group h-full cursor-pointer overflow-hidden border-border/40 bg-card/40 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                    onClick={() => {
                      setSelected(t);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <div className="relative aspect-video w-full overflow-hidden">
                      {t.image_url ? (
                        <img 
                          src={t.image_url} 
                          alt={t.title} 
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted/20">
                          <Video className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-90" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                         <div className="flex gap-2">
                           <div className="rounded bg-primary/20 px-2 py-0.5 backdrop-blur-md border border-primary/20">
                             <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">{t.category}</span>
                           </div>
                           {completedIds.includes(t.id) && (
                             <div className="rounded bg-emerald-500/20 px-2 py-0.5 backdrop-blur-md border border-emerald-500/20">
                               <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-500 font-bold flex items-center gap-1">
                                 <CheckCircle2 className="h-2 w-2" /> Done
                               </span>
                             </div>
                           )}
                         </div>
                         <div className="flex gap-2">
                           <button 
                             onClick={(e) => handleToggle(e, t.id)}
                             className="rounded-full bg-black/40 p-2 backdrop-blur-md hover:bg-primary/20 transition-colors border border-white/5"
                           >
                             {completedIds.includes(t.id) ? (
                               <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                             ) : (
                               <Circle className="h-3 w-3 text-white/40" />
                             )}
                           </button>
                           <div className="rounded-full bg-white/10 p-2 backdrop-blur-md opacity-0 transition-all group-hover:opacity-100">
                             <Play className="h-3 w-3 fill-white text-white" />
                           </div>
                         </div>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">{t.title}</h3>
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{t.description}</p>
                      <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase">
                           <BookOpen className="h-3 w-3" /> Guia Prático
                        </div>
                        <ChevronRight className="h-3 w-3 text-primary transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {loading && Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-xl bg-card/40 animate-pulse border border-border/20" />
              ))}
            </div>

            {!loading && tutorials.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="rounded-full bg-muted/10 p-6">
                  <Info className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-foreground">Hub em Manutenção</h3>
                <p className="mt-2 text-muted-foreground">O admin ainda não publicou tutoriais nesta seção.</p>
                <Button variant="outline" className="mt-6" asChild>
                   <Link to="/dashboard">Voltar ao Console</Link>
                </Button>
              </div>
            )}

            <div className="mt-20 rounded-2xl border border-border/40 bg-card/20 p-8 text-center">
              <h3 className="text-xl font-bold text-foreground">Dúvidas Específicas?</h3>
              <p className="mt-2 text-muted-foreground">Se não encontrar o que procura aqui, nosso time de suporte está pronto para ajudar via console.</p>
              <div className="mt-6 flex justify-center gap-4">
                <Button asChild className="bg-primary hover:bg-primary/90 rounded-full px-8">
                  <Link to="/suporte">Abrir Ticket</Link>
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
