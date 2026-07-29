import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminSectionCounts = {
  chat: number;
  orders: number;
  refunds: number;
  migrations: number;
  apk: number;
};

const EMPTY: AdminSectionCounts = { chat: 0, orders: 0, refunds: 0, migrations: 0, apk: 0 };

/**
 * Contadores "que precisam de ação" por seção do admin, atualizados em tempo real
 * (Realtime + poll de segurança). Usados como badges na navegação (desktop e mobile).
 */
export function useAdminSectionCounts(enabled = true) {
  const [counts, setCounts] = useState<AdminSectionCounts>(EMPTY);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || inflight.current) return;
    inflight.current = true;
    try {
      const head = { count: "exact" as const, head: true };
      const [chat, orders, refunds, migrations, apk] = await Promise.all([
        supabase.from("support_threads").select("id", head).neq("status", "closed").gt("unread_by_staff", 0),
        supabase.from("orders").select("id", head).in("status", ["pending", "processing", "in_process"]),
        supabase.from("refund_requests").select("id", head).in("status", ["requested", "approved"]),
        supabase.from("migration_requests").select("id", head).eq("status", "pending"),
        supabase.from("apk_jobs").select("id", head).in("status", ["queued", "claimed", "sending", "processing"]),
      ]);
      setCounts({
        chat: chat.count ?? 0,
        orders: orders.count ?? 0,
        refunds: refunds.count ?? 0,
        migrations: migrations.count ?? 0,
        apk: apk.count ?? 0,
      });
      setUpdatedAt(Date.now());
    } catch {
      /* silencioso: badges são informativos */
    } finally {
      inflight.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();

    let t: any;
    const debounced = () => {
      clearTimeout(t);
      t = setTimeout(refresh, 400);
    };

    const ch = supabase
      .channel("admin-section-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_threads" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "refund_requests" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "migration_requests" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "apk_jobs" }, debounced)
      .subscribe();

    const poll = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      refresh();
    }, 30000);

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(t);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
    };
  }, [enabled, refresh]);

  return { counts, refresh, updatedAt };
}
