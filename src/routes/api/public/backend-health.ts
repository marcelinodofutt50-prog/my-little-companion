import { createFileRoute } from "@tanstack/react-router";

/**
 * Diagnóstico público mínimo: só informa se o servidor está apontando para o
 * MESMO projeto de backend que o navegador usa e se as chaves estão presentes.
 *
 * Nada de prefixos de chave nem de refs fixos no código: o "esperado" vem da
 * configuração do próprio deploy, então trocar de projeto não gera alarme falso.
 */
function refFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

export const Route = createFileRoute("/api/public/backend-health")({
  server: {
    handlers: {
      GET: async () => {
        const serverRef = refFromUrl(process.env.SUPABASE_URL);
        const clientRef =
          refFromUrl(process.env.VITE_SUPABASE_URL) ??
          (process.env.VITE_SUPABASE_PROJECT_ID || null);

        const hasPublishable = (process.env.SUPABASE_PUBLISHABLE_KEY ?? "").length > 0;
        const hasServiceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length > 0;

        // Só considera divergência quando os dois lados existem e são diferentes.
        const matches = !clientRef || !serverRef ? true : clientRef === serverRef;
        const ok = matches && hasPublishable && hasServiceRole;

        const body = {
          ok,
          server_project_ref: serverRef,
          client_project_ref: clientRef,
          server_matches_client: matches,
          has_publishable_key: hasPublishable,
          has_service_role_key: hasServiceRole,
        };

        return new Response(JSON.stringify(body, null, 2), {
          status: ok ? 200 : 500,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
