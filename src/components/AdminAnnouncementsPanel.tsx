import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Megaphone, Loader2, RefreshCw, Trash2, Eye, EyeOff, PlusCircle, Clock, Pencil, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminListAnnouncements,
  adminSaveAnnouncement,
  adminToggleAnnouncement,
  adminDeleteAnnouncement,
  type Announcement,
  type AnnouncementSeverity,
} from "@/lib/announcements.functions";
import { tierLabel, type VersionTier } from "@/lib/plans";

/** ISO -> valor de <input type="datetime-local"> no fuso do navegador. */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

const SEVERITIES: { value: AnnouncementSeverity; label: string }[] = [
  { value: "info", label: "Informativo" },
  { value: "warning", label: "Atenção" },
  { value: "critical", label: "Crítico" },
];

const emptyForm = {
  id: undefined as string | undefined,
  title: "",
  body: "",
  severity: "info" as AnnouncementSeverity,
  min_tier: "weekly" as VersionTier,
  event_at: "",
  starts_at: "",
  ends_at: "",
  is_active: true,
  tags: [] as string[],
};

export function AdminAnnouncementsPanel() {
  const listFn = useServerFn(adminListAnnouncements);
  const saveFn = useServerFn(adminSaveAnnouncement);
  const toggleFn = useServerFn(adminToggleAnnouncement);
  const deleteFn = useServerFn(adminDeleteAnnouncement);

  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [tagInput, setTagInput] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      setRows((await listFn()) as Announcement[]);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar anúncios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function edit(row: Announcement) {
    setForm({
      id: row.id,
      title: row.title,
      body: row.body,
      severity: row.severity,
      min_tier: row.min_tier,
      event_at: toLocalInput(row.event_at),
      starts_at: toLocalInput(row.starts_at),
      ends_at: toLocalInput(row.ends_at),
      is_active: row.is_active,
      tags: row.tags || [],
    });
    setShowForm(true);
  }

  async function submit() {
    if (form.title.trim().length < 2 || form.body.trim().length < 2) {
      toast.error("Preencha título e mensagem");
      return;
    }
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: form.id,
          title: form.title.trim(),
          body: form.body.trim(),
          severity: form.severity,
          min_tier: form.min_tier,
          event_at: fromLocalInput(form.event_at),
          starts_at: fromLocalInput(form.starts_at),
          ends_at: fromLocalInput(form.ends_at),
          is_active: form.is_active,
          tags: form.tags,
        },
      });
      toast.success(form.id ? "Anúncio atualizado" : "Anúncio publicado");
      setForm(emptyForm);
      setShowForm(false);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: Announcement) {
    try {
      await toggleFn({ data: { id: row.id, is_active: !row.is_active } });
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    }
  }

  async function remove(row: Announcement) {
    if (!confirm(`Excluir o anúncio "${row.title}"?`)) return;
    try {
      await deleteFn({ data: { id: row.id } });
      toast.success("Anúncio removido");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    }
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      setForm({ ...form, tags: [...form.tags, t] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter((x) => x !== tag) });
  };

  return (
    <div className="space-y-4">
      <div className="terminal-card scanlines relative p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-violet">// avisos / anúncios</div>
            <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">Anúncio com agendamento</h3>
            <p className="text-[11px] text-muted-foreground">
              Ex.: "Usuários do server 4.6 receberão a atualização hoje à meia-noite". Você escolhe quando começa a
              aparecer, quando some e para quais planos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={refresh} className="gap-1.5 font-mono text-[11px] uppercase">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setForm(emptyForm);
                setShowForm((v) => !v);
              }}
              className="gap-1.5 font-mono text-[11px] uppercase"
            >
              <PlusCircle className="h-3.5 w-3.5" /> {showForm ? "Fechar" : "Novo anúncio"}
            </Button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="terminal-card space-y-3 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="font-mono text-[10px] uppercase text-muted-foreground">Título</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Manutenção programada · Shadow 4.6"
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-muted-foreground">Tipo</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as AnnouncementSeverity })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase text-muted-foreground">Mensagem</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={3}
              placeholder="Usuários do server 4.6 receberão a atualização hoje à meia-noite. Pode haver instabilidade por alguns minutos."
              className="mt-1 w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
            />
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase text-muted-foreground">Tags</label>
            <div className="mt-1 flex flex-wrap gap-2 mb-2">
              {form.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 border border-border/50 bg-background/50 px-2 py-0.5 rounded text-[10px] font-mono text-primary uppercase">
                  {tag}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Adicionar tag..."
                className="h-8 font-mono text-xs"
              />
              <Button size="sm" variant="outline" onClick={addTag} className="h-8">Add</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="font-mono text-[10px] uppercase text-muted-foreground">Plano mínimo</label>
              <select
                value={form.min_tier}
                onChange={(e) => setForm({ ...form, min_tier: e.target.value as VersionTier })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
              >
                <option value="weekly">Todos (semanal e acima)</option>
                <option value="monthly_457">Mensal (4.5.7) e acima</option>
                <option value="lifetime_46">Vitalício (4.6) apenas</option>
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-muted-foreground">Horário do evento</label>
              <Input
                type="datetime-local"
                value={form.event_at}
                onChange={(e) => setForm({ ...form, event_at: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
              <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">ex.: hoje 00:00 (meia-noite)</p>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-muted-foreground">Começa a aparecer</label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
              <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">vazio = agora</p>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-muted-foreground">Some em</label>
              <Input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
              <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">vazio = até você ocultar</p>
            </div>
          </div>

          <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Ativo
          </label>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setForm(emptyForm);
                setShowForm(false);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={submit} disabled={saving} className="gap-1.5 font-mono text-[11px] uppercase">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />}
              {form.id ? "Salvar" : "Publicar anúncio"}
            </Button>
          </div>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="terminal-card p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando…
        </div>
      ) : rows.length === 0 ? (
        <div className="terminal-card p-8 text-center">
          <Megaphone className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <div className="font-mono text-sm uppercase tracking-wider text-muted-foreground">nenhum anúncio</div>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const scheduled = new Date(r.starts_at).getTime() > Date.now();
            const expired = !!r.ends_at && new Date(r.ends_at).getTime() < Date.now();
            return (
              <li key={r.id} className="terminal-card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-violet" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-medium">{r.title}</div>
                      <span className="rounded border border-violet/40 bg-violet/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-violet">
                        ≥ {tierLabel(r.min_tier)}
                      </span>
                      <span className="rounded border border-muted-foreground/30 bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                        {SEVERITIES.find((s) => s.value === r.severity)?.label}
                      </span>
                      {!r.is_active && (
                        <span className="rounded border border-muted-foreground/40 bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                          oculto
                        </span>
                      )}
                      {scheduled && (
                        <span className="rounded border border-neon/40 bg-neon/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-neon">
                          agendado
                        </span>
                      )}
                      {expired && (
                        <span className="rounded border border-muted-foreground/40 bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                          encerrado
                        </span>
                      )}
                      {r.tags && r.tags.map((tag) => (
                        <span key={tag} className="rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 font-mono text-[8px] uppercase text-primary/80 flex items-center gap-1">
                          <Tag className="h-2 w-2" /> {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{r.body}</div>
                    <div className="mt-1 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> evento: {fmt(r.event_at)}
                      </span>
                      <span>exibe: {fmt(r.starts_at)}</span>
                      <span>some: {fmt(r.ends_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => edit(r)} className="gap-1.5 font-mono text-[11px] uppercase">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggle(r)} className="gap-1.5 font-mono text-[11px] uppercase">
                      {r.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {r.is_active ? "Ocultar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(r)}
                      className="gap-1.5 font-mono text-[11px] uppercase text-red-300 hover:text-red-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
