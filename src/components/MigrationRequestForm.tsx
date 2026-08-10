import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, Paperclip, Send, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addMigrationProofs,
  getMyMigrationRequest,
  submitMigrationRequest,
} from "@/lib/migration.functions";

const BUCKET = "migration-proofs";
const MAX_FILES = 6;
const MAX_TOTAL = 12;
const MAX_SIZE = 8 * 1024 * 1024; // 8MB por arquivo
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

type Uploaded = { path: string; name: string; size: number };

export function MigrationRequestForm() {
  const submitFn = useServerFn(submitMigrationRequest);
  const getMine = useServerFn(getMyMigrationRequest);
  const addProofs = useServerFn(addMigrationProofs);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<Uploaded[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const [extraFiles, setExtraFiles] = useState<Uploaded[]>([]);
  const [extraNote, setExtraNote] = useState("");
  const [savingExtra, setSavingExtra] = useState(false);
  const extraRef = useRef<HTMLInputElement>(null);


  const [form, setForm] = useState({
    currentPanel: "",
    panelVersion: "",
    oldUsername: "",
    clientsCount: "",
    oldExpiresOn: "",
    notes: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(Boolean(s?.user)));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authed) return;
    getMine()
      .then((r) => setExisting(r))
      .catch(() => {});
  }, [authed, getMine]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return toast.error("Faça login para anexar comprovantes");

    const picked = Array.from(list).slice(0, MAX_FILES - files.length);
    if (!picked.length) return toast.error(`Máximo de ${MAX_FILES} anexos`);

    setUploading(true);
    const added: Uploaded[] = [];
    for (const file of picked) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: envie imagem (PNG/JPG/WEBP) ou PDF`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: máximo de 8MB por arquivo`);
        continue;
      }
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const path = `${uid}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        toast.error(`${file.name}: falha no envio (${error.message})`);
        continue;
      }
      added.push({ path, name: file.name, size: file.size });
    }
    setUploading(false);
    if (added.length) {
      setFiles((f) => [...f, ...added]);
      toast.success(`${added.length} comprovante(s) anexado(s)`);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function removeFile(path: string) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    setFiles((f) => f.filter((x) => x.path !== path));
  }

  async function uploadMany(list: FileList | null, remainingSlots: number) {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast.error("Faça login para anexar comprovantes");
      return [] as Uploaded[];
    }
    const picked = Array.from(list ?? []).slice(0, Math.max(0, remainingSlots));
    if (!picked.length) {
      toast.error("Limite de anexos atingido");
      return [] as Uploaded[];
    }
    const added: Uploaded[] = [];
    for (const file of picked) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: envie imagem (PNG/JPG/WEBP) ou PDF`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: máximo de 8MB por arquivo`);
        continue;
      }
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const path = `${uid}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        toast.error(`${file.name}: falha no envio (${error.message})`);
        continue;
      }
      added.push({ path, name: file.name, size: file.size });
    }
    return added;
  }

  async function handleExtra(list: FileList | null, alreadySaved: number) {
    if (!list?.length) return;
    const remaining = MAX_TOTAL - alreadySaved - extraFiles.length;
    setUploading(true);
    const added = await uploadMany(list, Math.min(remaining, MAX_FILES));
    setUploading(false);
    if (added.length) {
      setExtraFiles((f) => [...f, ...added]);
      toast.success(`${added.length} arquivo(s) pronto(s) para anexar`);
    }
    if (extraRef.current) extraRef.current.value = "";
  }

  async function removeExtra(path: string) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    setExtraFiles((f) => f.filter((x) => x.path !== path));
  }

  async function saveExtra() {
    if (savingExtra || !existing?.id || extraFiles.length === 0) return;
    setSavingExtra(true);
    try {
      const row = await addProofs({
        data: {
          requestId: existing.id,
          proofPaths: extraFiles.map((f) => f.path),
          note: extraNote,
        },
      });
      setExisting(row);
      setExtraFiles([]);
      setExtraNote("");
      toast.success("Anexos adicionados ao seu pedido — sem abrir novo chamado.");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível anexar os arquivos");
    } finally {
      setSavingExtra(false);
    }
  }


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (files.length === 0) {
      return toast.error("Anexe pelo menos 1 comprovante do servidor antigo (print do painel, recibo, etc.)");
    }
    setLoading(true);
    try {
      const row = await submitFn({
        data: {
          currentPanel: form.currentPanel,
          panelVersion: form.panelVersion,
          oldUsername: form.oldUsername,
          clientsCount: Number(form.clientsCount || 0),
          oldExpiresOn: form.oldExpiresOn,
          notes: form.notes,
          proofPaths: files.map((f) => f.path),
        },
      });
      setExisting(row);
      toast.success("Solicitação enviada! A equipe responde em até 2 horas úteis.");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível enviar a solicitação");
    } finally {
      setLoading(false);
    }
  }

  if (authed === false) {
    return (
      <div className="rounded-md border border-border/60 bg-card/50 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Entre na sua conta para enviar o checklist e os comprovantes por aqui.
        </p>
        <Button asChild size="sm" className="mt-3 font-mono uppercase">
          <Link to="/auth" search={{ redirect: "/migracao" } as never}>Entrar / criar conta</Link>
        </Button>
      </div>
    );
  }

  if (existing) {
    const pending = existing.status === "pending";
    const total = existing.proof_paths?.length ?? 0;
    return (
      <div className="rounded-md border border-neon/40 bg-neon/5 p-6">
        <div className="flex items-center gap-2">
          {pending ? <Clock className="h-5 w-5 text-neon" /> : <CheckCircle2 className="h-5 w-5 text-neon" />}
          <h3 className="font-display text-lg tracking-tight">
            {pending ? "Solicitação em análise" : `Solicitação: ${existing.status}`}
          </h3>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Recebemos seus dados do painel <span className="text-foreground">{existing.current_panel}</span> com{" "}
          {total} comprovante(s). Primeira resposta em até 2 horas úteis — o acompanhamento
          acontece no seu ticket de suporte.
        </p>
        {existing.admin_notes && (
          <p className="mt-2 rounded border border-border/60 bg-card/50 p-3 text-[12px]">
            <span className="font-semibold">Resposta da equipe:</span> {existing.admin_notes}
          </p>
        )}

        {pending && (
          <div className="mt-4 rounded-md border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-neon" />
              <span className="font-mono text-xs uppercase tracking-wider">Adicionar anexos extras</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Esqueceu um comprovante? Anexe aqui e ele entra no mesmo pedido — sem abrir novo chamado.
              Máximo de {MAX_TOTAL} anexos no total ({total} enviados).
            </p>

            <input
              ref={extraRef}
              type="file"
              multiple
              accept={ACCEPTED.join(",")}
              className="hidden"
              onChange={(e) => handleExtra(e.target.files, total)}
            />
            <Textarea
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-3"
              placeholder="Observação sobre os novos anexos (opcional)"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="font-mono uppercase"
                disabled={uploading || total >= MAX_TOTAL}
                onClick={() => extraRef.current?.click()}
              >
                {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                {uploading ? "Enviando..." : "Escolher arquivos"}
              </Button>
              <Button asChild size="sm" variant="ghost" className="font-mono uppercase">
                <Link to="/suporte" search={{}}>Acompanhar no suporte</Link>
              </Button>
            </div>

            {extraFiles.length > 0 && (
              <>
                <ul className="mt-3 space-y-2">
                  {extraFiles.map((f) => (
                    <li key={f.path} className="flex items-center justify-between gap-3 rounded border border-border/60 bg-muted/40 p-2">
                      <span className="truncate font-mono text-[11px]">{f.name}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                        <button
                          type="button"
                          onClick={() => removeExtra(f.path)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 w-full font-mono uppercase"
                  disabled={savingExtra || uploading}
                  onClick={saveExtra}
                >
                  {savingExtra ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Anexar ao pedido
                </Button>
              </>
            )}
          </div>
        )}

        {!pending && (
          <Button asChild size="sm" className="mt-4 font-mono uppercase">
            <Link to="/suporte" search={{}}>Acompanhar no suporte</Link>
          </Button>
        )}
      </div>
    );
  }


  return (
    <form onSubmit={submit} className="terminal-card scanlines relative space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Painel/servidor atual *</label>
          <Input value={form.currentPanel} onChange={(e) => set("currentPanel", e.target.value)} required maxLength={120} placeholder="Ex.: Painel do Fulano / revenda X" />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Versão do BTMob</label>
          <Input value={form.panelVersion} onChange={(e) => set("panelVersion", e.target.value)} maxLength={40} placeholder="Ex.: 4.6" />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Seu usuário no painel antigo *</label>
          <Input value={form.oldUsername} onChange={(e) => set("oldUsername", e.target.value)} required maxLength={120} placeholder="Somente o usuário — nunca a senha" />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Clientes ativos *</label>
          <Input type="number" min={0} max={100000} value={form.clientsCount} onChange={(e) => set("clientsCount", e.target.value)} required placeholder="Ex.: 120" />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Vencimento no servidor antigo</label>
          <Input type="date" value={form.oldExpiresOn} onChange={(e) => set("oldExpiresOn", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Observações</label>
        <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} rows={3} placeholder="Conte o que mais te incomoda hoje (quedas, lentidão, suporte sumido) e como prefere fazer a virada." />
      </div>

      {/* Comprovantes */}
      <div className="rounded-md border border-border/60 bg-card/50 p-4">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-neon" />
          <span className="font-mono text-xs uppercase tracking-wider">Comprovante do servidor antigo *</span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Anexe pelo menos 1: print da tela de login do painel antigo, print da lista de clientes, recibo/comprovante de
          pagamento ou conversa com o servidor atual. Aceita PNG, JPG, WEBP e PDF (até 8MB cada, {MAX_FILES} arquivos).
          <span className="block text-amber-400">Censure senhas e dados de terceiros antes de enviar.</span>
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 font-mono uppercase"
          disabled={uploading || files.length >= MAX_FILES}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
          {uploading ? "Enviando..." : "Anexar arquivos"}
        </Button>

        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((f) => (
              <li key={f.path} className="flex items-center justify-between gap-3 rounded border border-border/60 bg-muted/40 p-2">
                <span className="truncate font-mono text-[11px]">{f.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                  <button type="button" onClick={() => removeFile(f.path)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button type="submit" disabled={loading || uploading} className="w-full font-mono uppercase tracking-wider">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Enviar solicitação de migração
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Seus arquivos ficam em área privada, visíveis apenas para você e a equipe. Nunca pedimos senha nem código 2FA.
      </p>
    </form>
  );
}
