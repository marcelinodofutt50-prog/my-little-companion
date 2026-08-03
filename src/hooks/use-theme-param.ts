import { useEffect } from "react";
import { useTheme } from "@/lib/theme";

/**
 * Honra `?theme=light|dark` na URL sem brigar com o ThemeProvider.
 * Sem o parâmetro, o tema do sistema (ou a escolha salva) continua valendo.
 */
export function useThemeSearchParam(theme?: unknown) {
  const { setMode } = useTheme();
  useEffect(() => {
    if (theme === "light" || theme === "dark") setMode(theme);
  }, [theme, setMode]);
}
