import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { daysUntil, severityFromDays, severityColor } from "@/lib/expiry";

type Item = { label: string; days: number; sev: "critical" | "warning" };

const DISMISS_KEY = "shadow:expiry-reminder-dismissed";

export function ExpiryReminder() {
  const [items, setItems] = useState<Item[]>([]);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setDismissed(localStorage.getItem(DISMISS_KEY) === today);

    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("licenses")
        .select("plan_slug, expires_at, server_paid_until, revoked, disabled_at, is_trial")
        .eq("revoked", false)
        .is("disabled_at", null);
      if (!alive || !data) return;
      const list: Item[] = [];
      for (const l of data as any[]) {
        const dLic = daysUntil(l.expires_at);
        const sLic = severityFromDays(dLic);
        if (sLic && dLic !== null) list.push({ label: `${l.is_trial ? "Teste" : "Licença"} ${l.plan_slug ?? ""}`.trim(), days: dLic, sev: sLic });
        const dSrv = daysUntil(l.server_paid_until ? `${l.server_paid_until}T23:59:59` : null);
        const sSrv = severityFromDays(dSrv);
        if (sSrv && dSrv !== null) list.push({ label: "Mensalidade do servidor", days: dSrv, sev: sSrv });
      }
      list.sort((a, b) => a.days - b.days);
      setItems(list.slice(0, 3));
    })();
    return () => { alive = false; };
  }, []);

  if (dismissed || items.length === 0) return null;
  const worst = items[0];
  const c = severityColor(worst.sev);

  return (
    <div className={`mx-auto mt-3 w-full max-w-6xl rounded-xl border px-4 py-3 ${c.border} ${c.bg}`}>
      <div className="flex flex-wrap items-center gap-3">
        <AlertTriangle className={`h-4 w-4 shrink-0 ${c.text}`} />
        <div className="min-w-0 flex-1 text-sm">
          <span className={`font-semibold ${c.text}`}>
            {worst.days <= 0 ? "Vencido: " : `Vence em ${worst.days} dia${worst.days === 1 ? "" : "s"}: `}
          </span>
          <span className="text-foreground/90">{worst.label}</span>
          {items.length > 1 ? <span className="text-muted-foreground"> · +{items.length - 1} outro(s) item(ns) próximo(s) do vencimento</span> : null}
        </div>
        <Link
          to="/renovar-servidor"
          className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
        >
          Renovar agora
        </Link>
        <button
          aria-label="Dispensar aviso"
          onClick={() => { localStorage.setItem(DISMISS_KEY, new Date().toISOString().slice(0, 10)); setDismissed(true); }}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
