import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, UserCog, VenetianMask } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { getMyProfile, updateMyDisplayName } from "@/lib/profile.functions";
import { maskEmail } from "@/lib/identity";

type Props = {
  /** Apelido atual (controlado pela página) */
  displayName: string | null;
  email: string | null;
  onChange: (nick: string | null) => void;
  compact?: boolean;
};

export function NicknameDialog({ displayName, email, onChange, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(displayName ?? "");
  const [saving, setSaving] = useState(false);
  const saveFn = useServerFn(updateMyDisplayName);

  useEffect(() => { if (open) setValue(displayName ?? ""); }, [open, displayName]);

  async function save() {
    setSaving(true);
    try {
      const res = await saveFn({ data: { displayName: value.trim() } });
      onChange(res.display_name ?? null);
      toast.success(res.display_name ? "Apelido atualizado" : "Apelido removido");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar o apelido");
    }
    setSaving(false);
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label="Editar apelido"
        className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-neon"
      >
        <VenetianMask className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className={compact ? "hidden sm:inline" : ""}>{displayName ? "Apelido" : "Definir apelido"}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <UserCog className="h-4 w-4 text-neon" /> Modo anônimo
            </DialogTitle>
            <DialogDescription className="text-xs">
              Escolha um apelido para aparecer no lugar do seu e-mail em todo o site, inclusive no suporte.
              Seu e-mail continua sendo usado apenas para login e recibos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="ex: shadow_ghost"
              maxLength={20}
              autoFocus
              className="font-mono"
              onKeyDown={(e) => { if (e.key === "Enter" && !saving) save(); }}
            />
            <div className="rounded border border-border/50 bg-background/40 p-3 font-mono text-[11px] text-muted-foreground">
              <div className="uppercase tracking-wider text-neon/80">// pré-visualização</div>
              <div className="mt-1 text-foreground">{value.trim() || maskEmail(email)}</div>
              <div className="mt-1 text-[10px]">
                Sem apelido, mostramos apenas <span className="text-foreground/80">{maskEmail(email)}</span> — nunca o e-mail completo.
              </div>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              3 a 20 caracteres · letras, números, ponto, hífen ou underline · sem @
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {displayName && (
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => { setValue(""); }}
                className="font-mono text-xs uppercase"
              >
                Limpar
              </Button>
            )}
            <Button onClick={save} disabled={saving} className="font-mono text-xs uppercase">
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Carrega o apelido do usuário logado. */
export function useMyIdentity() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const profileFn = useServerFn(getMyProfile);
  useEffect(() => {
    let alive = true;
    profileFn()
      .then((p) => { if (alive) { setDisplayName(p.display_name ?? null); setEmail(p.email ?? null); } })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return { displayName, setDisplayName, email, setEmail };
}
