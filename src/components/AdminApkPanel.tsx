import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileArchive, Download, Upload, Loader2, RefreshCw, ShieldAlert, CheckCircle2, XCircle, Clock, Search, Bell, BellOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { playNotifyDing, requestNotifyPermission, showDesktopNotification, unlockNotifySound } from "@/lib/notify-sound";
import {
  adminListPendingApkJobs,
  adminGetApkSourceDownload,
  adminCreateApkResultUpload,
  adminCompleteApkJob,
  adminFailApkJob,
} from "@/lib/apk-jobs.functions";

type Job = {
  id: string;
  user_id: string;
  user_email: string | null;
  status: string;
  source_filename: string;
  source_size_bytes: number;
  is_free_trial: boolean;
  error_message: string | null;
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  queued: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  claimed: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  sending: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  processing: "text-primary border-primary/40 bg-primary/10",
  failed: "text-red-300 border-red-500/40 bg-red-500/10",
};

function fmtBytes(n: number) {
  if (!n) return "—";
  const mb = n / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;
}

const SOUND_KEY = "shadow.apk.sound";

export function AdminApkPanel() {
  const listFn = useServerFn(adminListPendingApkJobs);
  const dlFn = useServerFn(adminGetApkSourceDownload);
  const upFn = useServerFn(adminCreateApkResultUpload);
  const doneFn = useServerFn(adminCompleteApkJob);
  const failFn = useServerFn(adminFailApkJob);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(SOUND_KEY) !== "0";
  });
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const knownIdsRef = useRef<Set<string>>(new Set());
  const bootedRef = useRef(false);

  async function refresh() {
    setLoading(true);
    try {
      const rows = (await listFn()) as Job[];
      setJobs(rows);
      // seed known ids on first load so we don't ding on mount
      if (!bootedRef.current) {
        knownIdsRef.current = new Set(rows.map((r) => r.id));
        bootedRef.current = true;
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar fila");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, []);

  // Realtime: ding + toast whenever a new APK enters the queue.
  useEffect(() => {
    const ch = supabase
      .channel("admin_apk_jobs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "apk_jobs" },
        (payload) => {
          const row = payload.new as any;
          if (knownIdsRef.current.has(row.id)) return;
          knownIdsRef.current.add(row.id);
          if (soundOn) {
            playNotifyDing(0.2);
            showDesktopNotification("Novo APK na fila", row.source_filename ?? "APK recebido");
          }
          toast.info(`Novo APK na fila: ${row.source_filename ?? row.id}`);
          refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "apk_jobs" },
        () => refresh(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [soundOn]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    if (next) {
      unlockNotifySound();
      requestNotifyPermission();
      playNotifyDing(0.15);
      toast.success("Notificações sonoras ativadas");
    } else {
      toast.message("Notificações sonoras desativadas");
    }
  }



  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return jobs;
    return jobs.filter((j) =>
      (j.user_email ?? "").toLowerCase().includes(s) ||
      j.source_filename.toLowerCase().includes(s) ||
      j.id.toLowerCase().includes(s)
    );
  }, [jobs, q]);

  async function downloadSource(j: Job) {
    try {
      const { url, filename } = await dlFn({ data: { id: j.id } });
      const a = document.createElement("a");
      a.href = url;
      if (filename) a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Download iniciado — job movido para 'processing'.");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha no download");
    }
  }

  async function uploadResult(j: Job, file: File) {
    if (!/\.apk$/i.test(file.name)) { toast.error("Envie um .apk processado"); return; }
    setUploadingId(j.id);
    setUploadPct(0);
    try {
      const { uploadUrl, path } = await upFn({ data: { id: j.id, filename: file.name } });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", "application/vnd.android.package-archive");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload falhou (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Erro de rede no upload"));
        xhr.send(file);
      });
      await doneFn({ data: { id: j.id, resultPath: path, filename: file.name, sizeBytes: file.size } });
      toast.success("APK processado entregue ao cliente. Job removido da fila.");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar resultado");
    } finally {
      setUploadingId(null);
      setUploadPct(0);
    }
  }

  async function failJob(j: Job) {
    const reason = prompt("Motivo da falha (será mostrado ao cliente):", "Não foi possível processar este APK.");
    if (!reason) return;
    try {
      await failFn({ data: { id: j.id, reason } });
      toast.success("Job marcado como falho.");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    }
  }

  return (
    <div className="space-y-4">
      <div className="terminal-card scanlines relative p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-neon">// fila play protect</div>
            <h3 className="mt-1 font-display text-lg font-semibold tracking-tight flex items-center gap-2">
              APKs aguardando processamento
              {jobs.length > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[10px] font-bold text-primary-foreground">
                  {jobs.length}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Baixe o APK do cliente, processe no bot do Telegram e envie o arquivo resultante aqui. Assim que concluído, o job some da fila.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="e-mail ou arquivo"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-8 w-52 pl-7 font-mono text-[11px]"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={toggleSound}
              title={soundOn ? "Silenciar notificações" : "Ativar notificações"}
              className="gap-1.5 font-mono text-[11px] uppercase tracking-wider"
            >
              {soundOn ? <Bell className="h-3.5 w-3.5 text-neon" /> : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
              {soundOn ? "Som on" : "Som off"}
            </Button>
            <Button size="sm" variant="outline" onClick={refresh} className="gap-1.5 font-mono text-[11px] uppercase tracking-wider">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="terminal-card p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando fila…
        </div>
      ) : filtered.length === 0 ? (
        <div className="terminal-card p-10 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-neon" />
          <div className="font-mono text-sm uppercase tracking-wider text-neon">fila limpa</div>
          <p className="mt-1 text-xs text-muted-foreground">Nenhum APK pendente. APKs concluídos ficam ocultos para não confundir.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((j) => {
            const tone = STATUS_TONE[j.status] ?? "text-muted-foreground border-border";
            const busy = uploadingId === j.id;
            return (
              <li key={j.id} className="terminal-card relative p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <FileArchive className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-medium">{j.source_filename}</div>
                      {j.is_free_trial && (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-emerald-400">
                          trial
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${tone}`}>
                        {j.status === "processing" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Clock className="h-2.5 w-2.5" />}
                        {j.status}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {j.user_email ?? j.user_id} · {fmtBytes(j.source_size_bytes)} · {new Date(j.created_at).toLocaleString("pt-BR")}
                      {j.error_message && <span className="ml-2 text-red-400">— {j.error_message}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadSource(j)} className="gap-1.5 font-mono text-[11px] uppercase">
                      <Download className="h-3.5 w-3.5" /> Baixar APK
                    </Button>
                    <input
                      ref={(el) => { fileRefs.current[j.id] = el; }}
                      type="file"
                      accept=".apk,application/vnd.android.package-archive"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) uploadResult(j, f);
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => fileRefs.current[j.id]?.click()}
                      className="gap-1.5 font-mono text-[11px] uppercase"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {busy ? `Enviando ${uploadPct}%` : "Entregar resultado"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => failJob(j)} className="gap-1.5 font-mono text-[11px] uppercase text-red-300 hover:text-red-200">
                      <XCircle className="h-3.5 w-3.5" /> Falha
                    </Button>
                  </div>
                </div>
                {busy && (
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${uploadPct}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="terminal-card p-3 text-[11px] text-muted-foreground">
        <ShieldAlert className="mr-1 inline h-3 w-3 text-amber-400" />
        Jobs concluídos (<span className="text-neon">done</span>) e cancelados ficam ocultos aqui — o cliente já enxerga o download no painel dele.
      </div>
    </div>
  );
}
