import { ShieldCheck, Zap, HeadphonesIcon, Lock } from "lucide-react";

const items = [
  { icon: ShieldCheck, label: "7 dias de garantia" },
  { icon: Zap, label: "ativação automática" },
  { icon: HeadphonesIcon, label: "suporte humano 24/7" },
  { icon: Lock, label: "pagamento seguro" },
];

export function GuaranteeStrip() {
  return (
    <div className="sticky top-0 z-20 w-full border-b border-border/50 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-1.5 px-4 py-2 text-center">
        {items.map(({ icon: Icon, label }, i) => (
          <span key={label} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground md:text-[11px]">
            <Icon className="h-3.5 w-3.5 text-primary" />
            {label}
            {i < items.length - 1 && <span className="ml-4 hidden text-border md:inline">•</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
