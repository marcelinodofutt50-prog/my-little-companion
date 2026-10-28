import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Faixa única de ferramentas do atendimento. Todo controle do chat vive dentro
 * de uma Toolbar — rótulo/status à esquerda, ações agrupadas à direita. Nada de
 * botão solto ocupando linha própria.
 */
export function Toolbar({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/40 bg-background/30 px-3 py-1.5 sm:px-4",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Rótulo discreto da faixa (status da conexão, nome do agrupamento). */
export function ToolbarLabel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Agrupamento segmented: controles colados, separados só por um filete. Usado
 * para que ações irmãs (resumo / mídias / atualizar) pareçam uma coisa só.
 */
export function ToolbarGroup({
  className,
  children,
  label,
}: {
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <div
      role={label ? "group" : undefined}
      aria-label={label}
      className={cn(
        "flex min-w-0 items-stretch divide-x divide-border/40 overflow-hidden rounded-md border border-border/50 bg-background/40",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Classe comum dos botões dentro de um ToolbarGroup. */
export const toolbarItem =
  "h-7 gap-1.5 rounded-none border-0 bg-transparent px-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-background/60 hover:text-foreground";

/** Classe comum das seleções dentro de um ToolbarGroup. */
export const toolbarSelect =
  "h-7 w-auto min-w-24 rounded-none border-0 bg-transparent px-2.5 font-mono text-[10px] uppercase tracking-wider shadow-none";
