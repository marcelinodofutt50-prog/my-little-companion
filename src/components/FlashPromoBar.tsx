import { useEffect, useState } from "react";
import { X, Zap } from "lucide-react";

const STORAGE_KEY = "shadow_flash_promo_deadline";
const DURATION_MS = 10 * 60 * 1000; // 10 minutes

function getDeadline(): number {
  if (typeof window === "undefined") return Date.now() + DURATION_MS;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    const ts = Number(stored);
    if (!Number.isNaN(ts) && ts > Date.now()) return ts;
  }
  const deadline = Date.now() + DURATION_MS;
  sessionStorage.setItem(STORAGE_KEY, String(deadline));
  return deadline;
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function FlashPromoBar() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDeadline(getDeadline());
    const dismissedFlag = sessionStorage.getItem("shadow_flash_promo_dismissed");
    if (dismissedFlag === "1") setDismissed(true);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (dismissed || deadline === null) return null;
  const remaining = deadline - now;
  if (remaining <= 0) return null;

  return (
    <div className="relative z-20 w-full border-b border-primary/30 bg-primary/10 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-center">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary md:text-xs">
          Oferta relâmpago · termina em{" "}
          <span className="tabular-nums text-foreground">{formatRemaining(remaining)}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            sessionStorage.setItem("shadow_flash_promo_dismissed", "1");
          }}
          aria-label="Fechar oferta relâmpago"
          className="absolute right-3 rounded p-1 text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
