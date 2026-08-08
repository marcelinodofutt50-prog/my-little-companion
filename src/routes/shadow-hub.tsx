import { createFileRoute, Link, useSuspenseQuery } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { listPublicTutorials } from "@/lib/public-tutorials.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Play, ArrowRight, Tag, Calendar, Info } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const tutorialsQueryOptions = (params: any) => 
  queryOptions({
    queryKey: ['public-tutorials', params],
    queryFn: () => listPublicTutorials({ data: params }),
  });

export const Route = createFileRoute("/shadow-hub")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page || 1),
    category: String(search.category || "Tudo"),
    search: String(search.search || ""),
  }),
  loader: ({ context, search }) => 
    context.queryClient.ensureQueryData(tutorialsQueryOptions(search)),
  component: ShadowHubPage,
});

function ShadowHubPage() {
  const searchParams = Route.useSearch();
  const { data } = useSuspenseQuery(tutorialsQueryOptions(searchParams));
  const [searchTerm, setSearchTerm] = useState(searchParams.search);
  const navigate = Route.useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ search: (prev: any) => ({ ...prev, search: searchTerm, page: 1 }) });
  };

  const categories = ["Tudo", "Frontend", "Backend", "Mobile", "DevOps", "Cybersecurity", "OSINT"];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <header className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary mb-6"
            >
              Shadow Knowledge Base
            </motion.div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 rgb-text animate-rgb-text">
              Shadow Hub
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Explore nosso diretório de conhecimento técnico. De infraestrutura VPS a técnicas avançadas de segurança digital.
            </p>
          </header>

          {/* Controls */}
          <div className="enterprise-surface p-6 rounded-2xl mb-12 flex flex-col md:flex-row gap-6 items-center justify-between border-primary/10">
            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={searchParams.category === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => navigate({ search: (prev: any) => ({ ...prev, category: cat, page: 1 }) })}
                  className={`rounded-full px-5 h-9 text-[10px] font-mono uppercase tracking-widest transition-all ${
                    searchParams.category === cat ? "shadow-lg shadow-primary/20" : "border-primary/10 hover:border-primary/30"
                  }`}
                >
                  {cat}
                </Button>
              ))}
            </div>
            
            <form onSubmit={handleSearch} className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar no Hub..."
                className="pl-10 h-11 bg-primary/5 border-primary/10 rounded-full text-xs font-mono uppercase tracking-widest focus:ring-primary/20"
              />
            </form>
          </div>

          {/* Grid */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {data.items.map((tutorial: any, idx: number) => (
                <motion.div
                  key={tutorial.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Link 
                    to="/tutorial/$id" 
                    params={{ id: tutorial.id }}
                    className="group block h-full enterprise-surface rounded-2xl overflow-hidden border-border/40 hover:border-primary/40 transition-all hover:shadow-2xl hover:shadow-primary/5"
                  >
                    <div className="aspect-video relative overflow-hidden bg-black/40">
                      {tutorial.image_url ? (
                        <img 
                          src={tutorial.image_url} 
                          alt={tutorial.title} 
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center opacity-20">
                          <Play className="h-12 w-12 text-primary" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                      <div className="absolute bottom-4 left-4">
                        <span className="rounded-full bg-primary/20 backdrop-blur-md border border-primary/30 px-3 py-1 text-[8px] font-mono uppercase tracking-widest text-primary">
                          {tutorial.category}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors line-clamp-1">
                        {tutorial.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-6 line-clamp-2 leading-relaxed">
                        {tutorial.description}
                      </p>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-border/40">
                        <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground uppercase tracking-tighter">
                          <Calendar className="h-3 w-3" />
                          {new Date(tutorial.created_at).toLocaleDateString('pt-BR')}
                        </div>
                        <div className="text-primary group-hover:translate-x-1 transition-transform">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {data.items.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-primary/10 rounded-3xl">
              <Info className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-bold text-foreground font-mono uppercase tracking-widest">Nenhum sinal encontrado</h3>
              <p className="text-muted-foreground mt-2">Tente ajustar seus filtros ou busca.</p>
            </div>
          )}

          {/* Pagination */}
          {data.total > data.limit && (
            <div className="mt-16 flex justify-center gap-2">
              {Array.from({ length: Math.ceil(data.total / data.limit) }).map((_, i) => (
                <Button
                  key={i}
                  variant={searchParams.page === i + 1 ? "default" : "outline"}
                  size="sm"
                  onClick={() => navigate({ search: (prev: any) => ({ ...prev, page: i + 1 }) })}
                  className="w-10 h-10 rounded-full font-mono"
                >
                  {i + 1}
                </Button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
