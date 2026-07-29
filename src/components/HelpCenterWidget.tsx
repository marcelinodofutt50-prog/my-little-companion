import { useMemo, useState } from "react";
import { Search, LifeBuoy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type Topic = { key: string; title: string; items: { q: string; a: string }[] };

const TOPICS: Topic[] = [
  {
    key: "instalacao",
    title: "Instalação",
    items: [
      { q: "Como instalo o cliente Shadow?", a: "Baixe o instalador na aba Downloads e execute como administrador." },
      { q: "O antivírus está bloqueando, e agora?", a: "Adicione uma exceção para a pasta do Shadow no seu antivírus." },
    ],
  },
  {
    key: "login",
    title: "Login",
    items: [
      { q: "Esqueci minha senha", a: "Use as credenciais copiadas no dashboard ou solicite suporte." },
      { q: "Não consigo entrar no cliente", a: "Confira usuário, senha e IP do servidor com atenção." },
    ],
  },
  {
    key: "servidor",
    title: "Servidor",
    items: [
      { q: "Como sei se o servidor está online?", a: "Verifique o indicador 'Servidor ONLINE' no dashboard." },
      { q: "Qual o IP do servidor?", a: "Está disponível revelando o campo Servidor no card da sua licença." },
    ],
  },
  {
    key: "apk",
    title: "APK",
    items: [
      { q: "Onde baixo o APK?", a: "Na aba Downloads do dashboard, versão mais recente disponível." },
      { q: "O APK não instala", a: "Habilite 'fontes desconhecidas' nas configurações do Android." },
    ],
  },
  {
    key: "presentes",
    title: "Presentes",
    items: [
      { q: "Como resgato um presente/cashback?", a: "Acesse a aba Benefícios e confira seu saldo de cashback." },
      { q: "Indiquei um amigo, quando recebo?", a: "O bônus é creditado após a confirmação de pagamento do indicado." },
    ],
  },
];

export function HelpCenterWidget() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return TOPICS;
    const q = query.toLowerCase();
    return TOPICS.map((t) => ({
      ...t,
      items: t.items.filter((i) => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)),
    })).filter((t) => t.items.length > 0);
  }, [query]);

  return (
    <div className="terminal-card scanlines relative overflow-hidden rounded-lg border border-border/50 p-5">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/80">
        <LifeBuoy className="h-3.5 w-3.5" /> // central de ajuda
      </div>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por instalação, login, servidor..."
          className="pl-9 font-mono text-sm"
        />
      </div>

      <div className="mt-3">
        {filtered.length === 0 ? (
          <div className="py-6 text-center font-mono text-xs text-muted-foreground">Nenhum resultado encontrado.</div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {filtered.map((topic) => (
              <AccordionItem key={topic.key} value={topic.key} className="border-border/40">
                <AccordionTrigger className="font-mono text-xs uppercase tracking-wider text-foreground hover:text-neon">
                  {topic.title}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {topic.items.map((item, idx) => (
                      <div key={idx} className="rounded border border-border/30 bg-background/40 p-3">
                        <div className="text-xs font-medium text-foreground">{item.q}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{item.a}</div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}
