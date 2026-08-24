import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Briefcase, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { listStaffApplications, updateApplicationStatus } from "@/lib/staff.functions";

const STATUS: { value: "pending" | "reviewing" | "approved" | "rejected" | "archived"; label: string }[] = [
  { value: "pending", label: "Pendente" },
  { value: "reviewing", label: "Avaliando" },
  { value: "approved", label: "Aprovar" },
  { value: "rejected", label: "Recusar" },
  { value: "archived", label: "Arquivar" },
];

export function AdminStaffApplicationsPanel() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listStaffApplications);
  const updateFn = useServerFn(updateApplicationStatus);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-applications"],
    queryFn: () => listFn(),
    retry: false,
  });

  const update = useMutation({
    mutationFn: (v: { id: string; status: any; admin_notes?: string }) => updateFn({ data: v }),
    onSuccess: () => {
      toast.success("Candidatura atualizada");
      queryClient.invalidateQueries({ queryKey: ["staff-applications"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  if (error) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 p-6 text-center text-sm">
        {(error as any)?.message ?? "Falha ao carregar candidaturas."}
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const items = (data ?? []) as any[];

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {items.length} candidatura(s) · vaga de R$ 350/mês (suporte + assinatura de APKs)
      </p>

      {items.length === 0 ? (
        <Card className="border-dashed border-primary/20 bg-card/20 p-12 text-center">
          <Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Nenhuma candidatura recebida ainda.</p>
        </Card>
      ) : (
        items.map((a) => (
          <Card key={a.id} className="border-primary/15 bg-card/30">
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold">{a.full_name}</h3>
                <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary">
                  {a.status ?? "pending"}
                </span>
                <span className="font-mono text-[9px] uppercase text-muted-foreground">
                  {a.area} · {a.email ?? a.user_id}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Disponibilidade: {a.availability || "—"} · Contato: {a.discord_tag || "—"}
              </p>
              <p className="whitespace-pre-wrap text-sm">
                <strong>Experiência:</strong> {a.experience || "—"}
              </p>
              <p className="whitespace-pre-wrap text-sm">
                <strong>Motivação:</strong> {a.motivation || "—"}
              </p>
              <Textarea
                placeholder="Observações internas (opcional)"
                className="min-h-[60px] text-xs"
                value={notes[a.id] ?? a.admin_notes ?? ""}
                onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                {STATUS.map((s) => (
                  <Button
                    key={s.value}
                    size="sm"
                    variant={a.status === s.value ? "default" : "outline"}
                    className="h-7 font-mono text-[10px] uppercase"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({ id: a.id, status: s.value, admin_notes: notes[a.id] ?? a.admin_notes ?? undefined })
                    }
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
