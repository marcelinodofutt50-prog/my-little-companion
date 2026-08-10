import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Loader2, RefreshCw, Trash2, Package, Eye, EyeOff, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminListUpdates,
  adminCreateUpdateUpload,
  adminPublishUpdate,
  adminToggleUpdate,
  adminDeleteUpdate,
} from "@/lib/updates.functions";
import { tierLabel, type VersionTier } from "@/lib/plans";

type UpdateRow = {
  id: string; title: string; version: string; notes: string | null;
  min_tier: VersionTier; filename: string; size_bytes: number | null;
  is_active: boolean; created_at: string;
};

function fmtBytes(n: number | null) {
  if (!n) return "—";
  const mb = n / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;
}

export function AdminUpdatesPanel() {
  const listFn = useServerFn(adminListUpdates);
  const uploadFn = useServerFn(adminCreateUpdateUpload);
  const publishFn = useServerFn(adminPublishUpdate);
  const toggleFn = useServerFn(adminToggleUpdate);
  const deleteFn = useServerFn(adminDeleteUpdate);

  const [rows, setRows] = useState<UpdateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [minTier, setMinTier] = useState<VersionTier>("monthly_457");
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRows((await listFn()) as UpdateRow[]);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar updates");
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  function resetForm() {
    setTitle(""); setVersion(""); setNotes(""); setMinTier("monthly_457");
    setFile(null); setUploadPct(0); if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!title.trim() || !version.trim()) { toast.error("Título e versão obrigatórios"); return; }
    if (!file) { toast.error("Selecione um arquivo"); return; }
    setPublishing(true);
    try {
      const { uploadUrl, path } = await uploadFn({ data: { filename: file.name } });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload falhou (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Erro de rede"));
        xhr.send(file);
      });
      await publishFn({
        data: {
          title: title.trim(), version: version.trim(), notes: notes.trim() || null,
          min_tier: minTier, storage_path: path, filename: file.name, size_bytes: file.size,
        },
      });
      toast.success("Update publicado — já aparece pros clientes.");
      resetForm(); setShowForm(false);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao publicar");
    } finally { setPublishing(false); }
  }

  async function toggle(row: UpdateRow) {
    try {
      await toggleFn({ data: { id: row.id, is_active: !row.is_active } });
      toast.success(row.is_active ? "Ocultado" : "Publicado");
      refresh();
    } catch (e: any) { toast.error(e?.message || "Falha"); }
  }

  async function remove(row: UpdateRow) {
    if (!confirm(`Excluir "${row.title}" (${row.version})? O arquivo também será apagado.`)) return;
    try {
      await deleteFn({ data: { id: row.id } });
      toast.success("Update removido");
      refresh();
    } catch (e: any) { toast.error(e?.message || "Falha"); }
  }

  return (
    <div className="space-y-4">
      <div className="terminal-card scanlines relative p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-neon">// downloads / updates</div>
            <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">Publicar nova versão</h3>
            <p className="text-[11px] text-muted-foreground">Upload o arquivo e ele aparece automaticamente na aba de downloads dos clientes com o plano compatível.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={refresh} className="gap-1.5 font-mono text-[11px] uppercase">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-1.5 font-mono text-[11px] uppercase">
              <PlusCircle className="h-3.5 w-3.5" /> {showForm ? "Fechar" : "Novo update"}
            </Button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="terminal-card p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase text-muted-foreground">Título</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shadow 4.6.1" className="mt-1 font-mono text-xs" />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-muted-foreground">Versão</label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="4.6.1" className="mt-1 font-mono text-xs" />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-muted-foreground">Tier mínimo</label>
              <select
                value={minTier}
                onChange={(e) => setMinTier(e.target.value as VersionTier)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
              >
                <option value="weekly">Semanal (4.5.5) e acima</option>
                <option value="monthly_457">Mensal (4.5.7) e acima</option>
                <option value="lifetime_46">Vitalício (4.6) apenas</option>
              </select>
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase text-muted-foreground">Notas (changelog)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="- correções de bugs&#10;- nova feature X"
              className="mt-1 w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase text-muted-foreground">Arquivo (.rar, .zip, .apk)</label>
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
            />
            {file && (
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                {file.name} · {fmtBytes(file.size)}
              </div>
            )}
          </div>
          {publishing && uploadPct > 0 && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${uploadPct}%` }} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { resetForm(); setShowForm(false); }} disabled={publishing}>Cancelar</Button>
            <Button size="sm" onClick={submit} disabled={publishing} className="gap-1.5 font-mono text-[11px] uppercase">
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {publishing ? (uploadPct < 100 ? `Enviando ${uploadPct}%` : "Publicando…") : "Publicar"}
            </Button>
          </div>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="terminal-card p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando…
        </div>
      ) : rows.length === 0 ? (
        <div className="terminal-card p-10 text-center">
          <Package className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <div className="font-mono text-sm uppercase tracking-wider text-muted-foreground">nenhum update publicado</div>
          <p className="mt-1 text-xs text-muted-foreground">Clique em "Novo update" acima pra publicar a primeira versão.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="terminal-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Package className="h-5 w-5 shrink-0 text-neon" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-medium">{r.title}</div>
                    <span className="rounded border border-neon/40 bg-neon/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-neon">
                      v{r.version}
                    </span>
                    <span className="rounded border border-violet/40 bg-violet/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-violet">
                      ≥ {tierLabel(r.min_tier)}
                    </span>
                    {!r.is_active && (
                      <span className="rounded border border-muted-foreground/40 bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                        oculto
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {r.filename} · {fmtBytes(r.size_bytes)} · {new Date(r.created_at).toLocaleString("pt-BR")}
                  </div>
                  {r.notes && <div className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{r.notes}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggle(r)} className="gap-1.5 font-mono text-[11px] uppercase">
                    {r.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {r.is_active ? "Ocultar" : "Publicar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r)} className="gap-1.5 font-mono text-[11px] uppercase text-red-300 hover:text-red-200">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
