import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Hash, Lock, Send, Trash2, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BackToDashboard } from "@/components/BackToDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/clientes-chat")({
  head: () => ({
    meta: [
      { title: "Chat dos Clientes — Shadow" },
      { name: "description", content: "Canal exclusivo para quem já comprou: converse com outros clientes Shadow." },
      { property: "og:title", content: "Chat dos Clientes — Shadow" },
      { property: "og:description", content: "Canal exclusivo para clientes Shadow, no estilo Discord." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerChatPage,
});

const CHANNELS = [
  { id: "geral", label: "geral", desc: "Papo geral entre clientes" },
  { id: "duvidas", label: "dúvidas", desc: "Tire dúvidas com quem já usa" },
  { id: "resultados", label: "resultados", desc: "Mostre o que você conseguiu" },
  { id: "off", label: "off-topic", desc: "Qualquer assunto" },
] as const;
type ChannelId = (typeof CHANNELS)[number]["id"];

type Msg = {
  id: string; channel: string; user_id: string; author_name: string | null;
  author_avatar: string | null; is_staff: boolean; content: string;
  deleted_at: string | null; created_at: string;
};

const db = supabase as any;

/** Mais antigas em cima, mais novas embaixo (igual Discord). */
function sortMsgs(list: Msg[]): Msg[] {
  return [...list].sort((a, b) => {
    const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}

function CustomerChatPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [me, setMe] = useState<{ id: string; staff: boolean } | null>(null);
  const [channel, setChannel] = useState<ChannelId>("geral");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return setAllowed(false);
      const [{ data: ok }, { data: staff }] = await Promise.all([
        db.rpc("is_paying_customer", { _user_id: uid }),
        db.rpc("is_staff", { _user_id: uid }),
      ]);
      setMe({ id: uid, staff: !!staff });
      setAllowed(!!ok);
    })();
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    (async () => {
      const { data, error } = await db
        .from("customer_chat_messages")
        .select("id,channel,user_id,author_name,author_avatar,is_staff,content,deleted_at,created_at")
        .eq("channel", channel).is("deleted_at", null)
        .order("created_at", { ascending: false }).range(0, 99);
      if (!alive) return;
      if (error) toast.error(error.message);
      setMsgs(sortMsgs((data ?? []) as Msg[]));
    })();
    const sub = supabase
      .channel(`customer-chat-${channel}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_chat_messages", filter: `channel=eq.${channel}` },
        (p: any) => {
          const row = p.new as Msg;
          if (!row?.id) return;
          setMsgs((cur) => {
            if (row.deleted_at) return cur.filter((m) => m.id !== row.id);
            const rest = cur.filter((m) => m.id !== row.id);
            return sortMsgs([...rest, row]).slice(-200);
          });
        })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(sub); };
  }, [allowed, channel]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    const { data, error } = await db.from("customer_chat_messages")
      .insert({ channel, content })
      .select("id,channel,user_id,author_name,author_avatar,is_staff,content,deleted_at,created_at").single();
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
    setMsgs((cur) => (cur.some((m) => m.id === data.id) ? cur : [...cur, data]));
  }

  async function remove(id: string) {
    const { error } = await db.from("customer_chat_messages").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    setMsgs((cur) => cur.filter((m) => m.id !== id));
  }

  if (allowed === null) {
    return <div className="p-10 text-center font-mono text-xs text-muted-foreground">Carregando…</div>;
  }

  if (!allowed) {
    return (
      <div className="container mx-auto max-w-lg space-y-6 p-6 md:p-10">
        <BackToDashboard />
        <div className="space-y-4 rounded-xl border border-border bg-card/60 p-8 text-center">
          <Lock className="mx-auto h-10 w-10 text-primary" />
          <h1 className="font-display text-2xl font-black uppercase">Chat dos Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Esse canal é exclusivo para quem já comprou um login. O teste grátis não libera o acesso.
          </p>
          <Button asChild><Link to="/planos">Ver planos</Link></Button>
        </div>
      </div>
    );
  }

  const current = CHANNELS.find((c) => c.id === channel)!;

  return (
    <div className="container mx-auto flex h-[calc(100dvh-100px)] max-w-6xl flex-col gap-4 p-3 md:p-6">
      <BackToDashboard />
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card/40">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card/60 md:flex">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 font-display text-sm font-black uppercase">
            <Users className="h-4 w-4 text-primary" /> Clientes Shadow
          </div>
          <nav className="flex-1 space-y-1 p-2">
            {CHANNELS.map((c) => (
              <button key={c.id} onClick={() => setChannel(c.id)}
                className={cn("flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  channel === c.id ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")}>
                <Hash className="h-4 w-4" /> {c.label}
              </button>
            ))}
          </nav>
          <p className="border-t border-border p-3 text-[11px] text-muted-foreground">
            Sem vendas, links suspeitos ou dados pessoais. A equipe pode apagar mensagens.
          </p>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold text-foreground">{current.label}</span>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">— {current.desc}</span>
          </header>
          <div className="flex gap-1 overflow-x-auto border-b border-border p-2 md:hidden">
            {CHANNELS.map((c) => (
              <button key={c.id} onClick={() => setChannel(c.id)}
                className={cn("shrink-0 rounded-full px-3 py-1 text-xs",
                  channel === c.id ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground")}>
                #{c.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma mensagem em #{current.label} ainda. Puxe o assunto!</p>
            )}
            {msgs.map((m) => (
              <div key={m.id} className="group flex gap-3">
                {m.author_avatar ? (
                  <img src={m.author_avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                    {(m.author_name ?? "C").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={cn("text-sm font-semibold", m.is_staff ? "text-primary" : "text-foreground")}>
                      {m.author_name ?? "Cliente"}
                    </span>
                    {m.is_staff && (
                      <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 text-[10px] font-bold uppercase text-primary">
                        <ShieldCheck className="h-3 w-3" /> Equipe
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {(m.user_id === me?.id || me?.staff) && (
                      <button onClick={() => remove(m.id)} aria-label="Apagar mensagem"
                        className="ml-auto text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">{m.content}</p>
                </div>
              </div>
            ))}
            <div ref={bottom} />
          </div>

          <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <Input value={text} maxLength={1000} onChange={(e) => setText(e.target.value)}
              placeholder={`Conversar em #${current.label}`} />
            <Button type="submit" disabled={sending || !text.trim()} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
          </form>
        </section>
      </div>
    </div>
  );
}
