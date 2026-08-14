import { useEffect, useRef, useState } from "react";
import { LayoutGrid, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export type AdminNavItem = { id: string; label: string; icon: any; hint?: string };
export type AdminNavGroup = { title: string; accent: "neon" | "cyan" | "violet"; items: AdminNavItem[] };

type Props = {
  groups: AdminNavGroup[];
  /** ids mostrados fixos na barra inferior (máx. 4) */
  primary: string[];
  tab: string;
  onChange: (id: string) => void;
  /** badge opcional por aba (ex.: tickets abertos) */
  badges?: Record<string, number>;
};

const accentText = (a: AdminNavGroup["accent"]) =>
  a === "neon" ? "text-neon" : a === "cyan" ? "text-cyan" : "text-violet";

/**
 * Navegação de admin pensada para celular: barra fixa embaixo com as seções
 * mais usadas + botão "Tudo" que abre a lista completa agrupada.
 */
export function AdminMobileNav({ groups, primary, tab, onChange, badges }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // ao abrir a lista completa, rola até a seção atual
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }, 120);
    return () => clearTimeout(t);
  }, [open]);

  const all = groups.flatMap((g) => g.items);
  const quick = primary
    .map((id) => all.find((i) => i.id === id))
    .filter(Boolean)
    .slice(0, 4) as AdminNavItem[];

  const term = q.trim().toLowerCase();
  const filtered = term
    ? groups
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (i) => i.label.toLowerCase().includes(term) || (i.hint ?? "").toLowerCase().includes(term),
          ),
        }))
        .filter((g) => g.items.length > 0)
    : groups;

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQ("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const inQuick = quick.some((i) => i.id === tab);
  const current = all.find((i) => i.id === tab);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {quick.map((item) => {
            const active = tab === item.id;
            const badge = badges?.[item.id] ?? 0;
            return (
              <button
                key={item.id}
                onClick={() => pick(item.id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-2 transition-all ${
                  active
                    ? "bg-neon/10 text-neon"
                    : "text-muted-foreground active:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-neon shadow-[0_0_8px_var(--neon)]" />
                )}
                <item.icon className={`h-4 w-4 shrink-0 transition-transform ${active ? "scale-110 drop-shadow-[0_0_6px_var(--neon)]" : ""}`} />
                <span
                  className={`w-full truncate text-center font-mono text-[9px] uppercase tracking-wider ${
                    active ? "font-bold" : ""
                  }`}
                >
                  {item.label}
                </span>
                {badge > 0 && (
                  <span className="absolute right-2 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 font-mono text-[9px] text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setOpen(true)}
            aria-current={!inQuick ? "page" : undefined}
            className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-2 transition-all ${
              !inQuick ? "bg-neon/10 text-neon" : "text-muted-foreground active:text-foreground"
            }`}
          >
            {!inQuick && (
              <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-neon shadow-[0_0_8px_var(--neon)]" />
            )}
            {!inQuick && current ? (
              <current.icon className="h-4 w-4 shrink-0 scale-110 drop-shadow-[0_0_6px_var(--neon)]" />
            ) : (
              <LayoutGrid className="h-4 w-4 shrink-0" />
            )}
            <span
              className={`w-full truncate px-1 text-center font-mono text-[9px] uppercase tracking-wider ${
                !inQuick ? "font-bold" : ""
              }`}
            >
              {!inQuick && current ? current.label : "Tudo"}
            </span>
          </button>
        </div>
      </nav>


      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto border-border/50 bg-background p-0">
          <SheetHeader className="sticky top-0 z-10 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur">
            <SheetTitle className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.2em] text-neon">
              Seções do painel
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </SheetTitle>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar seção..."
              className="mt-2 w-full rounded border border-border/50 bg-background/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-neon/50"
            />
          </SheetHeader>

          <div className="px-4 pb-8 pt-3">
            {filtered.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">Nenhuma seção encontrada.</div>
            )}
            {filtered.map((g, gi) => (
              <div key={g.title} className={gi > 0 ? "mt-4 border-t border-border/40 pt-4" : ""}>
                <div className={`pb-2 font-mono text-[9px] uppercase tracking-[0.25em] ${accentText(g.accent)}`}>
                  // {g.title}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {g.items.map((item) => {
                    const active = tab === item.id;
                    const badge = badges?.[item.id] ?? 0;
                    return (
                      <button
                        key={item.id}
                        ref={active ? activeRef : undefined}
                        onClick={() => pick(item.id)}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex min-h-[62px] flex-col justify-center gap-1 rounded border px-3 py-2 text-left transition-colors ${
                          active
                            ? "border-neon bg-neon/15 text-neon shadow-[0_0_12px_-4px_var(--neon)]"
                            : "border-border/50 bg-background/40 text-foreground active:border-foreground/40"
                        }`}
                      >
                        {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-neon" />}
                        <div className="flex items-center gap-1.5">
                          <item.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className={`truncate font-mono text-[10px] uppercase tracking-wider ${active ? "font-bold" : ""}`}>
                            {item.label}
                          </span>
                          {active && (
                            <span className="ml-auto rounded bg-neon/20 px-1 font-mono text-[8px] uppercase tracking-wider text-neon">
                              atual
                            </span>
                          )}
                        </div>

                        {item.hint && (
                          <span className="truncate text-[9px] text-muted-foreground">{item.hint}</span>
                        )}
                        {badge > 0 && (
                          <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 font-mono text-[9px] text-white">
                            {badge > 9 ? "9+" : badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
