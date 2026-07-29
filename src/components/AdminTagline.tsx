import { motion } from "framer-motion";

/** Tagline animada do painel — mesma assinatura da página inicial. */
export function AdminTagline({ className = "" }: { className?: string }) {
  const words = ["Your", "shadow,", "everywhere."];
  return (
    <div className={`flex items-baseline gap-1.5 font-display text-sm italic tracking-tight sm:text-base ${className}`}>
      {words.map((w, i) => (
        <motion.span
          key={w}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 0.15 + i * 0.16, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={i === 2 ? "tagline-shimmer not-italic font-semibold" : "text-muted-foreground"}
        >
          {w}
        </motion.span>
      ))}
      <span className="caret ml-0.5 text-[11px]" aria-hidden />
    </div>
  );
}
