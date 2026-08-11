import { useEffect, useState } from "react";

/**
 * Referência do backend oficial deste projeto.
 * Se o site for publicado com variáveis de ambiente de outro projeto
 * (ex.: um deploy antigo na Vercel apontando para o banco antigo), nada
 * funciona: login, painel, licenças e suporte quebram com erros genéricos.
 * Em vez de tela preta / "system_error", mostramos um aviso claro.
 */
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
    if (!found) return;
    fetch('/api/public/backend-health', { cache: 'no-store' })
      .then((response) => response.json())
      .then((health: { ok?: boolean; server_project_ref?: string | null }) => {
        if (health.ok === false || (health.server_project_ref && health.server_project_ref !== found)) {
          console.error(`[shadow] Backend divergente: frontend=${found}, servidor=${health.server_project_ref ?? 'ausente'}.`);
          setRef(found);
        }
      })
      .catch(() => undefined);
  }, []);

  if (!ref) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-danger px-4 py-2 text-center font-mono text-xs text-background">
      Configuração do servidor desatualizada neste domínio. Alguns recursos podem falhar — estamos
      corrigindo. (backend: {ref})
    </div>
  );
}
