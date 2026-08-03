import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Rocket, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "@tanstack/react-router";

export function PaymentSuccessOverlay() {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true" || params.get("status") === "approved") {
      setShow(true);
      // Limpa os params para não mostrar de novo no refresh
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      url.searchParams.delete("status");
      url.searchParams.delete("payment_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  if (!show) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-primary/30 bg-card p-8 shadow-[0_0_50px_-12px_oklch(0.78_0.13_82/0.5)]"
        >
          {/* Background elements */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-[100px]" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cyan/10 blur-[100px]" />

          <div className="relative z-10 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/30 text-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]"
            >
              <CheckCircle2 className="h-10 w-10" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="font-display text-3xl font-bold tracking-tight text-foreground"
            >
              Pagamento Confirmado!
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-4 text-muted-foreground leading-relaxed"
            >
              Sua licença foi gerada e provisionada automaticamente. O sistema Yaarsa já configurou seu acesso no servidor.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 grid gap-3 sm:grid-cols-2"
            >
              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-3 text-left">
                <Rocket className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</div>
                  <div className="text-xs font-bold">Ativado Instantaneamente</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-3 text-left">
                <ShieldCheck className="h-5 w-5 text-neon" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Segurança</div>
                  <div className="text-xs font-bold">Criptografia Ativa</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-8 flex flex-col gap-3"
            >
              <Button
                onClick={() => {
                  setShow(false);
                  navigate({ to: "/dashboard" });
                }}
                className="w-full bg-primary py-6 font-mono text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20"
              >
                Acessar Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <div className="flex items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                <Zap className="h-3 w-3 text-primary" /> Ativação Shadow Mirror 2026
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
