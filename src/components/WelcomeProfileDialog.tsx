import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Camera, Sparkles, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMyIdentity } from "@/lib/identity.functions";
import { uploadAvatar } from "@/lib/avatar.functions";
import { updateProfileCustomization } from "@/lib/profile-customization.functions";

const DISMISS_KEY = "shadow:welcome-profile:dismissed";

/**
 * Boas-vindas do cliente novo: mesma pegada do Shadow Pass (apelido + foto),
 * só que apresentada logo no primeiro acesso para facilitar a identificação
 * de quem é quem no suporte e na comunidade.
 *
 * Regras de segurança: é 100% cosmético. Não toca em licença, trial ou bypass —
 * só grava apelido/avatar no perfil e pode ser pulado a qualquer momento.
 */
export function WelcomeProfileDialog({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const identityFn = useServerFn(getMyIdentity);
  const uploadFn = useServerFn(uploadAvatar);
  const saveFn = useServerFn(updateProfileCustomization);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1") return;
        const id: any = await identityFn({});
        if (!alive || !id) return;
        // Perfil "cru": sem avatar e sem apelido definido pelo usuário.
        const hasNick = !!id.nickname && id.nickname !== "Operador";
        const needsSetup = !id.avatar || !hasNick;
        if (needsSetup && !id.isAnonymous) {
          setNick(hasNick ? id.nickname : "");
          setPreview(id.avatar ?? null);
          setOpen(true);
        }
      } catch {
        /* silencioso: nunca pode atrapalhar o painel */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  function pickFile(file: File) {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
      toast.error("Use uma imagem PNG, JPG, WEBP ou GIF.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito pesada (máx 2MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      setDataUrl(url);
      setContentType(file.type);
      setPreview(url);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    const cleanNick = nick.trim();
    if (!cleanNick && !dataUrl) {
      toast.info("Escolha um apelido ou uma foto para continuar.");
      return;
    }
    setSaving(true);
    try {
      if (dataUrl && contentType) {
        await uploadFn({ data: { dataUrl, contentType } });
      }
      if (cleanNick) {
        await saveFn({ data: { nickname: cleanNick } });
      }
      toast.success("Ficha preenchida! Agora é mais fácil te identificar no suporte.");
      dismiss();
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar sua ficha agora.");
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-4 w-4 text-neon" /> Bem-vindo à ShadowDash
          </DialogTitle>
          <DialogDescription className="text-xs">
            Preencha sua ficha rápida: um apelido e uma foto. É o mesmo esquema do Shadow Pass e
            ajuda a equipe a te identificar no suporte e na comunidade. Seu e-mail nunca é exibido.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative h-24 w-24 overflow-hidden rounded-full border border-border/60 bg-muted/30"
            aria-label="Escolher foto de perfil"
          >
            {preview ? (
              <img src={preview} alt="Prévia da sua foto de perfil" className="h-full w-full object-cover" />
            ) : (
              <UserCircle2 className="h-full w-full p-4 text-muted-foreground" />
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-background/80 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              <Camera className="h-3 w-3" /> foto
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) pickFile(f);
            }}
          />

          <Input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="ex: shadow_ghost"
            maxLength={20}
            className="font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !saving) void save();
            }}
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={dismiss} disabled={saving} className="text-xs">
            Agora não
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={saving} className="text-xs">
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Salvar ficha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
