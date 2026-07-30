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
  if (sev === "critical") return "border-red-500/50 bg-red-500/10 text-red-200";
  if (sev === "warning") return "border-amber-400/50 bg-amber-400/10 text-amber-200";
  return "border-neon/40 bg-neon/10 text-neon";
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
    <div className="space-y-2">
      {visible.map((a) => (
        <div key={a.id} className={`relative rounded-lg border p-3 pr-9 ${styleFor(a.severity)}`}>
          <button
            onClick={() => dismiss(a.id)}
            aria-label="Fechar aviso"
            className="absolute right-2 top-2 rounded p-1 opacity-70 transition hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-start gap-2">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold">{a.title}</div>
              <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed opacity-90">{a.body}</p>
              {a.event_at && (
                <div className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider opacity-80">
                  <Clock className="h-3 w-3" /> {fmtEvent(a.event_at)}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
