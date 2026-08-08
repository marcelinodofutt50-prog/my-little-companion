import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { forceReloadSchema } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const triggerReload = useServerFn(forceReloadSchema);

  useEffect(() => {
    // Implemente uma rotina de verificação automática do schema no carregamento do Centro de Treinamento para detectar e corrigir o cache antes que o usuário veja o erro.
    // to prevent common "relation not in cache" or permission stale errors
    // only if the user is likely staff (the function checks internally anyway)
    const checkAndReload = async () => {
      try {
        await triggerReload();
        console.log("[auth-gate] Schema sync successful");
      } catch (e) {
        // We don't block the UI if this fails as it's a background optimization
        console.warn("[auth-gate] Background schema sync skipped or failed", e);
      }
    };

    checkAndReload();
  }, [triggerReload]);

  return <Outlet />;
}


