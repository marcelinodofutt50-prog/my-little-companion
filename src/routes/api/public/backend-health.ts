import { createFileRoute } from "@tanstack/react-router";

/**
 * Diagnóstico público (sem segredos): mostra apenas QUAL projeto de backend o
 * SERVIDOR está usando e se as chaves estão presentes. Nenhum valor de chave é
 * exposto — só o "ref" do projeto, que já é público no bundle do navegador.
 */
const EXPECTED_REF = "yvvjaoqzhjqnchhwhwvy";

function refFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

export const Route = createFileRoute("/api/public/backend-health")({
  server: {
    handlers: {
      GET: async () => {
        const serverRef = refFromUrl(process.env.SUPABASE_URL);
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

        const body = {
          expected_project_ref: EXPECTED_REF,
          server_project_ref: serverRef,
          server_matches_expected: serverRef === EXPECTED_REF,
          has_publishable_key: publishable.length > 0,
          publishable_key_prefix: publishable.slice(0, 16) || null,
          has_service_role_key: serviceRole.length > 0,
          service_role_key_prefix: serviceRole.slice(0, 10) || null,
        };

        return new Response(JSON.stringify(body, null, 2), {
          status: body.server_matches_expected ? 200 : 500,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
