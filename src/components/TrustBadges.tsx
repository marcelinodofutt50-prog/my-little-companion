import { ShieldCheck, Lock, Undo2, Zap, BadgeCheck } from "lucide-react";

const items = [
  { icon: ShieldCheck, title: "Pagamento oficial", desc: "Mercado Pago — PIX com comprovante" },
  { icon: Undo2, title: "Garantia de 7 dias", desc: "Reembolso solicitado direto no painel" },
  { icon: Zap, title: "Entrega automática", desc: "Credenciais liberadas em menos de 1 min" },
  { icon: Lock, title: "Dados criptografados", desc: "Credenciais protegidas com AES-256" },
];

export function TrustBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className}`}>
      {items.map((it) => (
        <div key={it.title} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
          <it.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="text-xs font-semibold">{it.title}</div>
            <div className="text-[11px] leading-snug text-muted-foreground">{it.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function VerifiedReviewsBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
      <BadgeCheck className="h-3.5 w-3.5" />
      Avaliações verificadas por compra confirmada
    </div>
  );
}
