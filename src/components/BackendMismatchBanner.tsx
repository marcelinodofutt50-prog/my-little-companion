import { useEffect, useState } from "react";

/**
 * Referência do backend oficial deste projeto.
 * Se o site for publicado com variáveis de ambiente de outro projeto
 * (ex.: um deploy antigo na Vercel apontando para o banco antigo), nada
 * funciona: login, painel, licenças e suporte quebram com erros genéricos.
 * Em vez de tela preta / "system_error", mostramos um aviso claro.
 */
const EXPECTED_PROJECT_REF = "yvvjaoqzhjqnchhwhwvy";

function currentRef(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return null;
  const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

export function BackendMismatchBanner() {
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    const found = currentRef();
    if (found && found !== EXPECTED_PROJECT_REF) {
      console.error(
        `[shadow] Backend incorreto: build usando "${found}", esperado "${EXPECTED_PROJECT_REF}". ` +
          "Atualize VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY no host (Vercel) e refaça o deploy.",
      );
      setRef(found);
    }
  }, []);

  if (!ref) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-danger px-4 py-2 text-center font-mono text-xs text-danger-foreground">
      Configuração do servidor desatualizada neste domínio. Alguns recursos podem falhar — estamos
      corrigindo. (backend: {ref})
    </div>
  );
}
