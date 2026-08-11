import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Botão padrão de retorno ao painel do cliente. */
export function BackToDashboard({
  to = "/dashboard",
  label = "Voltar ao painel",
  className,
}: {
  to?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-3 py-1.5",
        "font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
        "transition-colors hover:border-primary/40 hover:text-primary",
        className,
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
