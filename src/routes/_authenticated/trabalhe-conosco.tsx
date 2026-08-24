import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, Briefcase, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { BackToDashboard } from "@/components/BackToDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getMyStaffApplication, submitStaffApplication } from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/trabalhe-conosco")({
  head: () => ({
    meta: [
      { title: "Vagas na equipe Shadow — Candidatura de staff" },
      {
        name: "description",
        content:
          "Candidate-se para entrar na equipe Shadow: atendimento aos clientes e assinatura de APKs, com bolsa mensal de R$ 350 para membros experientes.",
      },
      { property: "og:title", content: "Vagas na equipe Shadow — Candidatura de staff" },
      {
        property: "og:description",
        content: "Entre para a equipe Shadow: suporte e assinatura de APKs, R$ 350/mês.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffApplicationPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Em análise",
  reviewing: "Sendo avaliada",
  approved: "Aprovada",
  rejected: "Recusada",
  archived: "Arquivada",
};

const AREAS = [
  { value: "suporte", label: "Atendimento / Suporte" },
  { value: "apk", label: "Assinatura de APKs" },
  { value: "ambos", label: "Suporte + APKs" },
];

function StaffApplicationPage() {
  const queryClient = useQueryClient();
  const submitFn = useServerFn(submitStaffApplication);
  const myFn = useServerFn(getMyStaffApplication);

  const { data: mine, isLoading } = useQuery({
    queryKey: ["my-staff-application"],
    queryFn: () => myFn(),
    retry: false,
  });

  const [form, setForm] = useState({
    full_name: "",
    discord_tag: "",
    area: "suporte",
    availability: "",
    experience: "",
    motivation: "",
  });

  const submit = useMutation({
    mutationFn: () => submitFn({ data: form }),
    onSuccess: () => {
      toast.success("Candidatura enviada! A equipe vai avaliar e responder por aqui.");
      queryClient.invalidateQueries({ queryKey: ["my-staff-application"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível enviar sua candidatura"),
  });

  const errors: string[] = [];
  if (form.full_name.trim().length < 3) errors.push("Informe seu nome completo.");
  if (form.experience.trim().length < 10) errors.push("Descreva sua experiência (mín. 10 caracteres).");
  if (!form.availability.trim()) errors.push("Informe sua disponibilidade de horário.");
  if (form.motivation.trim().length < 20) errors.push("Conte por que quer entrar (mín. 20 caracteres).");

  const pending = mine && ["pending", "reviewing"].includes(String(mine.status));

  return (
    <div className="container mx-auto max-w-3xl p-4 md:p-8">
      <header className="mb-6 space-y-3">
        <BackToDashboard />
        <h1 className="flex items-center gap-3 font-display text-3xl font-black uppercase italic tracking-tighter">
          <Briefcase className="h-8 w-8 text-primary" /> Entre para a{" "}
          <span className="text-primary underline">Equipe</span>
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // Staff Recruitment — Suporte &amp; Assinatura de APKs
        </p>
      </header>

      <Card className="mb-4 border-primary/20 bg-card/40">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm">
              <strong>R$ 350 por mês</strong>
              <br />
              <span className="text-muted-foreground">pagos mensalmente</span>
            </p>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm">
              <strong>Rotina leve</strong>
              <br />
              <span className="text-muted-foreground">responder clientes e assinar alguns APKs</span>
            </p>
          </div>
          <div className="flex items-start gap-2">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm">
              <strong>Só experientes</strong>
              <br />
              <span className="text-muted-foreground">precisa já conhecer o sistema</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : pending ? (
        <Card className="border-primary/20 bg-card/40">
          <CardContent className="space-y-2 p-6 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Status: {STATUS_LABEL[String(mine!.status)] ?? mine!.status}
            </p>
            <p className="text-sm text-muted-foreground">
              Sua candidatura já foi recebida. A equipe responde pelo chat de suporte assim que avaliar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/20 bg-card/40">
          <CardContent className="space-y-3 p-4">
            {mine && (
              <p className="rounded-lg border border-primary/15 bg-primary/5 p-2 text-xs text-muted-foreground">
                Última candidatura: {STATUS_LABEL[String(mine.status)] ?? mine.status}
                {mine.admin_notes ? ` — ${mine.admin_notes}` : ""}
              </p>
            )}
            <Input
              placeholder="Nome completo"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
            <Input
              placeholder="Discord / Telegram (opcional)"
              value={form.discord_tag}
              onChange={(e) => setForm({ ...form, discord_tag: e.target.value })}
            />
            <select
              aria-label="Área desejada"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            >
              {AREAS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <Input
              placeholder="Disponibilidade (ex.: das 18h às 23h, todos os dias)"
              value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value })}
            />
            <Textarea
              placeholder="Sua experiência: há quanto tempo usa o sistema, já deu suporte, já assinou APK..."
              className="min-h-[120px]"
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
            />
            <Textarea
              placeholder="Por que você quer fazer parte da equipe?"
              className="min-h-[120px]"
              value={form.motivation}
              onChange={(e) => setForm({ ...form, motivation: e.target.value })}
            />

            {errors.length > 0 && (
              <ul className="space-y-1 text-xs text-destructive">
                {errors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            )}

            <Button
              className="w-full"
              disabled={errors.length > 0 || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar candidatura
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
