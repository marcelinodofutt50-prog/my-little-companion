import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listStaffTrainings,
  setStaffTrainingProgress,
  saveStaffTraining,
  deleteStaffTraining,
  getStaffTrainingOverview,
} from "@/lib/staff-training.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const LEVEL_LABEL: Record<string, string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

type Draft = {
  id?: string;
  title: string;
  description: string;
  content: string;
  category: string;
  level: "basico" | "intermediario" | "avancado";
  video_url: string;
  estimated_minutes: number;
  display_order: number;
  is_published: boolean;
};

const EMPTY: Draft = {
  title: "",
  description: "",
  content: "",
  category: "onboarding",
  level: "basico",
  video_url: "",
  estimated_minutes: 10,
  display_order: 0,
  is_published: true,
};

export function StaffAcademyPanel({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("todos");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showTeam, setShowTeam] = useState(false);

  const fetchList = useServerFn(listStaffTrainings);
  const progressFn = useServerFn(setStaffTrainingProgress);
  const saveFn = useServerFn(saveStaffTraining);
  const deleteFn = useServerFn(deleteStaffTraining);
  const overviewFn = useServerFn(getStaffTrainingOverview);

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-academy"],
    queryFn: () => fetchList(),
    retry: false,
  });

  const canManage = data?.canManage ?? false;
  const items = data?.items ?? [];

  const { data: overview } = useQuery({
    queryKey: ["staff-academy-overview"],
    queryFn: () => overviewFn(),
    enabled: canManage && showTeam,
    retry: false,
  });

  const categories = useMemo(
    () => ["todos", ...Array.from(new Set(items.map((i: any) => i.category)))],
    [items],
  );
  const visible = filter === "todos" ? items : items.filter((i: any) => i.category === filter);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["staff-academy"] });
    queryClient.invalidateQueries({ queryKey: ["staff-academy-overview"] });
  };

  const toggleDone = useMutation({
    mutationFn: (v: { trainingId: string; completed: boolean }) => progressFn({ data: v }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar seu progresso"),
  });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveFn({
        data: {
          ...d,
          video_url: d.video_url.trim() || null,
          estimated_minutes: Number(d.estimated_minutes) || 10,
          display_order: Number(d.display_order) || 0,
        },
      }),
    onSuccess: () => {
      toast.success("Módulo salvo");
      setDraft(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar módulo"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Módulo removido");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover módulo"),
  });

  if (error) {
    const raw = (error as any)?.message ?? "Erro desconhecido";
    const denied = /acesso negado/i.test(raw);
    return (
      <Card className="border-destructive/20 bg-destructive/5 p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
        <h2 className="mb-2 text-lg font-bold">
          {denied ? "Acesso Restrito" : "Falha ao abrir a Academia"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {denied
            ? "O treinamento interno é exclusivo para a equipe Shadow (Admin / Suporte / Moderação)."
            : "Não foi possível carregar os módulos internos agora."}
        </p>
        <p className="mt-3 break-words font-mono text-[10px] text-destructive/80">{raw}</p>
      </Card>
    );
  }

  const done = data?.completed ?? 0;
  const total = data?.total ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="border-primary/20 bg-card/40 backdrop-blur-sm">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-[200px] flex-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Seu progresso no treinamento interno
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Progress value={pct} className="h-2 flex-1" />
              <span className="font-mono text-xs text-primary">
                {done}/{total}
              </span>
            </div>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 font-mono text-[10px] uppercase"
                onClick={() => setShowTeam((s) => !s)}
              >
                <Users className="h-3.5 w-3.5" /> Equipe
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 font-mono text-[10px] uppercase"
                onClick={() => setDraft({ ...EMPTY, display_order: items.length + 1 })}
              >
                <Plus className="h-3.5 w-3.5" /> Novo módulo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && showTeam && (
        <Card className="border-primary/10 bg-card/30">
          <CardContent className="space-y-2 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Conclusão por membro da equipe
            </p>
            {(overview?.members ?? []).length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Nenhum membro da equipe encontrado.
              </p>
            ) : (
              (overview?.members ?? []).map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg bg-background/40 p-2">
                  <Avatar className="h-7 w-7 border border-primary/20">
                    <AvatarImage src={m.avatar ?? undefined} className="object-cover" />
                    <AvatarFallback className="text-[9px] uppercase">
                      {(m.name || "?").substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                  <span className="font-mono text-[9px] uppercase text-muted-foreground">
                    {m.role}
                  </span>
                  <span className="font-mono text-xs text-primary">
                    {m.done}/{m.total}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {draft && (
        <Card className="border-primary/30 bg-card/50">
          <CardContent className="space-y-3 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
              {draft.id ? "Editar módulo" : "Novo módulo interno"}
            </p>
            <Input
              placeholder="Título"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <Input
              placeholder="Resumo curto"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <Textarea
              placeholder="Conteúdo do treinamento"
              className="min-h-[160px] font-mono text-xs"
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                placeholder="Categoria"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
              <select
                aria-label="Nível do módulo"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={draft.level}
                onChange={(e) => setDraft({ ...draft, level: e.target.value as Draft["level"] })}
              >
                <option value="basico">Básico</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
              </select>
              <Input
                type="number"
                aria-label="Minutos estimados"
                placeholder="Minutos"
                value={draft.estimated_minutes}
                onChange={(e) =>
                  setDraft({ ...draft, estimated_minutes: Number(e.target.value) || 0 })
                }
              />
              <Input
                type="number"
                aria-label="Ordem de exibição"
                placeholder="Ordem"
                value={draft.display_order}
                onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) || 0 })}
              />
            </div>
            <Input
              placeholder="Link de vídeo (opcional)"
              value={draft.video_url}
              onChange={(e) => setDraft({ ...draft, video_url: e.target.value })}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={draft.is_published}
                onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })}
              />
              Publicado para a equipe
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={save.isPending || draft.title.trim().length < 3}
                onClick={() => save.mutate(draft)}
              >
                {save.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={filter === c ? "default" : "outline"}
            className="h-7 font-mono text-[10px] uppercase"
            onClick={() => setFilter(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <Card className="border-dashed border-primary/20 bg-card/20 p-12 text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">
            Nenhum módulo por aqui ainda.
            {canManage && " Crie o primeiro treinamento para os novos membros."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((m: any) => {
            const isOpen = open === m.id;
            return (
              <Card
                key={m.id}
                className={cn(
                  "border-primary/15 bg-card/30 transition-colors",
                  m.completed && "border-emerald-500/30",
                )}
              >
                <CardContent className="p-0">
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 p-4 text-left"
                    onClick={() => setOpen(isOpen ? null : m.id)}
                    aria-expanded={isOpen}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                        m.completed
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                          : "border-primary/25 bg-primary/10 text-primary",
                      )}
                    >
                      {m.completed ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <BookOpen className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{m.title}</h3>
                        <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] uppercase text-primary">
                          {LEVEL_LABEL[m.level] ?? m.level}
                        </span>
                        {!m.is_published && (
                          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[8px] uppercase text-amber-500">
                            rascunho
                          </span>
                        )}
                        <span className="font-mono text-[9px] uppercase text-muted-foreground">
                          {m.estimated_minutes} min · {m.category}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="space-y-4 border-t border-primary/10 px-4 py-4">
                      {m.video_url && (
                        <a
                          href={m.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary"
                        >
                          <Video className="h-3.5 w-3.5" /> Assistir vídeo do módulo
                        </a>
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                        {m.content}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={m.completed ? "outline" : "default"}
                          disabled={toggleDone.isPending}
                          onClick={() =>
                            toggleDone.mutate({ trainingId: m.id, completed: !m.completed })
                          }
                        >
                          {m.completed ? "Marcar como não concluído" : "Marcar como concluído"}
                        </Button>
                        {canManage && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5"
                              onClick={() =>
                                setDraft({
                                  id: m.id,
                                  title: m.title,
                                  description: m.description ?? "",
                                  content: m.content ?? "",
                                  category: m.category,
                                  level: m.level,
                                  video_url: m.video_url ?? "",
                                  estimated_minutes: m.estimated_minutes,
                                  display_order: m.display_order,
                                  is_published: m.is_published,
                                })
                              }
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5 text-destructive"
                              onClick={() => remove.mutate(m.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Remover
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
