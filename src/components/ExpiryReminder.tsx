import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { severityColor, licenseExpiryState } from "@/lib/expiry";
import { useServerNow } from "@/hooks/use-server-now";

type Item = { label: string; days: number; sev: "critical" | "warning"; trial: boolean };

const DISMISS_KEY = "shadow:expiry-reminder-dismissed";

export function ExpiryReminder() {
  const [rows, setRows] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState(true);
  const serverNow = useServerNow(60_000);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setDismissed(localStorage.getItem(DISMISS_KEY) === today);

    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("licenses")
        .select("plan_slug, expires_at, server_paid_until, revoked, disabled_at, suspended_at, is_trial")
        .eq("revoked", false)
        .is("disabled_at", null);
      if (!alive || !data) return;
      setRows(data as any[]);
    })();
    return () => { alive = false; };
  }, []);

  const items: Item[] = [];
  for (const l of rows) {
    const st = licenseExpiryState(l, serverNow);
    if (!st.active) continue;
    if (st.severity && st.daysLeft !== null) {
      const label = `${st.kind === "trial" ? "Teste" : "Licença"} ${l.plan_slug ?? ""}`.trim();
      items.push({ label, days: st.daysLeft, sev: st.severity, trial: st.kind === "trial" });
    } else if (st.countdownAt === null && st.serverSeverity && st.serverDaysLeft !== null) {
      // Vitalício: a licença não vence, mas a mensalidade do servidor sim.
      items.push({ label: "Mensalidade do servidor", days: st.serverDaysLeft, sev: st.serverSeverity, trial: false });
    }
  }

  items.sort((a, b) => a.days - b.days);
  items.splice(3);

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
          to={worst.trial ? "/planos" : "/renovar-servidor"}
          className="rgb-border rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
        >
          {worst.trial ? "Ver planos" : <span className="rgb-text animate-rgb-text">Renovar servidor</span>}
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
