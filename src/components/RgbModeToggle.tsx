import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Rainbow } from "lucide-react";

const KEY = "shadow:rgb-mode";

export function RgbModeToggle({ compact = false }: { compact?: boolean }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1";
    setOn(saved);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("rgb-mode", on);
  }, [on]);

  function toggle() {
    const next = !on;
    setOn(next);
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* storage bloqueado — segue só na sessão */
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={toggle}
      aria-pressed={on}
      title={on ? "Desligar modo RGB" : "Ligar modo RGB"}
      className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
    >
      <Rainbow className={`h-3.5 w-3.5 ${on ? "text-primary" : ""} ${compact ? "" : "mr-1.5"}`} />
      {!compact && (on ? "RGB on" : "RGB")}
    </Button>
  );
}
