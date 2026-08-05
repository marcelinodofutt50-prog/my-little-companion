import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const EVENTS = [
  { plan: "Shadow 4.6 · Vitalício", where: "São Paulo, BR" },
  { plan: "Shadow 4.5.7 · 30 dias", where: "Rio de Janeiro, BR" },
  { plan: "Shadow 4.5.5 · 7 dias", where: "Belo Horizonte, BR" },
  { plan: "Renovação de Servidor", where: "Curitiba, BR" },
  { plan: "Shadow 4.5.7 · 30 dias", where: "Fortaleza, BR" },
  { plan: "Shadow 4.6 · Vitalício", where: "Porto Alegre, BR" },
  { plan: "Play Protect Mensal", where: "Salvador, BR" },
  { plan: "Shadow 4.5.5 · 7 dias", where: "Recife, BR" },
];

/** Rotating "recent activation" proof strip. Purely presentational. */
export function LiveActivationTicker() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % EVENTS.length), 4200);
    return () => clearInterval(t);
  }, []);

  const e = EVENTS[i];
  const mins = ((i * 3) % 11) + 1;

  return (
    <div className="mx-auto mt-7 flex h-11 max-w-md items-center justify-center overflow-hidden rounded-full border border-border/50 bg-card/50 px-4 backdrop-blur">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35 }}
          className="flex min-w-0 items-center gap-2"
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="text-foreground">{e.plan}</span>
            <span className="mx-1.5 opacity-40">·</span>
            {e.where}
            <span className="mx-1.5 opacity-40">·</span>
            <span className="text-primary">há {mins} min</span>
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
