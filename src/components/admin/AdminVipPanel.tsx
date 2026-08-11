import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Diamond, Gift, RefreshCw, Save, ShieldCheck, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  adminGetVipOverview,
  adminUpdateVipConfig,
  adminUpsertMission,
  adminToggleMission,
  adminGrantPlayProtect,
  adminRecalcAllVipTiers,
} from "@/lib/vip-admin.functions";

const TIER_LABELS: Record<string, string> = {
  none: "Sem VIP",
  bronze: "Bronze",
  silver: "Prata",
  gold: "Ouro",
  diamond: "Diamante",
  elite: "Elite",
  vip: "VIP",
};

const REQ_TYPES = [
  ["profile_setup", "Completar perfil"],
  ["trial_generation", "Gerar testes grátis"],
  ["tutorial_completion", "Concluir treinamentos"],
  ["referral", "Indicações válidas"],
  ["conversion", "Conversões"],
  ["purchase", "Licenças compradas"],
  ["community_message", "Mensagens no Nexus"],
  ["loyalty_points", "Pontos de fidelidade"],
  ["days_active", "Dias ativo"],
] as const;

export function AdminVipPanel() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(adminGetVipOverview);
  const updateConfigFn = useServerFn(adminUpdateVipConfig);
  const upsertMissionFn = useServerFn(adminUpsertMission);
  const toggleMissionFn = useServerFn(adminToggleMission);
  const grantFn = useServerFn(adminGrantPlayProtect);
  const recalcFn = useServerFn(adminRecalcAllVipTiers);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-vip-overview"],
    queryFn: () => overviewFn({}),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-vip-overview"] });

  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [grantEmail, setGrantEmail] = useState("");
  const [grantDays, setGrantDays] = useState(7);
  const [mission, setMission] = useState({
    title: "",
    description: "",
    difficulty: "medium" as "easy" | "medium" | "hard",
    reward_points: 100,
    requirement_type: "referral" as (typeof REQ_TYPES)[number][0],
    requirement_count: 1,
    min_vip_tier: "bronze" as "none" | "bronze" | "silver" | "gold" | "diamond" | "elite",
  });

  const saveConfig = useMutation({
    mutationFn: (vars: any) => updateConfigFn({ data: vars }),
    onSuccess: () => {
      toast.success("Requisitos VIP atualizados.");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveMission = useMutation({
    mutationFn: () => upsertMissionFn({ data: { ...mission, status: "active" } as any }),
    onSuccess: () => {
      toast.success("Missão publicada.");
      setMission((m) => ({ ...m, title: "", description: "" }));
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMission = useMutation({
    mutationFn: (vars: { id: string; status: "active" | "inactive" }) =>
      toggleMissionFn({ data: vars }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const grant = useMutation({
    mutationFn: () => grantFn({ data: { email: grantEmail, days: grantDays } }),
    onSuccess: () => {
      toast.success("Bypass Play Protect concedido.");
      setGrantEmail("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const recalc = useMutation({
    mutationFn: () => recalcFn({}),
    onSuccess: (r: any) => {
      toast.success(`Tiers recalculados para ${r.updated} membros.`);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return <p className="text-xs font-mono text-muted-foreground">Carregando painel VIP…</p>;
  }

  const d: any = data || { configs: [], missions: [], grants: [], distribution: {}, totals: {} };

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Membros</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold font-mono">{d.totals.members ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Clientes VIP</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold font-mono text-yellow-500">{d.totals.vips ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Bypass ativos</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold font-mono text-primary">{d.totals.activeGrants ?? 0}</CardContent>
        </Card>
      </div>

      {/* Distribuição */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
            <Diamond className="h-4 w-4 text-yellow-500" /> Distribuição por tier
          </CardTitle>
          <CardDescription className="text-xs">
            Quantidade de clientes em cada nível VIP.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(d.distribution as Record<string, number>).map(([tier, count]) => (
            <Badge key={tier} variant="outline" className="font-mono text-[10px]">
              {TIER_LABELS[tier] || tier}: {count}
            </Badge>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-7 text-[10px] font-mono uppercase"
            disabled={recalc.isPending}
            onClick={() => recalc.mutate()}
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Recalcular tiers
          </Button>
        </CardContent>
      </Card>

      {/* Requisitos por tier */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Requisitos de cada tier
          </CardTitle>
          <CardDescription className="text-xs">
            Defina o que o cliente precisa para alcançar cada nível.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(d.configs as any[]).map((c) => {
            const draft = drafts[c.tier] || c;
            const set = (k: string, v: number) =>
              setDrafts((p) => ({ ...p, [c.tier]: { ...draft, [k]: v } }));
            return (
              <div key={c.tier} className="grid gap-2 sm:grid-cols-6 items-center">
                <Badge variant="outline" className="font-mono text-[10px] justify-center">
                  {TIER_LABELS[c.tier] || c.tier}
                </Badge>
                {[
                  ["min_loyalty_points", "Pontos"],
                  ["min_months_active", "Meses"],
                  ["min_conversions", "Conversões"],
                  ["min_reputation", "Reputação"],
                ].map(([key, label]) => (
                  <label key={key} className="text-[10px] font-mono uppercase text-muted-foreground">
                    {label}
                    <Input
                      type="number"
                      className="h-8 mt-1"
                      value={draft[key!] ?? 0}
                      onChange={(e) => set(key!, Number(e.target.value))}
                    />
                  </label>
                ))}
                <Button
                  size="sm"
                  className="h-8 text-[10px] font-mono uppercase"
                  disabled={saveConfig.isPending}
                  onClick={() =>
                    saveConfig.mutate({
                      tier: c.tier,
                      min_loyalty_points: Number(draft.min_loyalty_points || 0),
                      min_months_active: Number(draft.min_months_active || 0),
                      min_conversions: Number(draft.min_conversions || 0),
                      min_reputation: Number(draft.min_reputation || 0),
                    })
                  }
                >
                  <Save className="h-3 w-3 mr-1" /> Salvar
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Missões */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Missões (padrão e VIP)
          </CardTitle>
          <CardDescription className="text-xs">
            Crie missões e escolha se elas são exclusivas para clientes VIP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              placeholder="Título da missão"
              value={mission.title}
              onChange={(e) => setMission({ ...mission, title: e.target.value })}
            />
            <Input
              placeholder="Descrição"
              className="sm:col-span-2"
              value={mission.description}
              onChange={(e) => setMission({ ...mission, description: e.target.value })}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-xs"
              value={mission.requirement_type}
              onChange={(e) => setMission({ ...mission, requirement_type: e.target.value as any })}
            >
              {REQ_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <Input
              type="number"
              placeholder="Quantidade"
              value={mission.requirement_count}
              onChange={(e) => setMission({ ...mission, requirement_count: Number(e.target.value) })}
            />
            <Input
              type="number"
              placeholder="Pontos de recompensa"
              value={mission.reward_points}
              onChange={(e) => setMission({ ...mission, reward_points: Number(e.target.value) })}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-xs"
              value={mission.min_vip_tier}
              onChange={(e) => setMission({ ...mission, min_vip_tier: e.target.value as any })}
            >
              <option value="none">Missão aberta a todos</option>
              <option value="bronze">Exclusiva VIP Bronze+</option>
              <option value="silver">Exclusiva VIP Prata+</option>
              <option value="gold">Exclusiva VIP Ouro+</option>
              <option value="diamond">Exclusiva VIP Diamante+</option>
              <option value="elite">Exclusiva VIP Elite</option>
            </select>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-xs"
              value={mission.difficulty}
              onChange={(e) => setMission({ ...mission, difficulty: e.target.value as any })}
            >
              <option value="easy">Fácil</option>
              <option value="medium">Média</option>
              <option value="hard">Difícil</option>
            </select>
            <Button
              className="h-9 text-[10px] font-mono uppercase"
              disabled={saveMission.isPending || mission.title.trim().length < 3}
              onClick={() => saveMission.mutate()}
            >
              Publicar missão
            </Button>
          </div>

          <div className="space-y-2">
            {(d.missions as any[]).map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 p-2"
              >
                <span className="text-xs font-mono flex-1 min-w-[160px]">{m.title}</span>
                <Badge variant="outline" className="text-[9px] font-mono">+{m.reward_points} XP</Badge>
                {m.minVipTier && (
                  <Badge variant="outline" className="text-[9px] font-mono border-yellow-500/40 text-yellow-500">
                    VIP {String(m.minVipTier).toUpperCase()}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={m.status === "active" ? "text-[9px] text-green-500" : "text-[9px] text-muted-foreground"}
                >
                  {m.status === "active" ? "Ativa" : "Inativa"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] font-mono uppercase"
                  onClick={() =>
                    toggleMission.mutate({
                      id: m.id,
                      status: m.status === "active" ? "inactive" : "active",
                    })
                  }
                >
                  {m.status === "active" ? "Desativar" : "Ativar"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bypass Play Protect */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
            <Gift className="h-4 w-4 text-yellow-500" /> Bypass Play Protect
          </CardTitle>
          <CardDescription className="text-xs">
            Conceda dias avulsos e acompanhe as concessões recentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="E-mail do cliente"
              className="max-w-xs"
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
            />
            <Input
              type="number"
              className="w-24"
              value={grantDays}
              onChange={(e) => setGrantDays(Number(e.target.value))}
            />
            <Button
              className="h-9 text-[10px] font-mono uppercase"
              disabled={grant.isPending || !grantEmail.includes("@")}
              onClick={() => grant.mutate()}
            >
              Conceder
            </Button>
          </div>
          <div className="space-y-1">
            {(d.grants as any[]).length === 0 && (
              <p className="text-xs font-mono text-muted-foreground">Nenhuma concessão registrada.</p>
            )}
            {(d.grants as any[]).map((g) => (
              <div key={g.id} className="flex items-center gap-2 text-[11px] font-mono">
                <span className="flex-1 truncate">{g.email}</span>
                <span className="text-muted-foreground">{g.source}</span>
                <Badge variant="outline" className={g.active ? "text-green-500 text-[9px]" : "text-muted-foreground text-[9px]"}>
                  {g.active ? "Ativo" : "Expirado"}
                </Badge>
                <span className="text-muted-foreground">
                  {new Date(g.expires_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
