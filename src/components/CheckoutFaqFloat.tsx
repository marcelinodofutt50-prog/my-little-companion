import { useState } from "react";
import { HelpCircle, X, ChevronDown } from "lucide-react";

const faqs = [
  { q: "Em quanto tempo recebo o acesso?", a: "Assim que o PIX é confirmado, o sistema cria a licença automaticamente e mostra as credenciais no seu painel — normalmente em menos de 1 minuto." },
  { q: "E se eu não gostar?", a: "Você tem 7 dias para pedir reembolso direto pelo painel, na aba de reembolso do pedido. A análise leva até 2 dias." },
  { q: "O pagamento é seguro?", a: "O checkout usa a API oficial do Mercado Pago. Nós não armazenamos dados de cartão nem chave PIX de pagamento." },
  { q: "Preciso renovar todo mês?", a: "Planos mensais renovam no ciclo do dia 20. O painel avisa com antecedência e a renovação é feita em poucos cliques." },
  { q: "Tem suporte?", a: "Sim, suporte por chat dentro do painel com histórico completo do seu atendimento." },
];

export function CheckoutFaqFloat() {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState<number | null>(0);

  return (
    <div className="fixed bottom-24 right-4 z-40 md:bottom-6">
      {open ? (
        <div className="w-[min(88vw,340px)] rounded-2xl border border-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Dúvidas rápidas</span>
            <button aria-label="Fechar" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1">
            {faqs.map((f, i) => (
              <div key={f.q} className="rounded-lg border border-border/50">
                <button
                  onClick={() => setIdx(idx === i ? null : i)}
                  className="flex w-full items-center justify-between gap-2 p-2 text-left text-xs font-medium"
                >
                  {f.q}
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${idx === i ? "rotate-180" : ""}`} />
                </button>
                {idx === i ? <p className="px-2 pb-2 text-[11px] leading-relaxed text-muted-foreground">{f.a}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-primary/40 bg-card/90 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur hover:border-primary"
        >
          <HelpCircle className="h-4 w-4 text-primary" />
          Dúvidas?
        </button>
      )}
    </div>
  );
}
