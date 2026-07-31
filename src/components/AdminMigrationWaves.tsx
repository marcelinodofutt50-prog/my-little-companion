import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Megaphone, ShieldOff, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminListMigrationWaves,
  adminOpenMigrationWave,
  adminCloseMigrationWave,
} from "@/lib/migration-wave.functions";
import { toast } from "sonner";

const PANEL_LABEL: Record<string, string> = { v455: "4.5.5", v457: "4.5.7", v46: "4.6" };

export function AdminMigrationWaves() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListMigrationWaves);
  const openFn = useServerFn(adminOpenMigrationWave);
  const closeFn = useServerFn(adminCloseMigrationWave);

  const [panel, setPanel] = useState<"v455" | "v457" | "v46">("v46");
  const [title, setTitle] = useState("Novo servidor disponível — gere seu login novo");
  const [serverLabel, setServerLabel] = useState("");
  const [instructions, setInstructions] = useState("");
  const [hours, setHours] = useState(48);
  const [isTest, setIsTest] = useState(false);
  const [noDeadline, setNoDeadline] = useState(true);
  const [testBaseUrl, setTestBaseUrl] = useState("");
  const [testAdminKey, setTestAdminKey] = useState("");
  const [busy, setBusy] = useState(false);


  const { data: waves = [] } = useQuery({
    queryKey: ["admin-migration-waves"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });

  const publish = async () => {
    if (
      !confirm(
        isTest
          ? `Publicar o CONVITE DE TESTE do painel ${PANEL_LABEL[panel]}? Ninguém perde o login antigo.`
          : `Publicar a onda de migração do painel ${PANEL_LABEL[panel]}?`,
      )
    )
      return;
    setBusy(true);
    try {
      await openFn({
        data: {
          panel,
          title,
          instructions,
          serverLabel: serverLabel || null,
          deadlineHours: hours,
          isTest,
          hasDeadline: isTest ? !noDeadline : true,
          testBaseUrl: isTest && testBaseUrl.trim() ? testBaseUrl.trim() : null,
          testAdminKey: isTest && testAdminKey.trim() ? testAdminKey.trim() : null,
        },

      });
      toast.success(
        isTest
          ? "Convite de teste publicado — os clientes podem testar sem perder o login antigo"
          : "Onda publicada — os clientes elegíveis já veem o aviso",
      );
      qc.invalidateQueries({ queryKey: ["admin-migration-waves"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao publicar");
    } finally {
      setBusy(false);
    }
  };

  const close = async (id: string, revokeOld: boolean) => {
    if (
      !confirm(
        revokeOld
          ? "Encerrar AGORA e revogar todos os logins antigos deste painel?"
          : "Encerrar a onda sem revogar nada?",
      )
    )
      return;
    setBusy(true);
    try {
      const r = await closeFn({ data: { waveId: id, revokeOld } });
      toast.success(revokeOld ? `Encerrada · ${r.revoked} login(s) revogado(s)` : "Onda encerrada");
      qc.invalidateQueries({ queryKey: ["admin-migration-waves"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao encerrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-border bg-background/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-sm tracking-tight">
          <Megaphone className="h-4 w-4 text-neon" />
          Onda de migração de servidor
        </CardTitle>
        <p className="font-mono text-[11px] text-muted-foreground">
          Avisa quem já tem login no painel escolhido, deixa gerar o login novo no servidor atual e
          revoga o antigo quando o prazo acabar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer items-start gap-2 rounded-md border border-violet/40 bg-violet/5 p-2.5">
          <input
            type="checkbox"
            checked={isTest}
            onChange={(e) => {
              const v = e.target.checked;
              setIsTest(v);
              setTitle(
                v
                  ? "Novo update em teste — crie um login e teste o servidor novo"
                  : "Novo servidor disponível — gere seu login novo",
              );
            }}
            className="mt-0.5 h-3.5 w-3.5 accent-violet-500"
          />
          <span className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            <span className="text-foreground">Servidor em teste (beta)</span> — o cliente recebe um
            convite opcional para criar um login e testar o servidor novo.{" "}
            <span className="text-foreground">Nada é revogado.</span> Você pode deixar sem prazo ou
            definir um prazo de teste — quando acabar, o convite encerra sozinho.
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-wider">Painel</Label>
            <select
              value={panel}
              onChange={(e) => setPanel(e.target.value as any)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
            >
              <option value="v46">Shadow 4.6</option>
              <option value="v457">Shadow 4.5.7</option>
              <option value="v455">Shadow 4.5.5</option>
            </select>
          </div>
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-wider">
              {isTest ? "Prazo do teste (horas)" : "Prazo (horas)"}
            </Label>
            <Input
              type="number"
              min={2}
              max={240}
              value={hours}
              disabled={isTest && noDeadline}
              onChange={(e) => setHours(Number(e.target.value))}
              className="mt-1 h-9 font-mono text-xs disabled:opacity-50"
            />
            {isTest ? (
              <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={noDeadline}
                  onChange={(e) => setNoDeadline(e.target.checked)}
                  className="h-3 w-3 accent-violet-500"
                />
                Sem prazo (teste fica aberto até eu encerrar)
              </label>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <Label className="font-mono text-[10px] uppercase tracking-wider">Título do aviso</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 h-9 font-mono text-xs"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="font-mono text-[10px] uppercase tracking-wider">
              Nome do servidor novo (opcional)
            </Label>
            <Input
              value={serverLabel}
              onChange={(e) => setServerLabel(e.target.value)}
              placeholder="VPS 2 · 200.9.154.103"
              className="mt-1 h-9 font-mono text-xs"
            />
          </div>
          {isTest ? (
            <div className="sm:col-span-2 space-y-3 rounded-md border border-violet/40 bg-violet/5 p-3">
              <p className="font-mono text-[11px] text-muted-foreground">
                <span className="text-foreground">VPS do servidor beta</span> — preencha para que os
                logins de teste sejam criados nesta VPS. Se deixar vazio, usa a VPS oficial do
                painel selecionado.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="font-mono text-[10px] uppercase tracking-wider">
                    Endereço da VPS de teste
                  </Label>
                  <Input
                    value={testBaseUrl}
                    onChange={(e) => setTestBaseUrl(e.target.value)}
                    placeholder="http://200.9.154.103/yaarsa/proxy.php"
                    className="mt-1 h-9 font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="font-mono text-[10px] uppercase tracking-wider">
                    Admin key da VPS de teste
                  </Label>
                  <Input
                    type="password"
                    value={testAdminKey}
                    onChange={(e) => setTestAdminKey(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 h-9 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <Label className="font-mono text-[10px] uppercase tracking-wider">
              Instruções extras para o cliente (opcional)
            </Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              className="mt-1 font-mono text-xs"
              placeholder="Ex.: resuma seus clientes na BT Mob antes de migrar."
            />
          </div>
        </div>
        <Button
          onClick={publish}
          disabled={busy || title.trim().length < 4}
          className="font-mono text-[11px] uppercase tracking-wider"
        >
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Publicar onda de migração
        </Button>

        <div className="space-y-2 pt-2">
          {waves.length === 0 ? (
            <p className="font-mono text-[11px] text-muted-foreground">Nenhuma onda publicada.</p>
          ) : (
            waves.map((w: any) => (
              <div
                key={w.id}
                className="rounded-md border border-border bg-muted/20 p-3 font-mono text-[11px]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                      w.is_active ? "bg-neon/15 text-neon" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {w.is_active ? "ativa" : "encerrada"}
                  </span>
                  {w.is_test ? (
                    <span className="rounded bg-violet/15 px-1.5 py-0.5 text-[10px] uppercase text-violet">
                      teste
                    </span>
                  ) : null}
                  {w.is_active && w.has_deadline !== false && new Date(w.deadline_at).getTime() <= Date.now() ? (
                    <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[10px] uppercase text-danger">
                      prazo vencido
                    </span>
                  ) : null}
                  <span className="text-foreground">Painel {PANEL_LABEL[w.panel] ?? w.panel}</span>
                  <span className="text-muted-foreground">{w.title}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-muted-foreground">
                  {w.has_deadline === false ? (
                    <span className="flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      sem prazo (teste)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      {w.is_test ? "prazo do teste " : "prazo "}
                      {new Date(w.deadline_at).toLocaleString("pt-BR")}
                    </span>
                  )}
                  <span>{w.is_test ? "testando" : "migrados"}: {w.migratedCount}</span>
                  <span>faltando: {w.pendingCount}</span>
                  {w.votes ? (
                    <span className="text-violet">
                      votos: {w.votes.approvePct}% aprovam ({w.votes.approve} sim / {w.votes.reject}{" "}
                      não · {w.votes.total} votos)
                    </span>
                  ) : null}
                </div>
                {w.votes && w.votes.total > 0 ? (
                  <div className="mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-violet" style={{ width: `${w.votes.approvePct}%` }} />
                  </div>
                ) : null}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {w.is_test
                    ? w.is_active
                      ? w.has_deadline !== false && new Date(w.deadline_at).getTime() <= Date.now()
                        ? "Prazo do teste vencido — o convite encerra sozinho na próxima rodada do cron (a cada 15 min). Nada é revogado."
                        : `Convite de teste ativo — ${w.migratedCount} cliente(s) já criaram login no servidor novo. Nada é revogado.`
                      : "Convite de teste encerrado."
                    : !w.is_active
                    ? "Onda encerrada — os clientes não conseguem mais gerar login novo por aqui."
                    : new Date(w.deadline_at).getTime() <= Date.now()
                      ? "Prazo vencido: o botão do cliente está bloqueado. A revogação automática roda a cada 15 min."
                      : w.pendingCount === 0
                        ? "Todos os elegíveis já migraram — pode revogar os antigos com segurança."
                        : `${w.pendingCount} login(s) ainda no servidor antigo.`}
                </p>

                {w.is_active && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => close(w.id, false)}
                      className="h-7 font-mono text-[10px] uppercase"
                    >
                      Encerrar sem revogar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => close(w.id, true)}
                      className={`h-7 font-mono text-[10px] uppercase ${w.is_test ? "hidden" : ""}`}
                    >
                      <ShieldOff className="mr-1.5 h-3 w-3" />
                      Revogar antigos agora
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
