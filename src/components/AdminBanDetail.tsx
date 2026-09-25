import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { adminBanDetail } from "@/lib/ban.functions";

export function AdminBanDetail({ banId }: { banId: string }) {
  const fetchDetail = useServerFn(adminBanDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-ban-detail", banId],
    queryFn: () => fetchDetail({ data: { banId } }),
  });
  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (error) return <p className="text-xs text-destructive">{String((error as any)?.message ?? error)}</p>;
  if (!data) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h4 className="mb-1 font-mono text-[11px] uppercase text-muted-foreground">
          Contas ligadas ({data.linked.length}) · {data.devices} aparelho(s)
        </h4>
        {data.linked.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma outra conta encontrada.</p>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {data.linked.map((l: any) => (
              <li key={l.id} className="font-mono">
                {l.email} <span className="text-muted-foreground">· criada {new Date(l.created_at).toLocaleDateString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="mb-1 font-mono text-[11px] uppercase text-muted-foreground">Histórico de infrações</h4>
        <ul className="max-h-60 space-y-1 overflow-y-auto text-xs">
          {data.history.map((h: any, i: number) => (
            <li key={i}>
              <span className="text-muted-foreground">{new Date(h.at).toLocaleString("pt-BR")}</span>{" "}
              <strong>{h.kind}</strong> — <span className="break-words">{h.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
