import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { getMyBanStatus } from "@/lib/ban.functions";
import { supabase } from "@/integrations/supabase/client";

/** Faixa fixa exibida para contas banidas por múltiplas contas. */
export function BanNotice() {
  const fetchBan = useServerFn(getMyBanStatus);
  const { data } = useQuery({
    queryKey: ["my-ban-status"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return null;
      return fetchBan();
    },
    staleTime: 60_000,
  });
  if (!data?.banned) return null;
  const pct = Math.round((data.priceMultiplier - 1) * 100);
  return (
    <div role="alert" className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          <strong>Conta banida</strong> por violar as regras do site (várias contas). Teste grátis, APK grátis, códigos, cupons,
          indicações e Comunidade estão bloqueados{pct > 0 ? ` e os preços têm acréscimo de ${pct}%` : ""}.
        </span>
        <Link to="/suporte" className="underline underline-offset-2">Falar com o suporte</Link>
      </div>
    </div>
  );
}
