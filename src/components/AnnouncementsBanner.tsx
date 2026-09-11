import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, X, Clock } from "lucide-react";
import { listMyAnnouncements, type Announcement } from "@/lib/announcements.functions";

const DISMISS_KEY = "shadow-announcements-dismissed-v1";

function loadDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}

function styleFor(sev: Announcement["severity"]) {
  if (sev === "critical") {
    return {
      outer: "border-l-4 border-l-red-500 bg-red-950/60 text-red-100",
      badge: "bg-red-500/15 text-red-300 ring-1 ring-red-500/40",
    };
  }
  if (sev === "warning") {
    return {
      outer: "border-l-4 border-l-amber-400 bg-amber-950/50 text-amber-100",
      badge: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40",
    };
  }
  return {
    outer: "border-l-4 border-l-neon bg-neon/10 text-neon",
    badge: "bg-neon/15 text-neon ring-1 ring-neon/40",
  };
}

function severityLabel(sev: Announcement["severity"]) {
  if (sev === "critical") return "CRÍTICO";
  if (sev === "warning") return "WARNING";
  return "INFO";
}

function fmtEvent(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `hoje às ${hora}` : `${d.toLocaleDateString("pt-BR")} às ${hora}`;
}

export function AnnouncementsBanner() {
  const listFn = useServerFn(listMyAnnouncements);
  const [rows, setRows] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(loadDismissed());
    let alive = true;
    listFn()
      .then((r) => alive && setRows((r as Announcement[]) ?? []))
      .catch(() => void 0);
    return () => {
      alive = false;
    };
  }, []);

  function dismiss(id: string) {
    const next = [...new Set([...loadDismissed(), id])];
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setDismissed(next);
  }

  const visible = rows.filter((r) => !dismissed.includes(r.id));
  if (visible.length === 0) return null;

  return (
    <div className="w-full bg-background/95 backdrop-blur">
      {visible.map((a) => {
        const styles = styleFor(a.severity);
        return (
          <div
            key={a.id}
            className={`relative border-b border-border/10 p-3 pr-10 ${styles.outer}`}
          >
            <button
              onClick={() => dismiss(a.id)}
              aria-label="Fechar aviso"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-70 transition hover:opacity-100 hover:bg-white/5"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto flex max-w-7xl items-start gap-3">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${styles.badge}`}>
                    {severityLabel(a.severity)}
                  </span>
                  <span className="font-display text-sm font-semibold">{a.title}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed opacity-90">{a.body}</p>
                {a.event_at && (
                  <div className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider opacity-80">
                    <Clock className="h-3 w-3" /> {fmtEvent(a.event_at)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
