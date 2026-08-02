import { Moon, Sun, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, type ThemeMode } from "@/lib/theme";

const NEXT: Record<ThemeMode, ThemeMode> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemeMode, string> = {
  system: "Tema: sistema",
  light: "Tema: claro",
  dark: "Tema: escuro",
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { mode, setMode } = useTheme();
  const Icon = mode === "system" ? MonitorSmartphone : mode === "light" ? Sun : Moon;
  return (
    <Button
      size="icon"
      variant="outline"
      onClick={() => setMode(NEXT[mode])}
      aria-label={LABEL[mode]}
      title={`${LABEL[mode]} (clique para alternar)`}
      className={`h-9 w-9 rounded-none border-border text-foreground hover:bg-muted ${className}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
