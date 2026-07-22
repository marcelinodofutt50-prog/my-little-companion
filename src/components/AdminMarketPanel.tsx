import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, ImagePlus, Store, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminListMarketProducts,
  adminUpsertMarketProduct,
  adminDeleteMarketProduct,
  adminUploadMarketImage,
} from "@/lib/market.functions";
import { formatBrl } from "@/lib/plans";

type Row = {
  slug: string;
  name: string;
  description: string | null;
  price_brl: number;
  image_url: string | null;
  image_signed_url: string | null;
  sort_order: number | null;
  active: boolean;
};

type Draft = {
  slug: string;
  name: string;
  description: string;
  price_brl: string;
  image_url: string;
  sort_order: string;
  active: boolean;
  original_slug?: string;
  preview?: string | null;
};

const EMPTY: Draft = { slug: "", name: "", description: "", price_brl: "", image_url: "", sort_order: "0", active: true };

function slugify(v: string) {
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-\s]/g, "").trim().replace(/\s+/g, "-").slice(0, 48);
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function AdminMarketPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const listFn = useServerFn(adminListMarketProducts);
  const upsertFn = useServerFn(adminUpsertMarketProduct);
  const deleteFn = useServerFn(adminDeleteMarketProduct);
  const uploadFn = useServerFn(adminUploadMarketImage);

  const load = useCallback(async () => {
    try { setRows((await listFn()) as any); } catch (e: any) { toast.error(e.message); }
  }, [listFn]);

  useEffect(() => { load(); }, [load]);

  function editRow(r: Row) {
    setDraft({
      slug: r.slug,
      name: r.name,
      description: r.description ?? "",
      price_brl: String(r.price_brl),
      image_url: r.image_url ?? "",
      sort_order: String(r.sort_order ?? 0),
      active: r.active,
      original_slug: r.slug,
      preview: r.image_signed_url ?? null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function pickImage(file: File) {
    const slug = draft.slug || slugify(draft.name);
    if (!slug) { toast.error("Preencha o nome/slug antes de enviar imagem"); return; }
    if (file.size > 5_000_000) { toast.error("Imagem maior que 5 MB"); return; }
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const r = await uploadFn({ data: { slug, contentType: file.type, dataBase64: b64 } });
      setDraft((d) => ({ ...d, image_url: r.path, preview: r.signedUrl ?? null }));
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally { setUploading(false); }
  }

  async function save() {
    const slug = draft.slug || slugify(draft.name);
    const price = Number(draft.price_brl.replace(",", "."));
    if (!draft.name.trim()) return toast.error("Nome obrigatório");
    if (!Number.isFinite(price) || price <= 0) return toast.error("Preço inválido");
    setSaving(true);
    try {
      await upsertFn({ data: {
        slug,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        price_brl: price,
        image_url: draft.image_url || null,
        sort_order: Number(draft.sort_order) || 0,
        active: draft.active,
        original_slug: draft.original_slug,
      } });
      toast.success(draft.original_slug ? "Produto atualizado" : "Produto criado");
      setDraft(EMPTY);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  }

  async function remove(slug: string) {
    if (!confirm(`Remover produto "${slug}"?`)) return;
    try {
      const r = await deleteFn({ data: { slug } });
      toast.success(r.deactivated ? "Produto desativado (havia pedidos)" : "Produto removido");
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="terminal-card scanlines relative p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-neon" />
            <h3 className="font-mono text-sm uppercase tracking-wider">
              {draft.original_slug ? `Editar: ${draft.original_slug}` : "Novo produto"}
            </h3>
          </div>
          {draft.original_slug && (
            <Button size="sm" variant="ghost" onClick={() => setDraft(EMPTY)} className="font-mono text-[10px] uppercase">
              <X className="mr-1 h-3 w-3" /> cancelar
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Nome</label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: draft.original_slug ? draft.slug : slugify(e.target.value) })}
              placeholder="Ex.: Camiseta Shadow Ops"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Slug {draft.original_slug && <span className="text-[9px] text-cyan">(não editável)</span>}
            </label>
            <Input
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })}
              disabled={!!draft.original_slug}
              placeholder="camiseta-shadow-ops"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Preço (BRL)</label>
            <Input
              value={draft.price_brl}
              onChange={(e) => setDraft({ ...draft, price_brl: e.target.value })}
              placeholder="99.90"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Ordem de exibição</label>
            <Input
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: e.target.value.replace(/\D/g, "") })}
              placeholder="0"
              inputMode="numeric"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Descrição</label>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={4}
              maxLength={2000}
              placeholder="O que o cliente recebe? Detalhes, envio, garantia..."
              className="w-full rounded border border-input bg-background/60 p-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-neon/60 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Imagem do produto</label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid h-28 w-28 place-items-center overflow-hidden rounded border border-dashed border-border/60 bg-background/40">
                {draft.preview ? (
                  <img src={draft.preview} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-border/60 bg-background/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider hover:border-neon/60">
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                  Enviar imagem
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.currentTarget.value = ""; }}
                  />
                </label>
                <p className="text-[10px] text-muted-foreground">PNG/JPG/WEBP até 5 MB. Recomendado 4:3.</p>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                className="h-4 w-4 accent-[var(--neon)]"
              />
              <span className="font-mono text-[11px] uppercase tracking-wider">Ativo no catálogo</span>
            </label>
            <Button onClick={save} disabled={saving} className="font-mono uppercase tracking-wider">
              {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : draft.original_slug ? <Save className="mr-2 h-3.5 w-3.5" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
              {draft.original_slug ? "Salvar alterações" : "Criar produto"}
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="terminal-card scanlines relative p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-mono text-sm uppercase tracking-wider">Produtos cadastrados</h3>
          <Button size="sm" variant="ghost" onClick={load} className="font-mono text-[10px] uppercase">
            <RefreshCw className="mr-1 h-3 w-3" /> atualizar
          </Button>
        </div>

        {rows === null && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> carregando...</div>}
        {rows && rows.length === 0 && (
          <div className="rounded border border-dashed border-border/60 p-8 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Nenhum produto ainda — cadastre o primeiro acima.
          </div>
        )}
        {rows && rows.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((r) => (
              <div key={r.slug} className={`flex gap-3 rounded border p-3 ${r.active ? "border-border/60" : "border-border/30 opacity-60"}`}>
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded bg-muted/20">
                  {r.image_signed_url
                    ? <img src={r.image_signed_url} alt={r.name} className="h-full w-full object-cover" />
                    : <div className="grid h-full place-items-center text-muted-foreground"><ImagePlus className="h-5 w-5" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-display text-sm">{r.name}</div>
                      <div className="truncate font-mono text-[10px] text-muted-foreground">{r.slug}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-sm text-neon">{formatBrl(Number(r.price_brl))}</div>
                      <div className="font-mono text-[9px] uppercase text-muted-foreground">{r.active ? "ativo" : "oculto"}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => editRow(r)} className="font-mono text-[10px] uppercase">Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.slug)} className="font-mono text-[10px] uppercase text-red-400 hover:text-red-300">
                      <Trash2 className="mr-1 h-3 w-3" /> remover
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
