import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ShoppingBag, Store, Package, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/plans";
import { listMarketProducts, createMarketCheckout } from "@/lib/market.functions";

export const Route = createFileRoute("/mercado")({
  head: () => ({
    meta: [
      { title: "Mercado Shadow — Produtos e ferramentas" },
      { name: "description", content: "Catálogo oficial de produtos Shadow. Pagamento via Mercado Pago com liberação após confirmação." },
      { property: "og:title", content: "Mercado Shadow" },
      { property: "og:description", content: "Catálogo oficial de produtos Shadow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketPage,
});

type Product = {
  slug: string;
  name: string;
  description: string | null;
  price_brl: number;
  image_url: string | null;
  sort_order: number | null;
};

function MarketPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const listFn = useServerFn(listMarketProducts);
  const checkoutFn = useServerFn(createMarketCheckout);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    listFn().then((r) => setProducts(r as any)).catch((e) => toast.error(String(e.message ?? e)));
  }, [listFn]);

  async function buy(slug: string) {
    if (!user) {
      toast.info("Faça login para comprar.");
      navigate({ to: "/auth", search: { redirect: "/mercado" } as any });
      return;
    }
    setBusy(slug);
    try {
      const r = await checkoutFn({ data: { slug, returnOrigin: window.location.origin } });
      window.location.href = r.initPoint || r.sandboxInitPoint;
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao iniciar checkout");
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-10 flex items-center gap-3">
          <Store className="h-7 w-7 text-neon" />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">// shadow marketplace</div>
            <h1 className="font-display text-3xl tracking-tight md:text-4xl">Mercado</h1>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Produtos e ferramentas curadas pela equipe Shadow. Pagamento oficial via Mercado Pago —
          após a confirmação, um operador entra em contato pelo suporte para entregar seu produto.
        </p>

        {products === null && (
          <div className="mt-12 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> carregando catálogo...
          </div>
        )}

        {products && products.length === 0 && (
          <div className="mt-12 rounded border border-dashed border-border/60 p-10 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Nenhum produto disponível no momento.
            </p>
          </div>
        )}

        {products && products.length > 0 && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <article
                key={p.slug}
                className="group relative flex flex-col overflow-hidden rounded border border-border/60 bg-background/40 transition-colors hover:border-neon/40"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/20">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-muted-foreground">
                      <ShoppingBag className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-display text-lg leading-tight">{p.name}</h2>
                  {p.description && (
                    <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{p.description}</p>
                  )}
                  <div className="mt-4 flex items-end justify-between gap-3 pt-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">preço</div>
                      <div className="font-display text-2xl text-foreground">{formatBrl(Number(p.price_brl))}</div>
                    </div>
                    <Button
                      onClick={() => buy(p.slug)}
                      disabled={busy === p.slug}
                      className="font-mono text-[11px] uppercase tracking-wider"
                    >
                      {busy === p.slug ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="mr-2 h-3.5 w-3.5" />}
                      Comprar
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-14 rounded border border-border/60 bg-background/40 p-6 text-sm text-muted-foreground">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan">// como funciona</div>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>Escolha um produto e clique em <span className="text-foreground">Comprar</span>.</li>
            <li>Complete o pagamento no checkout do Mercado Pago (PIX / cartão).</li>
            <li>Assim que confirmado, entramos em contato via <Link to="/suporte" className="text-neon underline">Suporte</Link> para a entrega.</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
