import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Store, Zap, Shield, ShieldCheck, Rocket, ArrowRight, Info, Crown, Calendar, Lock } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { formatBrl } from "@/lib/plans";
import { createCheckout } from "@/lib/checkout.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/mercado")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [{ title: "Mercado Shadow — Módulos & Upgrades" }] }),
  component: MarketPage,
});

function MarketPage() {
  const { t } = useI18n();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingSlug, setBuyingSlug] = useState<string | null>(null);
  
  const checkoutFn = useServerFn(createCheckout);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from("plans")
          .select("*")
          .eq("active", true)
          .eq("status", "published")
          .in("category", ["addon", "upgrade", "source", "market"])

          .order("sort_order");
        
        if (error) {
          if (error.code === 'PGRST108' || error.message?.includes('schema cache')) {
            const { trackSchemaFailure } = await import("@/lib/tutorials.functions");
            const { data: userData } = await supabase.auth.getUser();
            await trackSchemaFailure(error, "MarketPage:fetchPlans", false, { route: window.location.pathname }, userData.user?.id);
            
            // Fallback para admin tunnel via server fn se necessário, mas aqui tentamos refresh e retry local primeiro
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server").catch(() => ({ supabaseAdmin: null }));
            if (supabaseAdmin) {
              await supabaseAdmin.rpc("force_refresh_schema_permissions");
              const { data: retryData, error: retryError } = await supabaseAdmin
                .from("plans")
                .select("*")
                .eq("active", true)
                .eq("status", "published")
                .in("category", ["addon", "upgrade", "source", "market"])

                .order("sort_order");
              if (!retryError) {
                setPlans(retryData || []);
                await trackSchemaFailure(error, "MarketPage:fetchPlans", true, { stage: "retry_success" }, userData.user?.id);
                return;
              }
            }
          }
          throw error;
        }
        setPlans(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const handleBuy = async (slug: string) => {
    setBuyingSlug(slug);
    try {
      const r = await checkoutFn({ data: { planSlug: slug, returnOrigin: window.location.origin } });
      window.location.href = r.checkoutUrl;
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar checkout");
      setBuyingSlug(null);
    }
  };

  const getIcon = (slug: string, category: string) => {
    const s = slug.toLowerCase();
    if (category === 'market') return Store;
    if (s.includes("upgrade")) return Crown;
    if (s.includes("signer") || s.includes("play-protect")) return ShieldCheck;
    if (s.includes("source")) return Rocket;
    return Zap;
  };


  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-black">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <SiteHeader />
          <div className="container mx-auto px-4 py-8">
            <div className="mb-10 text-center md:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                // tactical marketplace
              </div>
              <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl uppercase italic">
                {t('nav.market')}
              </h1>
              <p className="mt-4 max-w-2xl text-muted-foreground">
                Expanda suas capacidades táticas com módulos avançados de bypass, upgrades de conta e ferramentas exclusivas para operadores Shadow.
              </p>
            </div>

            {loading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="bg-black/40 border-primary/10 animate-pulse h-[300px]" />
                ))}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((p) => {
                  const Icon = getIcon(p.slug, p.category);
                  const isUpgrade = p.category === 'upgrade';

                  return (
                    <Card key={p.slug} className={`bg-black/40 border-primary/10 backdrop-blur-sm group hover:border-primary/40 transition-all flex flex-col ${isUpgrade ? 'border-amber-500/20 shadow-lg shadow-amber-500/5' : ''}`}>
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className={`p-3 rounded-xl border ${isUpgrade ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          {isUpgrade && (
                            <span className="text-[9px] font-mono uppercase bg-amber-500 text-black px-2 py-0.5 rounded font-bold">Priority</span>
                          )}
                        </div>
                        <CardTitle className="text-xl font-bold tracking-tight">{p.name}</CardTitle>
                        <CardDescription className="text-xs line-clamp-2 mt-2">{p.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 space-y-6 pt-0">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black">{formatBrl(p.price_brl)}</span>
                          {p.days && <span className="text-[10px] text-muted-foreground uppercase font-mono">/ {p.days} dias</span>}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/5">
                           <div className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/5">
                             <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                             <span className="text-[9px] font-mono text-muted-foreground uppercase leading-none">Entrega Instantânea</span>
                           </div>
                           <div className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/5">
                             <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                             <span className="text-[9px] font-mono text-muted-foreground uppercase leading-none">Suporte 24/7</span>
                           </div>
                        </div>

                        <Button 
                          className={`w-full font-mono text-xs uppercase tracking-widest mt-auto ${isUpgrade ? 'bg-amber-500 hover:bg-amber-600 text-black' : ''}`}
                          disabled={buyingSlug === p.slug}
                          onClick={() => handleBuy(p.slug)}
                        >
                          {buyingSlug === p.slug ? "Provisionando..." : p.category === 'market' ? "Adquirir Produto" : "Adquirir Módulo"}
                          <ArrowRight className="h-3 w-3 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            
            <div className="mt-16 rounded-2xl border border-primary/20 bg-primary/5 p-8 backdrop-blur-sm border-l-4 border-l-primary">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1 space-y-4 text-center md:text-left">
                  <h2 className="text-2xl font-bold font-display uppercase tracking-tighter">Não encontrou o que precisava?</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                    Nossa equipe de engenharia pode desenvolver módulos customizados para sua operação. Se você precisa de um bypass específico ou integração complexa, abra um ticket tático.
                  </p>
                  <Button variant="outline" asChild className="font-mono text-[10px] uppercase">
                    <Link to="/suporte">Solicitar Módulo Customizado</Link>
                  </Button>
                </div>
                <div className="hidden lg:block relative">
                   <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                   <div className="relative border border-primary/30 rounded-full p-8 bg-black/50">
                     <Lock className="h-12 w-12 text-primary" />
                   </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}