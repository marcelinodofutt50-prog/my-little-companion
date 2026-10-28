import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { safeCreatorVideoHref } from "@/lib/creator-link-safety";
import { createLatestRequest } from "@/lib/latest-request";

type Claim = { id: string; user_id: string; status: string; staff_note: string | null; created_at: string; nick?: string };
type Video = { id: string; user_id: string; url: string; title: string; platform: string; status: string; staff_note: string | null; created_at: string; nick?: string };

/** Equipe: entrega das licenças Creator e revisão dos vídeos enviados. Tudo via RPC com checagem de staff no banco. */
export function AdminCreatorContentPanel() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [vf, setVf] = useState<"pending" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const gate = useRef(createLatestRequest());

  const load = useCallback(async () => {
    const isCurrent = gate.current.begin();
    try {
      const [c, v] = await Promise.all([
        supabase.from("creator_license_claims").select("id, user_id, status, staff_note, created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("creator_videos").select("id, user_id, url, title, platform, status, staff_note, created_at").order("created_at", { ascending: false }).limit(300),
      ]);
      if (!isCurrent()) return;
      if (c.error || v.error) {
        console.error("[creator-admin]", c.error ?? v.error);
        setLoadError(true); // keep rows already on screen
        return;
      }
      const cl = ((c.data as any) ?? []) as Claim[];
      const vl = ((v.data as any) ?? []) as Video[];
      const ids = [...new Set([...cl, ...vl].map((r) => r.user_id))];
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id, display_name").in("id", ids);
        if (!isCurrent()) return;
        const map = new Map((p ?? []).map((x: any) => [x.id, x.display_name]));
        [...cl, ...vl].forEach((r) => (r.nick = map.get(r.user_id) ?? "—"));
      }
      setClaims(cl); setVideos(vl); setLoadError(false);
    } catch (e) {
      if (!isCurrent()) return;
      console.error("[creator-admin]", e);
      setLoadError(true);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const g = gate.current;
    let active = true;
    let account: string | null | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextAccount = session?.user.id ?? null;
      if (account === undefined) { account = nextAccount; return; }
      if (account === nextAccount) return;
      account = nextAccount;
      g.cancel();
      setClaims([]); setVideos([]); setNotes({}); setLoadError(false); setLoading(true);
      queueMicrotask(() => { if (active) void load(); });
    });
    return () => { active = false; g.cancel(); subscription.unsubscribe(); };
  }, [load]);

  const review = async (kind: "video" | "claim", id: string, status: string, persistedNote: string | null) => {
    if (busyId) return;
    setBusyId(id);
    try {
      // Untouched draft keeps the saved note instead of silently erasing it.
      const draft = notes[id];
      const note = (draft !== undefined ? draft : persistedNote ?? "").slice(0, 300);
      const { error } = await supabase.rpc("review_creator_item", { _kind: kind, _id: id, _status: status, _note: note });
      if (error) return toast.error(error.message.includes("not_allowed") ? "Sem permissão (confirme o 2FA)." : "Não foi possível salvar.");
      toast.success("Salvo.");
      setNotes((n) => { const { [id]: _drop, ...rest } = n; return rest; });
      await load();
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  };

  const note = (id: string, ph: string, persisted: string | null) => (
    <input value={notes[id] ?? persisted ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [id]: e.target.value }))} maxLength={300} placeholder={ph} disabled={busyId === id} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs" />
  );

  const shownVideos = videos.filter((v) => vf === "all" || v.status === "pending");

  return (
    <Card><CardContent className="space-y-5 p-4">
      {loadError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 p-2 text-xs text-destructive">
          <span>Não foi possível atualizar a lista dos Creators. Os dados abaixo podem estar desatualizados.</span>
          <Button size="sm" variant="outline" onClick={() => { setLoading(true); load(); }}>Tentar novamente</Button>
        </div>
      )}
      {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      <div className="space-y-2">
        <p className="font-bold">Licenças Creator <span className="text-xs text-muted-foreground">({claims.filter((c) => c.status === "requested").length} aguardando)</span></p>
        <p className="text-xs text-muted-foreground">Gere a licença pelas ferramentas de licença normais e depois marque como entregue aqui.</p>
        {!loading && !loadError && claims.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido.</p>}
        {claims.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
            <b className="min-w-[120px]">{c.nick}</b>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">{c.status === "requested" ? "aguardando" : c.status === "delivered" ? "entregue" : "recusado"}</span>
            {c.status === "requested" && (<>
              {note(c.id, "Recado para o creator (opcional)", c.staff_note)}
              <Button size="sm" disabled={busyId !== null} onClick={() => review("claim", c.id, "delivered", c.staff_note)}>Marcar entregue</Button>
              <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => review("claim", c.id, "rejected", c.staff_note)}>Recusar</Button>
            </>)}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold">Vídeos dos Creators <span className="text-xs text-muted-foreground">({videos.filter((v) => v.status === "pending").length} para revisar entre os {videos.length} mais recentes)</span></p>
          <div className="flex gap-1">
            <Button size="sm" variant={vf === "pending" ? "default" : "outline"} onClick={() => setVf("pending")}>Pendentes</Button>
            <Button size="sm" variant={vf === "all" ? "default" : "outline"} onClick={() => setVf("all")}>Todos</Button>
          </div>
        </div>
        {!loading && !loadError && shownVideos.length === 0 && <p className="text-sm text-muted-foreground">Nada aqui.</p>}
        {shownVideos.map((v) => {
          const safeHref = safeCreatorVideoHref(v.url);
          return (
          <div key={v.id} className="space-y-1 rounded-md border border-border p-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span><b>{v.nick}</b> <span className="text-xs text-muted-foreground">· {v.platform} · {new Date(v.created_at).toLocaleDateString("pt-BR")}</span></span>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">{v.status === "pending" ? "pendente" : v.status === "approved" ? "aprovado" : "recusado"}</span>
            </div>
            {v.title && <p className="text-xs">{v.title}</p>}
            {safeHref ? <a href={safeHref} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-xs text-primary underline">{v.url}</a> : <span className="text-xs text-destructive">Link bloqueado por segurança.</span>}
            <div className="flex flex-wrap gap-2 pt-1">
              {note(v.id, "Comentário (aparece para o creator)", v.staff_note)}
              {v.status !== "approved" && <Button size="sm" disabled={busyId !== null} onClick={() => review("video", v.id, "approved", v.staff_note)}>Aprovar</Button>}
              {v.status !== "rejected" && <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => review("video", v.id, "rejected", v.staff_note)}>Recusar</Button>}
            </div>
          </div>
          );
        })}
      </div>
    </CardContent></Card>
  );
}
