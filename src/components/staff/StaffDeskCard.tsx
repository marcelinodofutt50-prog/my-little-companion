import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2, Headset, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AdminSupportPanel = lazy(() => import("@/components/support/AdminSupportPanel").then((m) => ({ default: m.AdminSupportPanel })));
const AdminApkPanel = lazy(() => import("@/components/AdminApkPanel").then((m) => ({ default: m.AdminApkPanel })));
const SupportStatsPanel = lazy(() => import("@/components/support/SupportStatsPanel").then((m) => ({ default: m.SupportStatsPanel })));

type Tab = "chat" | "stats" | "apk";

/** Central da equipe dentro do painel do cliente: só aparece para admin/suporte/moderação. */
export function StaffDeskCard() {
  const [isStaff, setIsStaff] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: ok } = await supabase.rpc("is_staff", { _user_id: data.user.id });
      setIsStaff(!!ok);
    });
  }, []);
  if (!isStaff) return null;
  const tabs: [Tab, string][] = [["chat", "Chat"], ["stats", "Métricas"], ["apk", "APKs"]];
  return (
    <section className="mb-6 rounded-2xl border border-primary/30 bg-card/50 p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold"><Headset className="h-4 w-4 text-primary" />Central da equipe</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-1 rounded-lg bg-muted/30 p-1">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)}
                className={`flex-1 rounded-md py-1.5 text-xs ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
                {label}
              </button>
            ))}
          </div>
          <Suspense fallback={<div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>}>
            {tab === "chat" && <AdminSupportPanel />}
            {tab === "stats" && <SupportStatsPanel />}
            {tab === "apk" && <AdminApkPanel />}
          </Suspense>
        </div>
      )}
    </section>
  );
}
