import { useQuery } from "@tanstack/react-query";
import { getAnnouncements } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Calendar, Tag, ChevronRight, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AnnouncementsSection() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => getAnnouncements(),
  });

  const categories = Array.from(new Set(announcements?.map(a => a.severity) || []));

  const filtered = announcements?.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || 
                         a.body.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || a.severity === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) return <div className="animate-pulse h-48 bg-muted rounded-xl" />;
  if (!announcements || announcements.length === 0) return null;

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
          {filtered?.map((item) => (
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
                  <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground/60 uppercase">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(item.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                    {/* In a real app we'd map tags if we had them in the DB */}
                    <span className="flex items-center gap-1.5">
                      <Tag className="h-3 w-3" />
                      {item.severity}
                    </span>
                  </div>
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
