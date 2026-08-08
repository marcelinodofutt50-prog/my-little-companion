import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift, ArrowRight, Download, Receipt, ExternalLink, Inbox } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMyGifts } from "@/lib/gifts.functions";
import { useI18n } from "@/lib/i18n";
import { formatBrl } from "@/lib/plans";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/presentes")({
  head: () => ({ meta: [{ title: "Presentes — Shadow" }] }),
  component: GiftsPage,
});

function GiftsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const listGiftsFn = useServerFn(listMyGifts);

  useEffect(() => {
    listGiftsFn().then(setData).catch(console.error).finally(() => setLoading(false));
  }, [listGiftsFn]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-black">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <SiteHeader />
          <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                // digital gifts
              </div>
              <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl uppercase italic">
                {t('gift.title')}
              </h1>
              <p className="mt-4 max-w-2xl text-muted-foreground">
                {t('gift.lead')}
              </p>
            </div>

            <Tabs defaultValue="received" className="space-y-8">
              <TabsList className="bg-black/40 border border-primary/10 p-1">
                <TabsTrigger value="received" className="px-8 font-mono text-[10px] uppercase tracking-widest">{t('gift.received')}</TabsTrigger>
                <TabsTrigger value="sent" className="px-8 font-mono text-[10px] uppercase tracking-widest">{t('gift.sent')}</TabsTrigger>
              </TabsList>

              <TabsContent value="received">
                <GiftGrid gifts={data?.received ?? []} kind="received" loading={loading} />
              </TabsContent>

              <TabsContent value="sent">
                <GiftGrid gifts={data?.sent ?? []} kind="sent" loading={loading} />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

function GiftGrid({ gifts, kind, loading }: { gifts: any[], kind: "sent" | "received", loading: boolean }) {
  const { t } = useI18n();
  if (loading) return <div className="text-center py-20 animate-pulse text-muted-foreground">Carregando histórico...</div>;
  if (!gifts.length) return (
    <div className="text-center py-20 border border-dashed border-primary/10 rounded-2xl bg-primary/5">
      <Inbox className="h-12 w-12 text-primary/10 mx-auto mb-4" />
      <p className="text-sm text-muted-foreground">{kind === 'received' ? t('gift.empty_received') : t('gift.empty_sent')}</p>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/planos">{t('gift.send_btn')}</Link>
      </Button>
    </div>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {gifts.map((g: any) => (
        <Card key={g.order_id} className="bg-black/40 border-primary/10 backdrop-blur-sm hover:border-primary/30 transition-all group">
          <CardHeader className="pb-3 border-b border-primary/5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-muted-foreground uppercase">{new Date(g.created_at).toLocaleDateString()}</span>
              <Gift className="h-4 w-4 text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
            </div>
            <CardTitle className="text-lg font-bold mt-2">{g.plan_name}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground uppercase">{kind === 'received' ? t('gift.card_from') : t('gift.card_to')}</span>
              <span className="text-foreground font-bold">{g.counterpart_email}</span>
            </div>
            
            {g.message && (
              <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg italic text-[11px] text-muted-foreground relative">
                <div className="absolute -top-2 -left-2 bg-primary text-black p-1 rounded-sm">
                   <Inbox className="h-2 w-2" />
                </div>
                "{g.message}"
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-primary/5">
               {kind === 'received' && g.status === 'paid' && (
                 <Button size="sm" variant="outline" asChild className="text-[9px] h-7 font-mono uppercase bg-primary/10 border-primary/20 hover:bg-primary/20">
                   <Link to="/dashboard">{t('gift.see_my_access')}</Link>
                 </Button>
               )}
               <Button size="sm" variant="ghost" className="text-[9px] h-7 font-mono uppercase text-primary hover:bg-primary/5">
                 <Receipt className="h-3 w-3 mr-2" /> {t('gift.dl_receipt')}
               </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
