import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCheckout } from "@/lib/checkout.functions";
import { markCheckoutIntent } from "@/components/WinbackOffer";
import { toast } from "sonner";

export function LicenseRenewCard({
  licenseId,
  planSlug,
  planName,
  daysLeft,
  expiresAt,
  price,
}: {
  licenseId: string;
  planSlug: string;
  planName: string;
  daysLeft: number;
  expiresAt: string;
  price?: number;
}) {
  const [loading, setLoading] = useState(false);
  const checkoutFn = useServerFn(createCheckout);

  const renew = async () => {
    setLoading(true);
    try {
      const res = await checkoutFn({ data: { planSlug, returnOrigin: window.location.origin } });
      const url = res.checkoutUrl;
      if (!url) throw new Error("Não foi possível iniciar renovação");
      markCheckoutIntent(planSlug);
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar renovação");
      setLoading(false);
    }
  };

  const isUrgent = daysLeft <= 2;
  const tone = isUrgent ? "danger" : daysLeft <= 5 ? "amber" : "neon";

  return (
    <Card
      className={`relative overflow-hidden border bg-background/60 shadow-sm ${
        tone === "danger" ? "border-danger/50" : tone === "amber" ? "border-amber-400/50" : "border-neon/50"
      }`}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-10 blur-2xl ${
          tone === "danger" ? "bg-danger" : tone === "amber" ? "bg-amber-400" : "bg-neon"
        }`}
      />
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div
            className={`rounded-md p-1.5 ${
              tone === "danger" ? "bg-danger/10 text-danger" : tone === "amber" ? "bg-amber-400/10 text-amber-400" : "bg-neon/10 text-neon"
            }`}
          >
            <Clock className="h-4 w-4" />
          </div>
          <CardTitle className="font-display text-sm tracking-tight">{planName} expira em breve</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className={`font-display text-2xl font-bold ${tone === "danger" ? "text-danger" : tone === "amber" ? "text-amber-400" : "text-neon"}`}>
              {daysLeft === 0 ? "Hoje" : `${daysLeft} dia${daysLeft === 1 ? "" : "s"}`}
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">
              Expira em {new Date(expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
            </p>
            {price !== undefined && <p className="mt-0.5 font-mono text-xs text-muted-foreground">Renovação: R$ {price.toFixed(2)}</p>}
          </div>
          <Button
            size="sm"
            onClick={renew}
            disabled={loading}
            className={`font-mono text-[11px] uppercase tracking-wider ${
              tone === "danger" ? "bg-danger hover:bg-danger/90" : tone === "amber" ? "bg-amber-500 hover:bg-amber-500/90" : ""
            }`}
          >
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Renovar agora
          </Button>
        </div>
        {isUrgent && (
          <div className="mt-3 flex items-center gap-1.5 rounded-md bg-danger/10 px-2 py-1.5 font-mono text-[10px] text-danger">
            <AlertTriangle className="h-3 w-3" />
            Renove agora para evitar perder o acesso.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
