import { Link } from "@tanstack/react-router";
import { LifeBuoy, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function HelpCenterWidget() {
  const { t } = useI18n();
  return (
    <div className="terminal-card p-4 relative overflow-hidden group">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">{t('nav.support')}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[180px]">
            Central de Atendimento: Precisa de suporte tático? Nossos agentes de elite estão online 24/7.
          </p>
        </div>
        <div className="h-8 w-8 rounded-full border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-black transition-colors">
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
      <Link to="/suporte" className="absolute inset-0 z-10" />
    </div>
  );
}
