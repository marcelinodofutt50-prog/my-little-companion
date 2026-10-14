import { useEffect, useState } from "react";
import { Megaphone, Youtube, Send, BadgeCheck, Clock, PartyPopper, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type App = { status: "pending" | "approved" | "rejected"; staff_note: string | null; welcome_seen_at?: string | null };

/** Chamada "Seja nosso apoiador" + pedido do cargo. A equipe aprova no admin (aba Sorteios). */
export function SupporterCard({ userId }: { userId: string | null }) {
  const [app, setApp] = useState<App | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [links, setLinks] = useState("");
  const [plan, setPlan] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from("supporter_applications").select("status, staff_note, welcome_seen_at").eq("user_id", userId).maybeSingle()
      .then(({ data }) => { setApp((data as any) ?? null); setLoaded(true); });
  }, [userId]);

  if (!userId || !loaded) return null;

  if (app?.status === "approved") {
    if (!app.welcome_seen_at) {
      return (
        <Card className="overflow-hidden border-primary bg-gradient-to-br from-primary/25 via-card to-card shadow-lg"><CardContent className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <PartyPopper className="h-8 w-8 shrink-0 text-primary" />
            <div>
              <p className="text-xl font-black uppercase tracking-tight">Parabéns, a equipe aceitou o seu pedido!!!</p>
              <p className="text-sm text-muted-foreground">Agora você é <b className="text-primary">Creator Shadow</b>. O que fazer agora? Na aba Creator você resgata sua licença, vê o roteiro do vídeo e envia os links para a equipe.</p>
            </div>
          </div>
          <Link to="/creator"><Button size="lg" className="w-full sm:w-auto">Clique aqui para ir para a aba Creator <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link>
        </CardContent></Card>
      );
    }
    return (
      <Card className="border-primary/50 bg-primary/10"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <BadgeCheck className="h-6 w-6 text-primary" />
          <div><p className="font-bold text-primary">Você é Creator Shadow</p><p className="text-xs text-muted-foreground">Envie cada vídeo novo na aba Creator para a equipe acompanhar.</p></div>
        </div>
        <Link to="/creator"><Button size="sm" variant="outline">Abrir aba Creator</Button></Link>
      </CardContent></Card>
    );
  }

  const submit = async () => {
    const l = links.trim();
    if (l.length < 10 || !/https?:\/\//i.test(l)) return toast.error("Coloque pelo menos um link começando com https://");
    setSending(true);
    const { data, error } = await supabase.rpc("submit_supporter_application" as any, { _links: l.slice(0, 600), _plan: plan.trim().slice(0, 600) } as any);
    setSending(false);
    if (error) {
      const m = error.message || "";
      return toast.error(m.includes("wait_24h") ? "Aguarde 24h depois da recusa para pedir de novo." : m.includes("banned") ? "Sua conta não pode pedir o cargo." : m.includes("invalid_links") ? "Link inválido." : "Não deu para enviar agora. Tente de novo.");
    }
    setApp({ status: (data as any) === "approved" ? "approved" : "pending", staff_note: null });
    toast.success("Pedido enviado! A equipe vai analisar.");
  };

  return (
    <Card className="overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <Megaphone className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
          <div>
            <p className="text-lg font-black uppercase tracking-tight">Seja um Creator Shadow!</p>
            <p className="text-sm text-muted-foreground">Ganhe o cargo de <b className="text-primary">Creator</b> agora mesmo e receba licenças da BTmob de graça. Com o tempo, dá até para ganhar dinheiro com isso.</p>
          </div>
        </div>
        {app?.status === "pending" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Seu pedido está em análise pela equipe.</p>
        ) : (
          <>
            {app?.status === "rejected" && <p className="text-xs text-destructive">Pedido anterior recusado{app.staff_note ? `: ${app.staff_note}` : ""}. Você pode tentar de novo.</p>}
            <Button variant={howOpen ? "outline" : "default"} onClick={() => setHowOpen((v) => !v)}>{howOpen ? "Fechar" : "Como faço para virar Creator?"}</Button>
            {howOpen && (
              <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4 text-sm">
                <ul className="space-y-1.5">
                  <li className="flex gap-2"><Youtube className="h-4 w-4 shrink-0 text-primary" /> Grave vídeos para o YouTube divulgando o site, mostrando como funciona e as funções.</li>
                  <li className="flex gap-2"><Send className="h-4 w-4 shrink-0 text-primary" /> Compartilhe seu link de indicação em grupos de WhatsApp e Telegram.</li>
                  <li className="flex gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-primary" /> Mande abaixo seus links. A equipe confere e libera o cargo.</li>
                </ul>
                <textarea value={links} onChange={(e) => setLinks(e.target.value)} maxLength={600} rows={2} placeholder="Link do seu canal do YouTube, grupo, TikTok…" className="w-full rounded-md border border-border bg-background p-2 text-sm" />
                <textarea value={plan} onChange={(e) => setPlan(e.target.value)} maxLength={600} rows={2} placeholder="Como você vai divulgar? (opcional)" className="w-full rounded-md border border-border bg-background p-2 text-sm" />
                <Button onClick={submit} disabled={sending}>{sending ? "Enviando…" : "Quero ser Creator"}</Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
