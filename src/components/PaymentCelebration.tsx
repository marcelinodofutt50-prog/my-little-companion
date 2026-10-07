import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

/**
 * Celebração exibida uma vez quando o pagamento é confirmado e a licença aparece.
 * Estilo: neon/cyber do site — explosão de partículas, ondas de choque e check com glitch.
 */

type Particle = {
  id: number;
  angle: number;
  distance: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
  shape: "square" | "line" | "dot";
};

const COLORS = ["#39ff14", "#00e5ff", "#b6ff00", "#7fff00", "#00ffc8", "#eaff00"];

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: (360 / count) * i + Math.random() * 24,
    distance: 130 + Math.random() * 220,
    size: 3 + Math.random() * 6,
    delay: 0.15 + Math.random() * 0.25,
    duration: 0.9 + Math.random() * 0.9,
    color: COLORS[i % COLORS.length],
    shape: (["square", "line", "dot"] as const)[i % 3],
  }));
}

export function PaymentCelebration({ onDone }: { onDone?: () => void }) {
  const particles = useMemo(() => makeParticles(56), []);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 2600);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Flash de fundo */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, oklch(0.85 0.25 145 / 0.18), transparent 55%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.4] }}
            transition={{ duration: 1.2, times: [0, 0.2, 1] }}
          />

          {/* Ondas de choque */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={`ring-${i}`}
              className="absolute rounded-full border-2 border-neon"
              style={{ width: 120, height: 120 }}
              initial={{ scale: 0.2, opacity: 0.9 }}
              animate={{ scale: 4.5 + i * 1.5, opacity: 0 }}
              transition={{ duration: 1.4, delay: 0.1 + i * 0.18, ease: "easeOut" }}
            />
          ))}

          {/* Partículas / confete neon */}
          {particles.map((p) => (
            <motion.span
              key={p.id}
              className="absolute"
              style={{
                width: p.shape === "line" ? p.size * 3 : p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: p.shape === "dot" ? "50%" : 1,
                boxShadow: `0 0 8px ${p.color}`,
              }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
              animate={{
                x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
                y: Math.sin((p.angle * Math.PI) / 180) * p.distance + 90,
                opacity: [1, 1, 0],
                rotate: p.shape === "dot" ? 0 : 360 + p.angle,
                scale: [1, 1.1, 0.4],
              }}
              transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
            />
          ))}

          {/* Check central com glow */}
          <motion.div
            className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-neon bg-background/80"
            style={{ boxShadow: "0 0 60px oklch(0.85 0.25 145 / 0.55)" }}
            initial={{ scale: 0, rotate: -120 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 11, stiffness: 180, delay: 0.05 }}
          >
            <motion.div
              className="absolute inset-0 rounded-full border border-neon/50"
              animate={{ scale: [1, 1.15, 1], opacity: [0.7, 0.2, 0.7] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 10, stiffness: 260, delay: 0.3 }}
            >
              <Check className="h-14 w-14 text-neon" strokeWidth={3} />
            </motion.div>
          </motion.div>

          {/* Texto com entrada estilo terminal */}
          <motion.div
            className="absolute mt-56 text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
          >
            <div className="font-mono text-2xl font-black uppercase tracking-[0.25em] text-neon drop-shadow-[0_0_18px_oklch(0.85_0.25_145/0.6)]">
              Pagamento confirmado
            </div>
            <motion.div
              className="mt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-cyan"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.4, 1] }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              Acesso liberado // bem-vindo à Shadow
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
