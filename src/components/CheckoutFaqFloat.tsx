import { useCallback, useEffect, useId, useRef, useState } from "react";
import { HelpCircle, X, ChevronDown } from "lucide-react";
import { track } from "@/lib/analytics";

const faqs = [
  { id: "entrega", q: "Em quanto tempo recebo o acesso?", a: "Assim que o PIX é confirmado, o sistema cria a licença automaticamente e mostra as credenciais no seu painel — normalmente em menos de 1 minuto." },
  { id: "reembolso", q: "E se eu não gostar?", a: "Você tem 7 dias para pedir reembolso direto pelo painel, na aba de reembolso do pedido. A análise leva até 2 dias." },
  { id: "seguranca", q: "O pagamento é seguro?", a: "O checkout usa a API oficial do Mercado Pago. Nós não armazenamos dados de cartão nem chave PIX de pagamento." },
  { id: "renovacao", q: "Preciso renovar todo mês?", a: "Planos mensais renovam no ciclo do dia 20. O painel avisa com antecedência e a renovação é feita em poucos cliques." },
  { id: "suporte", q: "Tem suporte?", a: "Sim, suporte por chat dentro do painel com histórico completo do seu atendimento." },
];

export function CheckoutFaqFloat() {
  const [open, setOpen] = useState(false);
  const [openIds, setOpenIds] = useState<string[]>([faqs[0].id]);

  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openedAt = useRef<number>(0);
  const interactions = useRef(0);

  const closePanel = useCallback(
    (reason: "botao" | "esc" | "fora") => {
      setOpen(false);
      track("checkout_faq_closed", {
        reason,
        open_seconds: Math.round((Date.now() - openedAt.current) / 1000),
        questions_opened: interactions.current,
      });
      triggerRef.current?.focus();
    },
    [],
  );

  const openPanel = useCallback(() => {
    openedAt.current = Date.now();
    interactions.current = 0;
    setOpen(true);
    track("checkout_faq_opened", { path: typeof window !== "undefined" ? window.location.pathname : "" });
  }, []);

  // Foco inicial ao abrir
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Esc para fechar + clique fora
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closePanel("esc");
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(t) && !triggerRef.current?.contains(t)) {
        closePanel("fora");
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, closePanel]);

  const toggleQuestion = (id: string, q: string) => {
    setOpenIds((prev) => {
      const isOpen = prev.includes(id);
      if (!isOpen) {
        interactions.current += 1;
        track("checkout_faq_question_opened", { question_id: id, question: q });
      }
      return isOpen ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  // Navegação por setas entre as perguntas (padrão accordion WAI-ARIA)
  const onHeaderKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const headers = panelRef.current?.querySelectorAll<HTMLButtonElement>("[data-faq-header]");
    if (!headers?.length) return;
    const last = headers.length - 1;
    const next =
      e.key === "ArrowDown" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowUp" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : last;
    headers[next].focus();
  };

  return (
    <div className="fixed bottom-24 right-4 z-40 md:bottom-6">
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${panelId}-title`}
          className="w-[min(88vw,340px)] rounded-2xl border border-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 id={`${panelId}-title`} className="text-sm font-semibold">Dúvidas rápidas</h2>
            <button
              ref={closeRef}
              type="button"
              aria-label="Fechar dúvidas rápidas"
              onClick={() => closePanel("botao")}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-1">
            {faqs.map((f, i) => {
              const expanded = openIds.includes(f.id);
              const headerId = `${panelId}-h-${f.id}`;
              const regionId = `${panelId}-r-${f.id}`;
              return (
                <div key={f.id} className="rounded-lg border border-border/50">
                  <h3>
                    <button
                      data-faq-header
                      id={headerId}
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={regionId}
                      onClick={() => toggleQuestion(f.id, f.q)}
                      onKeyDown={(e) => onHeaderKeyDown(e, i)}
                      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg p-2 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {f.q}
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  </h3>
                  <div id={regionId} role="region" aria-labelledby={headerId} hidden={!expanded}>
                    <p className="px-2 pb-2 text-[11px] leading-relaxed text-muted-foreground">{f.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={false}
          aria-controls={panelId}
          aria-haspopup="dialog"
          onClick={openPanel}
          className="flex min-h-11 items-center gap-2 rounded-full border border-primary/40 bg-card/90 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HelpCircle className="h-4 w-4 text-primary" aria-hidden="true" />
          Dúvidas?
        </button>
      )}
    </div>
  );
}
