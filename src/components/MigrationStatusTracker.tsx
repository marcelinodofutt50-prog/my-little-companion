import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Radio,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Req = {
  id: string;
  status: string;
  current_panel: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  proof_paths: string[] | null;
};

type Msg = {
  id: string;
  body: string | null;
  is_admin: boolean;
  is_system: boolean;
  created_at: string;
};

const STEPS = [
  { key: "received", label: "Recebido", desc: "Seu pedido chegou até nós" },
  { key: "reviewing", label: "Em análise", desc: "Conferindo seus comprovantes" },
  { key: "approved", label: "Aprovado", desc: "Migração liberada" },
  { key: "done", label: "Concluído", desc: "Painel novo entregue" },
] as const;

function stepIndex(status: string) {
  switch (status) {
    case "pending":
      return 0;
    case "reviewing":
    case "in_review":
    case "analyzing":
      return 1;
    case "approved":
      return 2;
    case "done":
    case "completed":
    case "finished":
      return 3;
    default:
      return 0;
  }
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function MigrationStatusTracker() {
  const [uid, setUid] = useState<string | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Carrega pedido + ticket
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: r } = await supabase
        .from("migration_requests")
        .select("id, status, current_panel, admin_notes, created_at, updated_at, proof_paths")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      setReq((r as Req) ?? null);

      const { data: t } = await supabase
        .from("support_threads")
        .select("id")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      const tid = (t as any)?.id ?? null;
      setThreadId(tid);

      if (tid) {
        const { data: m } = await supabase
          .from("support_messages")
          .select("id, body, is_admin, is_system, created_at")
          .eq("thread_id", tid)
          .order("created_at", { ascending: true })
          .limit(50);
        if (alive) setMsgs((m as Msg[]) ?? []);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  // Realtime: status do pedido
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`migracao-status-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "migration_requests", filter: `user_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as Req;
          if (row?.id) {
            setReq((prev) => (!prev || prev.id === row.id ? row : prev));
            toast.info("Status da sua migração foi atualizado");
          }
        },
      )
      .subscribe((s) => setLive(s === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid]);

  // Realtime: mensagens do suporte
  useEffect(() => {
    if (!threadId) return;
    const ch = supabase
      .channel(`migracao-msgs-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [threadId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  const idx = useMemo(() => (req ? stepIndex(req.status) : -1), [req]);
  const rejected = req?.status === "rejected" || req?.status === "recusado";

  async function send() {
    const body = reply.trim();
    if (!body || sending || !uid) return;
    setSending(true);
    try {
      let tid = threadId;
      if (!tid) {
        const { data: created, error } = await supabase
          .from("support_threads")
          .insert({ user_id: uid, subject: "Programa de migração", status: "open" })
          .select("id")
          .single();
        if (error) throw error;
        tid = (created as any).id;
        setThreadId(tid);
      }
      const { error: mErr } = await supabase
        .from("support_messages")
        .insert({ thread_id: tid as string, sender_id: uid, body });
      if (mErr) throw mErr;
      setReply("");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível enviar a mensagem");
    } finally {
      setSending(false);
    }
  }

  if (!uid) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card/50 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando seu chamado...
      </div>
    );
  }

  if (!req) return null;

  return (
    <div className="terminal-card space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg tracking-tight">Acompanhe seu chamado</h3>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Radio className={`h-3 w-3 ${live ? "text-neon animate-pulse" : "text-muted-foreground"}`} />
          {live ? "Ao vivo" : "Reconectando..."}
        </span>
      </div>

      {/* Timeline */}
      {rejected ? (
        <div className="flex items-start gap-3 rounded border border-destructive/40 bg-destructive/10 p-4">
          <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <p className="text-sm font-semibold">Solicitação recusada</p>
            <p className="text-[12px] text-muted-foreground">
              {req.admin_notes || "Fale com o suporte no chat abaixo para entender o motivo e reenviar."}
            </p>
          </div>
        </div>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-4">
          {STEPS.map((s, i) => {
            const done = i < idx;
            const active = i === idx;
            return (
              <li
                key={s.key}
                className={`rounded-md border p-3 ${
                  active
                    ? "border-neon/60 bg-neon/10"
                    : done
                      ? "border-neon/30 bg-card/50"
                      : "border-border/60 bg-card/30 opacity-60"
                }`}
              >
                <div className="flex items-center gap-2">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-neon" />
                  ) : active ? (
                    i === 1 ? (
                      <Search className="h-4 w-4 text-neon" />
                    ) : (
                      <Clock className="h-4 w-4 text-neon" />
                    )
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-mono text-[11px] uppercase tracking-wider">{s.label}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.desc}</p>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-[11px] text-muted-foreground">
        Painel informado: <span className="text-foreground">{req.current_panel}</span> · Enviado em {fmt(req.created_at)} ·
        Última atualização {fmt(req.updated_at)}
      </p>

      {req.admin_notes && !rejected && (
        <p className="rounded border border-border/60 bg-card/50 p-3 text-[12px]">
          <span className="font-semibold">Resposta da equipe:</span> {req.admin_notes}
        </p>
      )}

      {/* Chat */}
      <div className="rounded-md border border-border/60 bg-card/40">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2">
          <MessageSquare className="h-4 w-4 text-neon" />
          <span className="font-mono text-[11px] uppercase tracking-wider">Mensagens do suporte</span>
        </div>
        <div ref={listRef} className="max-h-72 space-y-2 overflow-y-auto p-4">
          {msgs.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              Ainda não há mensagens. Assim que a equipe responder, aparece aqui na hora.
            </p>
          ) : (
            msgs.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-md border p-2.5 text-[12px] ${
                  m.is_admin || m.is_system
                    ? "border-neon/30 bg-neon/5"
                    : "ml-auto border-border/60 bg-muted/40"
                }`}
              >
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.is_system ? "Sistema" : m.is_admin ? "Suporte" : "Você"} · {fmt(m.created_at)}
                </div>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border/60 p-3">
          <Input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            maxLength={1000}
            placeholder="Responder ao suporte..."
          />
          <Button type="button" size="sm" onClick={() => void send()} disabled={sending || !reply.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Button asChild size="sm" variant="outline" className="font-mono uppercase">
        <Link to="/suporte" search={{}}>Abrir chamado completo</Link>
      </Button>
    </div>
  );
}
