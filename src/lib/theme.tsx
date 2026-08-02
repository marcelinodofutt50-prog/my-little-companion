import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

const KEY = "shadow-theme";

function readSaved(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage bloqueado */
  }
  return "system";
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

type Ctx = { mode: ThemeMode; resolved: ResolvedTheme; setMode: (m: ThemeMode) => void };

const ThemeContext = createContext<Ctx>({ mode: "system", resolved: "dark", setMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  // Lê preferência salva depois da hidratação (evita mismatch de SSR)
  useEffect(() => {
    setModeState(readSaved());
  }, []);

  // Resolve tema e acompanha mudanças do sistema operacional em tempo real
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => setResolved(mode === "system" ? systemTheme() : mode);
    apply();
    if (mode !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);

  // Aplica no <html>
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("theme-light", resolved === "light");
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  }, [resolved]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* storage bloqueado */
    }
  }, []);

  return <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
