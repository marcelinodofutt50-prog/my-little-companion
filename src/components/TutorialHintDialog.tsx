import { AnimatePresence, motion } from "framer-motion";
import { Youtube, X, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const YT_CHANNEL_URL = "https://www.youtube.com/@krebgulin";

export function TutorialHintDialog({
  open,
  onClose,
  title = "Tem dúvidas?",
  message = "Veja nosso canal no YouTube — ali você encontra tutoriais passo a passo para instalar o programa, desativar o antivírus e configurar tudo certinho.",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-lg border border-primary/40 bg-card shadow-[0_0_60px_rgba(59,130,246,0.25)]"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative p-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-red-400">
                <Youtube className="h-3.5 w-3.5" /> tutoriais em vídeo
              </div>
              <h3 className="font-display text-2xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>

              <div className="mt-5 grid gap-2 rounded border border-border/60 bg-background/40 p-3 text-[12px] text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-[10px] text-neon">01</span>
                  Como baixar o programa sem ser bloqueado pelo antivírus
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-[10px] text-neon">02</span>
                  Passo a passo para colocar o login e ativar
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-[10px] text-neon">03</span>
                  Bypass do Play Protect e build do APK
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={onClose} className="font-mono text-xs uppercase tracking-wider">
                  Fechar
                </Button>
                <Button asChild className="gap-2 font-mono text-xs uppercase tracking-wider">
                  <a href={YT_CHANNEL_URL} target="_blank" rel="noreferrer">
                    <PlayCircle className="h-4 w-4" /> Abrir canal
                  </a>
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
