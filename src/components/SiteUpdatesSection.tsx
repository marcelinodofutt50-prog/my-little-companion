import { Rocket } from "lucide-react";

/** Novidades do site — mostra ao cliente que o projeto segue sendo atualizado. */
const SITE_UPDATES: { date: string; title: string; items: string[] }[] = [
  {
    date: "25/09/2026",
    title: "Painel novo e suporte no cantinho",
    items: [
      "Mini chat do suporte no canto da tela, sem sair do painel.",
      "Botão \"Reparar acesso\" em destaque para resolver login em segundos.",
      "Guia rápido explicando o \"network error\" da BTmob.",
    ],
  },
  {
    date: "24/09/2026",
    title: "Segurança reforçada",
    items: [
      "Proteção contra criação de várias contas e revenda de testes.",
      "Filtro automático na Comunidade contra spam e vendas.",
    ],
  },
  {
    date: "Setembro/2026",
    title: "Infraestrutura mais rápida",
    items: [
      "Servidor e arquivos migrados para uma estrutura nova e mais estável.",
      "Chat ao vivo com mensagens chegando na hora, sem precisar atualizar.",
      "Atualizações do app agora podem ser baixadas por link direto.",
    ],
  },
];

export function SiteUpdatesSection() {
  return (
    <section className="enterprise-surface overflow-hidden" aria-labelledby="site-updates-title">
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
        <div>
          <h2 id="site-updates-title" className="font-mono text-sm font-bold uppercase">Updates</h2>
          <p className="mt-1 text-xs text-muted-foreground">Estamos sempre melhorando o projeto — veja o que mudou.</p>
        </div>
        <Rocket className="h-5 w-5 text-primary" />
      </div>
      <ol className="relative space-y-5 p-5 pl-9">
        <span className="absolute bottom-5 left-[1.3rem] top-6 w-px bg-border" aria-hidden />
        {SITE_UPDATES.map((u, i) => (
          <li key={u.title} className="relative animate-in fade-in slide-in-from-left-2 duration-500" style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}>
            <span className={`absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background ${i === 0 ? "bg-primary" : "bg-muted-foreground/50"}`} />
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">{u.date}</span>
              <span className="text-sm font-semibold">{u.title}</span>
              {i === 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase text-primary">Novo</span>}
            </div>
            <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
              {u.items.map((it) => <li key={it}>• {it}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
