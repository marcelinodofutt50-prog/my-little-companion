import { useQuery } from "@tanstack/react-query";
import { listMyAnnouncements } from "@/lib/announcements.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Calendar, Tag, ChevronRight, Search, Filter, Image as ImageIcon, Paperclip, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AnnouncementsSection() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: announcements, isLoading, refetch, error } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      try {
        return await listMyAnnouncements();
      } catch (err: any) {
        if (err?._schemaError) {
          const data: any = [];
          data._schemaError = err._schemaError;
          return data;
        }
        throw err;
      }
    },
  });


  // Real-time subscription for new announcements
  useEffect(() => {
    const channel = supabase
      .channel('announcements-live')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'announcements' }, 
        (payload) => {
          const newAnn = payload.new as any;
          if (newAnn.is_active) {
            refetch();
            toast.info(`Novo Comunicado: ${newAnn.title}`, {
              description: "Um novo aviso corporativo foi publicado.",
              action: {
                label: "Ver",
                onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const categories = Array.from(new Set(announcements?.map((a: any) => a.severity) || [])) as string[];

  const filtered = announcements?.filter((a: any) => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || 
                         a.body.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || a.severity === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) return <div className="animate-pulse h-48 bg-muted rounded-xl" />;
  if (!announcements || announcements.length === 0) {
    // Only show the system error card if announcements fail or are empty, and we have a specific error
    const errorMsg = (announcements as any)?._schemaError;
    if (errorMsg) {
      return (
        <Card className="border-red-500/20 bg-red-500/5 backdrop-blur-sm border mb-4">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Megaphone className="h-4 w-4 text-red-500 animate-pulse" />
              <div>
                <h4 className="font-mono text-xs font-bold text-red-500 uppercase">Aviso do Sistema</h4>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Instabilidade na sincronização de dados detectada ({errorMsg}). Alguns recursos podem estar limitados.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  }


  return (
    <Card className="border-border/40 bg-card/30 backdrop-blur-md overflow-hidden">
      <CardHeader className="border-b border-border/40 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <CardTitle className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
            Comunicados Corporativos
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Buscar..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-32 lg:w-48 pl-7 text-[10px] bg-background/40 border-border/40 focus:border-primary/40 transition-all"
            />
          </div>
          {categories.length > 0 && (
            <div className="flex gap-1">
              {categories.map(cat => (
                <Button 
                  key={cat}
                  variant={selectedCategory === cat ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className="h-7 px-2 text-[9px] font-mono uppercase"
                >
                  {cat}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/40">
          {filtered?.map((item: any) => (
            <div key={item.id} className="group p-6 hover:bg-white/5 transition-all relative overflow-hidden">
               {/* Impact indicator */}
               <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                 item.severity === 'critical' ? 'bg-red-500' : 
                 item.severity === 'warning' ? 'bg-amber-500' : 'bg-primary'
               }`} />
               
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[8px] font-mono uppercase tracking-widest border-primary/30 text-primary">
                      {item.severity}
                    </Badge>
                    <h3 className="text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                    {item.body}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-[9px] font-mono text-muted-foreground/60 uppercase">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(item.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Tag className="h-3 w-3" />
                        <div className="flex gap-1">
                          {item.tags.map((tag: string) => (
                            <span key={tag} className="border border-border/40 px-1 rounded-sm">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {item.image_url && (
                    <div className="mt-3 relative w-full aspect-video md:aspect-[21/9] rounded-lg border border-border/40 overflow-hidden bg-black/20">
                      <img 
                        src={item.image_url} 
                        alt={item.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {item.attachment_url && (
                    <a 
                      href={item.attachment_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-[10px] font-mono uppercase tracking-widest text-primary"
                    >
                      <Paperclip className="h-3 w-3" />
                      {item.attachment_name || "Baixar Anexo"}
                      <Download className="h-3 w-3 ml-1" />
                    </a>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity self-end md:self-center">
                  Detalhes <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {filtered?.length === 0 && (
            <div className="p-12 text-center text-muted-foreground font-mono text-[10px] uppercase">
              Nenhum comunicado encontrado
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
