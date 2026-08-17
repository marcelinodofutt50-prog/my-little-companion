import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getPublicTutorialById } from "@/lib/public-tutorials.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Video, Youtube, Calendar, Tag, BarChart } from "lucide-react";
import { motion } from "framer-motion";
import { useTutorialMedia } from "@/lib/tutorial-media";

const tutorialQueryOptions = (id: string) => 
  queryOptions({
    queryKey: ['public-tutorial', id],
    queryFn: () => getPublicTutorialById({ data: { id } }),
  });

export const Route = createFileRoute("/tutorial/$id")({
  loader: ({ context, params }) => 
    context.queryClient.ensureQueryData(tutorialQueryOptions(params.id)),
  component: TutorialDetailsPage,
});

function TutorialDetailsPage() {
  const { id } = Route.useParams();
  const { data: tutorial } = useSuspenseQuery(tutorialQueryOptions(id));
  const videoUrl = useTutorialMedia(tutorial.video_url);
  const posterUrl = useTutorialMedia(tutorial.image_url);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main className="container mx-auto px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <Button variant="ghost" asChild className="mb-8 hover:bg-primary/5">
            <Link to="/shadow-hub" search={{ page: 1, category: 'Tudo', search: '' }}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Voltar para a Lista
            </Link>
          </Button>

          <div className="enterprise-surface overflow-hidden rounded-2xl border border-primary/20 bg-card/40 backdrop-blur-xl shadow-2xl mb-8">
            <div className="aspect-video w-full bg-black relative">
              {tutorial.video_url ? (
                videoUrl ? (
                  <video
                    key={videoUrl}
                    src={videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    controlsList="nodownload"
                    className="h-full w-full object-contain"
                    poster={posterUrl || undefined}
                  >
                    Seu navegador não suporta a reprodução de vídeos.
                  </video>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground font-mono text-[10px] uppercase tracking-[0.3em]">
                    Preparando reprodução...
                  </div>
                )
              ) : tutorial.youtube_url ? (
                <iframe
                  className="h-full w-full"
                  src={tutorial.youtube_url.includes("embed") ? tutorial.youtube_url : tutorial.youtube_url.replace("watch?v=", "embed/")}
                  title={tutorial.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-muted-foreground bg-primary/5">
                  <Video className="h-16 w-16 opacity-10" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em]">Sinal de Mídia Ausente</p>
                </div>
              )}
            </div>

            <div className="p-8">
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-primary">
                  <Tag className="h-3 w-3" /> {tutorial.category}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-mono uppercase tracking-widest">
                  <Calendar className="h-3 w-3" /> {tutorial.created_at ? new Date(tutorial.created_at).toLocaleDateString('pt-BR') : 'Data não disponível'}
                </div>
              </div>

              <h1 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight text-foreground">
                {tutorial.title}
              </h1>

              <div className="prose prose-invert max-w-none">
                <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {tutorial.description}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
