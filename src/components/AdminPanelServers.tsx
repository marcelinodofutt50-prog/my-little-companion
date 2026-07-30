import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Server, ShieldCheck, ShieldAlert, RotateCcw, Plug, Save, Stethoscope, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  adminListPanelServers,
  adminSavePanelServer,
  adminTestPanelServer,
  adminResetPanelServer,
  adminTestCurrentPanel,
  adminFullPanelCheck,
} from "@/lib/panel-servers.functions";

type PanelKey = "v457" | "v46";

const PANEL_META: Record<PanelKey, { title: string; hint: string }> = {
  v457: { title: "Servidor 4.5.7", hint: "VPS que gera os logins da versão 4.5.7" },
  v46: { title: "Servidor 4.6", hint: "VPS que gera os logins da versão 4.6 / lifetime" },
};

type Row = {
  panel: PanelKey;
  label: string;
  baseUrl: string;
  adminKeyMasked: string | null;
  adminKeyBroken: boolean;
  notes: string | null;
  isActive: boolean;
  updatedAt: string;
  updatedByEmail: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
};

type Draft = { label: string; baseUrl: string; adminKey: string; notes: string };

export function AdminPanelServers() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [effective, setEffective] = useState<Record<string, string>>({});
  const [envFallback, setEnvFallback] = useState<Record<string, string | null>>({});
  const [effectiveIp, setEffectiveIp] = useState<Record<string, string>>({});
  const [source, setSource] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<PanelKey, Draft>>({
    v457: { label: "", baseUrl: "", adminKey: "", notes: "" },
    v46: { label: "", baseUrl: "", adminKey: "", notes: "" },
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, { ok: boolean; message: string; serverIp: string; steps: { step: string; ok: boolean; detail: string }[] }>>({});

  const listFn = useServerFn(adminListPanelServers);
  const saveFn = useServerFn(adminSavePanelServer);
  const testFn = useServerFn(adminTestPanelServer);
  const resetFn = useServerFn(adminResetPanelServer);
  const testCurrentFn = useServerFn(adminTestCurrentPanel);
  const fullCheckFn = useServerFn(adminFullPanelCheck);

  async function load() {
    setLoading(true);
    try {
      const res: any = await listFn();
      setRows(res.rows ?? []);
      setEffective(res.effective ?? {});
      setEnvFallback(res.envFallback ?? {});
      setEffectiveIp(res.effectiveIp ?? {});
      setSource(res.source ?? {});
      setDrafts((prev) => {
        const next = { ...prev };
        for (const r of (res.rows ?? []) as Row[]) {
          next[r.panel] = {
            label: r.label ?? "",
            baseUrl: r.baseUrl ?? "",
            adminKey: "",
            notes: r.notes ?? "",
          };
        }
        return next;
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar servidores");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setDraft(panel: PanelKey, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [panel]: { ...d[panel], ...patch } }));
  }

  async function testDraft(panel: PanelKey) {
    const d = drafts[panel];
    if (!d.baseUrl.trim() || !d.adminKey.trim()) {
      toast.info("Preencha endereço e admin key para testar");
      return;
    }
    setBusy(`test-${panel}`);
    try {
      const res: any = await testFn({ data: { baseUrl: d.baseUrl.trim(), adminKey: d.adminKey.trim() } });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no teste");
    }
    setBusy(null);
  }

  async function save(panel: PanelKey, skipTest = false) {
    const d = drafts[panel];
    if (!d.baseUrl.trim()) {
      toast.info("Informe o endereço/IP do servidor");
      return;
    }
    const existing = rows.find((r) => r.panel === panel);
    if (!existing && !d.adminKey.trim()) {
      toast.info("Informe a admin key do novo servidor");
      return;
    }
    setBusy(`save-${panel}`);
    try {
      const res: any = await saveFn({
        data: {
          panel,
          label: d.label.trim(),
          baseUrl: d.baseUrl.trim(),
          adminKey: d.adminKey.trim() || null,
          notes: d.notes.trim() || null,
          isActive: true,
          skipTest,
        },
      });
      if (res.saved) {
        toast.success(res.message ?? "Servidor salvo");
        setDraft(panel, { adminKey: "" });
        await load();
      } else {
        toast.error(res.message ?? "Não foi possível salvar");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    }
    setBusy(null);
  }

  async function resetPanel(panel: PanelKey) {
    setBusy(`reset-${panel}`);
    try {
      await resetFn({ data: { panel } });
      toast.success("Voltou a usar a configuração padrão do ambiente");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao resetar");
    }
    setBusy(null);
  }

  async function testCurrent(panel: PanelKey) {
    setBusy(`live-${panel}`);
    try {
      const res: any = await testCurrentFn({ data: { panel } });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no teste");
    }
    setBusy(null);
  }

  async function fullCheck(panel: PanelKey) {
    setBusy(`full-${panel}`);
    try {
      const res: any = await fullCheckFn({ data: { panel } });
      setChecks((c) => ({ ...c, [panel]: res }));
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na verificação");
    }
    setBusy(null);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 font-mono text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> carregando servidores…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-card/40 p-4">
        <div className="flex items-center gap-2 font-mono text-sm">
          <Server className="h-4 w-4 text-primary" />
          <span className="font-semibold">Servidores dos painéis (VPS)</span>
        </div>
        <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
          Troque a VPS de qualquer versão sem precisar de deploy. O que você salvar aqui passa a valer
          imediatamente para emissão, renovação, troca de senha e remoção de logins. A admin key é
          guardada criptografada e nunca aparece de volta na tela.
        </p>
      </div>

      {(["v457", "v46"] as PanelKey[]).map((panel) => {
        const row = rows.find((r) => r.panel === panel);
        const d = drafts[panel];
        const meta = PANEL_META[panel];
        return (
          <div key={panel} className="rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-mono text-sm font-semibold">{meta.title}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{meta.hint}</div>
              </div>
              <div className="flex items-center gap-2">
                {row ? (
                  <span className="rounded border border-primary/40 px-2 py-0.5 font-mono text-[10px] text-primary">
                    configurado no painel
                  </span>
                ) : (
                  <span className="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    usando ambiente
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={() => fullCheck(panel)}
                  disabled={busy === `full-${panel}`}
                  title="Simula uma compra real: cria o login, ajusta validade, define senha e apaga no fim"
                >
                  {busy === `full-${panel}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Stethoscope className="h-3.5 w-3.5" />
                  )}
                  Verificação completa
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testCurrent(panel)}
                  disabled={busy === `live-${panel}`}
                >
                  {busy === `live-${panel}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plug className="h-3.5 w-3.5" />
                  )}
                  Testar atual
                </Button>
              </div>
            </div>

            <div className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
              <div>
                em uso agora: <span className="text-foreground">{effective[panel] || "—"}</span>{" "}
                <span className="opacity-70">
                  ({source[panel] === "painel" ? "definido aqui" : source[panel] === "ambiente" ? "variável de ambiente" : "padrão do código"})
                </span>
              </div>
              <div>
                IP entregue ao cliente:{" "}
                <span className="text-foreground">{effectiveIp[panel] || "—"}</span>
              </div>
              {row?.adminKeyMasked && (
                <div>
                  admin key: <span className="text-foreground">{row.adminKeyMasked}</span>
                </div>
              )}
              {row?.adminKeyBroken && (
                <div className="text-danger">
                  a chave salva não pôde ser lida (LICENSE_ENC_KEY mudou) — salve a admin key de novo
                </div>
              )}
              {!row && envFallback[panel] && <div>ambiente: {envFallback[panel]}</div>}
              {row?.lastTestAt && (
                <div className="flex items-center gap-1">
                  {row.lastTestOk ? (
                    <ShieldCheck className="h-3 w-3 text-primary" />
                  ) : (
                    <ShieldAlert className="h-3 w-3 text-danger" />
                  )}
                  último teste {new Date(row.lastTestAt).toLocaleString("pt-BR")} — {row.lastTestMessage}
                </div>
              )}
              {row?.updatedByEmail && <div>alterado por {row.updatedByEmail}</div>}
            </div>

            {checks[panel] && (
              <div
                className={`mt-3 rounded border p-3 font-mono text-[11px] ${
                  checks[panel].ok ? "border-primary/40 bg-primary/5" : "border-danger/40 bg-danger/5"
                }`}
              >
                <div className="mb-2 font-semibold">
                  {checks[panel].ok ? "Pronto para vender" : "Não está pronto"} — {checks[panel].message}
                </div>
                <ul className="space-y-1">
                  {checks[panel].steps.map((st, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {st.ok ? (
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                      ) : (
                        <X className="mt-0.5 h-3 w-3 shrink-0 text-danger" />
                      )}
                      <span>
                        {st.step} — <span className="text-muted-foreground">{st.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <label className="font-mono text-[10px] uppercase text-muted-foreground">Apelido</label>
                <Input
                  value={d.label}
                  onChange={(e) => setDraft(panel, { label: e.target.value })}
                  placeholder="ex.: VPS Contabo 2026"
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase text-muted-foreground">
                  Endereço / IP do servidor
                </label>
                <Input
                  value={d.baseUrl}
                  onChange={(e) => setDraft(panel, { baseUrl: e.target.value })}
                  placeholder="ex.: 191.96.78.81 ou http://meu-host/yaarsa/proxy.php"
                  className="font-mono text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="font-mono text-[10px] uppercase text-muted-foreground">
                  Admin key {row ? "(deixe vazio para manter a atual)" : ""}
                </label>
                <Input
                  value={d.adminKey}
                  onChange={(e) => setDraft(panel, { adminKey: e.target.value })}
                  type="password"
                  autoComplete="new-password"
                  placeholder="chave administrativa do painel"
                  className="font-mono text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="font-mono text-[10px] uppercase text-muted-foreground">Observações</label>
                <Textarea
                  value={d.notes}
                  onChange={(e) => setDraft(panel, { notes: e.target.value })}
                  rows={2}
                  placeholder="ex.: provedor, data da migração, limite de contas"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => testDraft(panel)} disabled={busy === `test-${panel}`}>
                {busy === `test-${panel}` ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plug className="h-3.5 w-3.5" />
                )}
                Testar conexão
              </Button>
              <Button size="sm" onClick={() => save(panel)} disabled={busy === `save-${panel}`}>
                {busy === `save-${panel}` ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Salvar e usar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => save(panel, true)}
                disabled={busy === `save-${panel}`}
                title="Grava mesmo que o teste falhe (use só se souber o que está fazendo)"
              >
                Forçar sem testar
              </Button>
              {row && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resetPanel(panel)}
                  disabled={busy === `reset-${panel}`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Voltar ao padrão
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
