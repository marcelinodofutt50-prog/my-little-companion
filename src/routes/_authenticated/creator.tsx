import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck, CheckCircle2, Clapperboard, Clock, ExternalLink, Gift, KeyRound, Link2, Loader2,
  Megaphone, Send, Sparkles, Wrench, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/creator")({
  head: () => ({
    meta: [
      { title: "Programa Creator — Shadow" },
      { name: "description", content: "Área do Creator Shadow: resgate sua licença, veja o roteiro dos vídeos e envie seus links para a equipe." },
      { property: "og:title", content: "Programa Creator — Shadow" },
      { property: "og:description", content: "Grave vídeos sobre a Shadow, ganhe licença BTmob e recompensas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatorPage,
});

type AppRow = { status: "pending" | "approved" | "rejected"; staff_note: string | null };
type Claim = { status: "requested" | "delivered" | "rejected"; staff_note: string | null; created_at: string };
type Video = { id: string; url: string; title: string; platform: string; status: string; staff_note: string | null; created_at: string };

const ERR: Record<string, string> = {
  not_allowed: "Confirme o código do 2FA e tente de novo.",
  not_creator: "Só Creators aprovados podem fazer isso.",
  invalid_url: "Link inválido. Use um link completo começando com https://",
  platform_not_allowed: "Aceitamos YouTube, TikTok, Instagram, Kwai, Facebook, Telegram ou X.",
  rate_limited: "Limite de 5 vídeos por dia. Envie o resto amanhã.",
  duplicate: "Esse vídeo já foi enviado.",
};
const errMsg = (m?: string) => Object.entries(ERR).find(([k]) => m?.includes(k))?.[1] ?? "Não deu agora. Tente de novo em instantes.";

const SCRIPT = [
  { icon: Sparkles, t: "Apresente o site", d: "Mostre a página inicial, explique o que é a Shadow e para quem é." },
  { icon: Clapperboard, t: "Mostre as funcionalidades", d: "Painel de licenças, suporte ao vivo, tutoriais, chat dos clientes, sorteios." },
  { icon: Gift, t: "Fale dos preços", d: "Mostre a página de planos e o valor de cada um. Não invente promoção que não está no site." },
  { icon: Wrench, t: "Funções exclusivas", d: "Mostre o botão Reparar acesso (corrige o login sozinho em segundos) e Trocar senha do painel." },
  { icon: Megaphone, t: "Chame para ação", d: "Peça para a pessoa entrar pelo seu link de indicação e deixe o link na descrição." },
];

const VIDEO_LABEL: Record<string, string> = { pending: "Em análise", approved: "Aprovado", rejected: "Recusado" };

function CreatorPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [app, setApp] = useState<AppRow | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    const id = s.session?.user?.id ?? null;
    setUid(id);
    if (!id) return setLoaded(true);
    const [a, c, v] = await Promise.all([
      supabase.from("supporter_applications").select("status, staff_note").eq("user_id", id).maybeSingle(),
      supabase.from("creator_license_claims").select("status, staff_note, created_at").eq("user_id", id).maybeSingle(),
      supabase.from("creator_videos").select("id, url, title, platform, status, staff_note, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    setApp((a.data as any) ?? null);
    setClaim((c.data as any) ?? null);
    setVideos((v.data as any) ?? []);
    setLoaded(true);
    if ((a.data as any)?.status === "approved") supabase.rpc("mark_creator_welcome_seen").then(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const claimLicense = async () => {
    setClaiming(true);
    const { error } = await supabase.rpc("claim_creator_license");
    setClaiming(false);
    if (error) return toast.error(errMsg(error.message));
    toast.success("Pedido de licença enviado! A equipe libera em breve.");
    load();
  };

  const sendVideo = async () => {
    const u = url.trim();
    if (!/^https:\/\/\S+$/i.test(u)) return toast.error(ERR.invalid_url);
    setSending(true);
    const { error } = await supabase.rpc("submit_creator_video", { _url: u.slice(0, 300), _title: title.trim().slice(0, 120) });
    setSending(false);
    if (error) return toast.error(errMsg(error.message));
    toast.success("Vídeo enviado para a equipe!");
    setUrl(""); setTitle("");
    load();
  };

  if (!loaded) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!uid || app?.status !== "approved") {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <Card className="border-primary/40"><CardContent className="space-y-3 p-6 text-center">
          <Clapperboard className="mx-auto h-10 w-10 text-primary" />
          <h1 className="text-2xl font-black uppercase">Programa Creator</h1>
          <p className="text-sm text-muted-foreground">
            {app?.status === "pending" ? "Seu pedido está em análise. Assim que a equipe aprovar, esta área é liberada." :
             app?.status === "rejected" ? `Seu pedido foi recusado${app.staff_note ? `: ${app.staff_note}` : ""}. Você pode pedir de novo pelo painel depois de 24h.` :
             "Esta área é só para Creators aprovados. Faça seu pedido pelo painel."}
          </p>
          <Link to="/dashboard"><Button>Ir para o painel</Button></Link>
        </CardContent></Card>
      </div>
    );
  }

  const approvedCount = videos.filter((v) => v.status === "approved").length;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary"><BadgeCheck className="h-3.5 w-3.5" /> Creator Shadow verificado</p>
          <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Área do Creator</h1>
        </div>
        <div className="flex gap-2 text-center">
          <Stat label="Vídeos enviados" value={videos.length} />
          <Stat label="Aprovados" value={approvedCount} />
        </div>
      </div>

      {/* Passo 1 — licença */}
      <Card className="border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Step n={1} />
          <div>
            <p className="font-bold">Resgate sua licença Creator</p>
            <p className="text-xs text-muted-foreground">Você recebe uma licença BTmob para gravar os vídeos usando o painel de verdade.</p>
            {claim?.staff_note && <p className="mt-1 text-xs text-muted-foreground">Equipe: {claim.staff_note}</p>}
          </div>
        </div>
        {!claim || (claim.status === "rejected") ? (
          <Button onClick={claimLicense} disabled={claiming} className="shrink-0">
            {claiming ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1.5 h-4 w-4" />}
            {claim?.status === "rejected" ? "Pedir de novo" : "Resgatar licença Creator"}
          </Button>
        ) : claim.status === "requested" ? (
          <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Pedido recebido — a equipe está liberando</span>
        ) : (
          <Link to="/dashboard" className="shrink-0"><Button variant="outline"><CheckCircle2 className="mr-1.5 h-4 w-4 text-primary" /> Licença entregue — ver no painel</Button></Link>
        )}
      </CardContent></Card>

      {/* Passo 2 — roteiro */}
      <Card><CardContent className="space-y-3 p-5">
        <div className="flex gap-3"><Step n={2} /><div><p className="font-bold">Grave seu vídeo</p><p className="text-xs text-muted-foreground">Siga este roteiro. Vídeos completos têm mais chance de aprovação e recompensa.</p></div></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {SCRIPT.map((s) => (
            <div key={s.t} className="flex gap-2.5 rounded-lg border border-border bg-background/50 p-3">
              <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div><p className="text-sm font-semibold">{s.t}</p><p className="text-xs text-muted-foreground">{s.d}</p></div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Cuidado: não mostre senhas, IPs, e-mails ou dados de clientes no vídeo. Ative o Modo Streamer (Ctrl+Shift+S) antes de gravar.</p>
      </CardContent></Card>

      {/* Passo 3 — enviar link */}
      <Card><CardContent className="space-y-3 p-5">
        <div className="flex gap-3"><Step n={3} /><div><p className="font-bold">Envie o link de cada vídeo</p><p className="text-xs text-muted-foreground">YouTube, TikTok, Instagram, Kwai, Facebook, Telegram ou X. Até 5 por dia.</p></div></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={300} placeholder="https://youtube.com/watch?v=..." className="font-mono text-xs" />
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Título (opcional)" className="sm:max-w-[220px]" />
          <Button onClick={sendVideo} disabled={sending} className="shrink-0">
            {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />} Enviar
          </Button>
        </div>
        <div className="space-y-2">
          {videos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum vídeo enviado ainda.</p>}
          {videos.map((v) => (
            <div key={v.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{v.title || v.platform.toUpperCase()}</p>
                <a href={v.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 truncate font-mono text-[11px] text-primary underline"><Link2 className="h-3 w-3 shrink-0" />{v.url}</a>
                {v.staff_note && <p className="mt-1 text-xs text-muted-foreground">Equipe: {v.staff_note}</p>}
              </div>
              <span className={`flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase ${v.status === "approved" ? "text-primary" : v.status === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>
                {v.status === "approved" ? <CheckCircle2 className="h-3.5 w-3.5" /> : v.status === "rejected" ? <XCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                {VIDEO_LABEL[v.status] ?? v.status}
              </span>
            </div>
          ))}
        </div>
      </CardContent></Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ExternalLink className="h-3.5 w-3.5" /> Seu link de indicação fica em <Link to="/indicacoes" className="text-primary underline">Indicações</Link>. Creators ativos recebem recompensas definidas pela equipe.</p>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">{n}</span>;
}
function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-border px-3 py-1.5"><p className="text-lg font-black">{value}</p><p className="font-mono text-[9px] uppercase text-muted-foreground">{label}</p></div>;
}
