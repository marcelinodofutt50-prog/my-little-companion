import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "shadow-theme";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    const isLight = saved === "light";
    setLight(isLight);
    document.documentElement.classList.toggle("theme-light", isLight);
  }, []);
  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("theme-light", next);
    try { localStorage.setItem(KEY, next ? "light" : "dark"); } catch {}
  }
  return (
    <Button
      size="icon"
      variant="outline"
      onClick={toggle}
      aria-label={light ? "Ativar tema escuro" : "Ativar tema claro"}
      title={light ? "Tema escuro" : "Tema claro"}
      className="h-9 w-9 border-neon/30 text-neon hover:bg-neon/10"
    >
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
