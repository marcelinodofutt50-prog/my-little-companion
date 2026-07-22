import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Crown, ShieldCheck, Search, KeyRound, Loader2, CheckCircle2, ChevronDown, LifeBuoy, Sparkles, Server, RefreshCw, AlertTriangle, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { checkLegacyEmail, claimLegacyLicense } from "@/lib/license.functions";

type Panel = "v457" | "v46";

const panelMeta: Record<Panel, { label: string; version: string; tone: string; ip: string }> = {
  v46: { label: "Shadow 4.6", version: "Vitalício · prioridade", tone: "text-primary", ip: "200.9.154.103" },
  v457: { label: "Shadow 4.5.7", version: "Mensal · legacy", tone: "text-cyan", ip: "191.96.78.81" },
};

type ErrCategory = "network" | "credential" | "not_found" | "server" | "generic";
type CategorizedError = { message: string; category: ErrCategory; retryable: boolean };

function categorize(raw: string): CategorizedError {
  const m = (raw || "").toLowerCase();
  if (/network|fetch|failed to fetch|timeout|econnre|socket/.test(m)) {
    return { message: "Sem conexão com o servidor. Verifique sua internet.", category: "network", retryable: true };
  }
  if (/not found|não encontrado|nao encontrado|inexistente/.test(m)) {
    return { message: raw || "Email não localizado no painel selecionado.", category: "not_found", retryable: false };
  }
  if (/senha|password|invalid credential|unauthorized|401/.test(m)) {
    return { message: "Senha do painel incorreta. Confira e tente novamente.", category: "credential", retryable: true };
  }
  if (/painel:|yaarsa|500|502|503|internal/.test(m)) {
    return { message: raw || "Servidor de licenças indisponível. Tentaremos novamente em instantes.", category: "server", retryable: true };
  }
  return { message: raw || "Falha inesperada. Tente novamente.", category: "generic", retryable: true };
}

function formatBrDate(ymd: string | null): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

type ClaimResult = {
  ok: boolean;
  licenseId: string;
  already: boolean;
  panel: Panel;
  email: string;
  server_ip: string;
  next_renewal: string | null;
  version_tier: string;
};

export function LegacyConnectPanel({ defaultOpen = false, onLinked }: { defaultOpen?: boolean; onLinked?: () => void }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<CategorizedError | null>(null);
  const [attempts, setAttempts] = React.useState(0);
  const [result, setResult] = React.useState<{ found: boolean; panels: Panel[] } | null>(null);
  const [selectedPanel, setSelectedPanel] = React.useState<Panel | "">("");
  const [password, setPassword] = React.useState("");
  const [claiming, setClaiming] = React.useState(false);
  const [claimed, setClaimed] = React.useState<ClaimResult | null>(null);

  function copy(txt: string, label: string) {
    navigator.clipboard.writeText(txt).then(() => toast.success(`${label} copiado`)).catch(() => toast.error("Falha ao copiar"));
  }

  async function verify() {
    if (!email.trim()) { setErr({ message: "Informe o email do seu login antigo", category: "generic", retryable: false }); return; }
    setBusy(true); setErr(null); setResult(null); setAttempts((n) => n + 1);
    try {
      const r = await checkLegacyEmail({ data: { email: email.trim().toLowerCase() } });
      const panels = r.panels as Panel[];
      setResult({ found: r.found, panels });
      if (r.found) {
        setStep(2); setAttempts(0);
        if (panels.length === 1) setSelectedPanel(panels[0]);
        toast.success("Login encontrado no painel");
      } else {
        setErr({ message: "Email não localizado. Confira ou crie uma conta nova em /planos.", category: "not_found", retryable: false });
      }
    } catch (e: any) { setErr(categorize(e?.message)); toast.error("Falha na verificação"); }
    finally { setBusy(false); }
  }

  async function claim() {
    if (!selectedPanel) { setErr({ message: "Escolha o painel", category: "generic", retryable: false }); return; }
    if (!password.trim()) { setErr({ message: "Informe a senha atual do painel", category: "credential", retryable: false }); return; }
    setClaiming(true); setErr(null); setAttempts((n) => n + 1);
    try {
      const r = await claimLegacyLicense({
        data: { email: email.trim().toLowerCase(), password: password.trim(), panel: selectedPanel as Panel },
      }) as ClaimResult;
      setClaimed(r); setStep(3); setAttempts(0);
      onLinked?.();
      if (r.already) toast.info("Essa licença já estava vinculada — atualizando dashboard");
      else toast.success("Licença vinculada com sucesso");
    } catch (e: any) { setErr(categorize(e?.message)); toast.error("Não foi possível vincular"); }
    finally { setClaiming(false); }
  }

  function reset() {
    setStep(1); setEmail(""); setPassword(""); setResult(null); setSelectedPanel("");
    setClaimed(null); setErr(null); setAttempts(0);
  }

  const retryAction = step === 1 ? verify : claim;

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-background via-background to-primary/[0.03] shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_20px_60px_-40px_rgba(212,175,55,0.35)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-primary/[0.04] md:px-6"
      >
        <div className="flex items-start gap-4">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <Crown className="h-5 w-5 text-primary" />
            <div className="absolute inset-0 rounded-lg bg-primary/10 blur-xl" aria-hidden />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-base font-semibold tracking-tight text-foreground md:text-lg">
                Vincular conta de cliente antigo
              </h3>
              <Badge variant="outline" className="border-primary/40 bg-primary/5 font-mono text-[10px] uppercase tracking-wider text-primary">
                Legacy · R$ 250/mês
              </Badge>
              {claimed && (
                <Badge className="bg-primary/20 font-mono text-[10px] uppercase text-primary hover:bg-primary/20">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Vinculada
                </Badge>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Já possui login em <span className="text-foreground/80">Shadow 4.5.7</span> ou <span className="text-foreground/80">4.6</span>? Conecte sua licença existente em 3 passos e mantenha o preço legacy.
            </p>
          </div>
        </div>
        <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="border-t border-border/40 px-5 pb-6 pt-5 md:px-6">
              {/* STEP INDICATOR */}
              <ol className="mb-6 grid grid-cols-3 gap-2">
                {[
                  { n: 1, label: "Verificar email", icon: Search },
                  { n: 2, label: "Confirmar senha", icon: KeyRound },
                  { n: 3, label: "Vinculada", icon: CheckCircle2 },
                ].map((s) => {
                  const active = step === s.n;
                  const passed = step > s.n;
                  const Icon = s.icon;
                  return (
                    <li key={s.n} className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition md:text-[11px] ${
                      passed ? "border-primary/50 bg-primary/10 text-primary"
                      : active ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-border/50 bg-muted/20 text-muted-foreground"
                    }`}>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{s.n}. {s.label}</span>
                      <span className="sm:hidden">{s.n}</span>
                    </li>
                  );
                })}
              </ol>

              {step !== 3 && (
                <div className="mb-5 grid gap-2 rounded-lg border border-border/40 bg-muted/10 p-3 md:grid-cols-3">
                  <BenefitRow icon={ShieldCheck} title="Preço legacy garantido" desc="R$ 250/mês em vez de R$ 450" />
                  <BenefitRow icon={Server} title="Migração automática" desc="Servidor detectado e roteado" />
                  <BenefitRow icon={Sparkles} title="Sem reinstalação" desc="Mesmas credenciais do painel" />
                </div>
              )}

              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="legacy-email" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Email do seu login antigo
                    </Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="legacy-email"
                        type="email"
                        placeholder="voce@exemplo.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErr(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
                        className="flex-1 font-mono text-sm"
                        autoComplete="email"
                      />
                      <Button onClick={verify} disabled={busy} className="font-mono uppercase tracking-wider">
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        Verificar
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Verificamos automaticamente nos painéis Shadow 4.5.7 e 4.6.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && result?.found && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 font-mono text-xs text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    Login localizado · {result.panels.length > 1 ? "selecione o painel" : "painel confirmado"}
                  </div>

                  {result.panels.length > 1 && (
                    <div className="space-y-2">
                      <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Painel</Label>
                      <div className="grid gap-2 md:grid-cols-2">
                        {result.panels.map((p) => {
                          const meta = panelMeta[p];
                          const sel = selectedPanel === p;
                          return (
                            <button
                              key={p} type="button" onClick={() => setSelectedPanel(p)}
                              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                                sel ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]" : "border-border/50 hover:border-primary/50"
                              }`}
                            >
                              <div>
                                <div className={`text-sm font-semibold ${meta.tone}`}>{meta.label}</div>
                                <div className="font-mono text-[10px] uppercase text-muted-foreground">{meta.version}</div>
                              </div>
                              <div className={`h-3 w-3 rounded-full border ${sel ? "border-primary bg-primary" : "border-border"}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="legacy-pass" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Senha atual do painel
                    </Label>
                    <Input
                      id="legacy-pass" type="password" placeholder="••••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErr(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") claim(); }}
                      className="font-mono text-sm" autoComplete="off"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Guardada criptografada. Sem lembrar? Fale com o suporte em <a href="/suporte" className="text-primary hover:underline">/suporte</a>.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <Button variant="ghost" onClick={() => { setStep(1); setResult(null); setPassword(""); setSelectedPanel(""); setErr(null); }} className="font-mono text-xs uppercase">
                      ← Trocar email
                    </Button>
                    <Button onClick={claim} disabled={claiming || !selectedPanel || !password.trim()} className="font-mono uppercase tracking-wider">
                      {claiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                      Vincular ao dashboard
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3 — SUCCESS DETAIL */}
              {step === 3 && claimed && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 rounded-lg border border-primary/40 bg-primary/[0.06] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/15">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-serif text-lg font-semibold text-foreground">
                        {claimed.already ? "Licença já estava vinculada" : "Licença vinculada com sucesso"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Sua conta antiga foi conectada ao dashboard. Detalhes abaixo:
                      </div>
                    </div>
                  </div>

                  <dl className="grid gap-2 rounded-md border border-border/40 bg-background/40 p-3 text-sm md:grid-cols-2">
                    <SuccessRow label="Painel" value={panelMeta[claimed.panel].label} tone={panelMeta[claimed.panel].tone} />
                    <SuccessRow label="Versão" value={claimed.version_tier === "lifetime_46" ? "Vitalício · 4.6" : "Mensal · 4.5.7"} />
                    <SuccessRow label="Email" value={claimed.email} copyable onCopy={() => copy(claimed.email, "Email")} />
                    <SuccessRow label="Servidor" value={claimed.server_ip} copyable onCopy={() => copy(claimed.server_ip, "IP")} mono />
                    <SuccessRow label="Próxima renovação" value={formatBrDate(claimed.next_renewal)} />
                    <SuccessRow label="Taxa legacy" value="R$ 250 / mês" tone="text-primary" />
                  </dl>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={() => window.location.reload()} className="flex-1 font-mono uppercase tracking-wider">
                      <RefreshCw className="mr-2 h-4 w-4" /> Atualizar dashboard
                    </Button>
                    <Button variant="outline" onClick={reset} className="font-mono uppercase tracking-wider">
                      Vincular outra
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ERROR + RETRY */}
              {err && step !== 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-destructive/80">
                          {err.category === "network" ? "Conexão"
                            : err.category === "credential" ? "Credencial"
                            : err.category === "not_found" ? "Não encontrado"
                            : err.category === "server" ? "Servidor" : "Erro"}
                        </span>
                        {attempts > 1 && (
                          <span className="font-mono text-[10px] text-destructive/60">tentativa {attempts}</span>
                        )}
                      </div>
                      <div className="text-xs text-destructive">{err.message}</div>
                      {err.category === "server" && attempts >= 2 && (
                        <div className="text-[11px] text-destructive/80">
                          Persistindo? Abra um chamado em <a href="/suporte" className="underline">/suporte</a> com o email <span className="font-mono">{email}</span>.
                        </div>
                      )}
                      {err.retryable && (
                        <Button
                          size="sm" variant="outline" onClick={retryAction}
                          disabled={busy || claiming}
                          className="mt-1 border-destructive/40 font-mono text-xs uppercase text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          {(busy || claiming) ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                          Tentar novamente
                        </Button>
                      )}
                      {err.category === "not_found" && (
                        <a href="/planos" className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline">
                          Ver planos novos <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SuccessRow({ label, value, tone, mono, copyable, onCopy }: {
  label: string; value: string; tone?: string; mono?: boolean; copyable?: boolean; onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/30 py-1.5 last:border-none md:border-none md:py-0">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`flex items-center gap-1.5 ${mono ? "font-mono" : ""} text-sm ${tone || "text-foreground"} truncate`}>
        <span className="truncate">{value}</span>
        {copyable && (
          <button type="button" onClick={onCopy} className="text-muted-foreground hover:text-primary" aria-label={`Copiar ${label}`}>
            <Copy className="h-3 w-3" />
          </button>
        )}
      </dd>
    </div>
  );
}

function BenefitRow({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/5">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div>
        <div className="text-xs font-semibold text-foreground">{title}</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}
