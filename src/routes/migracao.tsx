import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  FileDown,
  LifeBuoy,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const COUPON = "MIGRA";

export const Route = createFileRoute("/migracao")({
  head: () => ({
    meta: [
      { title: "Programa de migração — Shadow" },
      {
        name: "description",
        content:
          "Vem de outro servidor BTMob? Veja o checklist do que enviar, o SLA do suporte e as perguntas frequentes para migrar para a Shadow com desconto e cashback.",
      },
      { property: "og:title", content: "Programa de migração — Shadow" },
      {
        property: "og:description",
        content:
          "Checklist, prazos de atendimento e dúvidas frequentes para migrar seu painel de outro servidor para a Shadow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MigrationPage,
});

const checklist = [
  {
    title: "Qual painel você usa hoje",
    body: "Nome do servidor/revenda atual e a versão do BTMob (ex.: 4.6). Se não souber a versão, manda um print da tela de login do painel.",
    required: true,
  },
  {
    title: "Seu usuário atual",
    body: "Apenas o nome de usuário do painel antigo. Nunca envie a senha — nem para a nossa equipe.",
    required: true,
  },
  {
    title: "Quantidade de clientes ativos",
    body: "Número aproximado de logins/clientes que você atende hoje. Isso define o plano ideal e o tempo da migração.",
    required: true,
  },
  {
    title: "Data de vencimento no servidor antigo",
    body: "Assim conseguimos encaixar a virada sem você ficar nenhum dia fora do ar.",
    required: true,
  },
  {
    title: "Print da lista de clientes (opcional)",
    body: "Se o painel antigo permite exportar, envie o arquivo. Com a lista em mãos a equipe adianta o cadastro para você.",
    required: false,
  },
  {
    title: "E-mail da sua conta Shadow",
    body: "O mesmo e-mail que você usou para criar a conta aqui — é por ele que ligamos a migração à sua licença.",
    required: true,
  },
];

const sla = [
  {
    icon: Clock,
    label: "Primeira resposta",
    time: "Até 2 horas",
    body: "Em horário comercial (09h–22h, horário de Brasília). Fora desse período, respondemos na abertura do dia seguinte.",
  },
  {
    icon: LifeBuoy,
    label: "Análise da migração",
    time: "Até 12 horas",
    body: "A equipe confere seu checklist, valida a versão do painel e devolve o plano de migração com data e horário.",
  },
  {
    icon: ShieldCheck,
    label: "Ativação da licença",
    time: "Menos de 1 minuto",
    body: "Após o pagamento aprovado, a criação da conta no painel é automática — usuário e senha chegam no seu dashboard.",
  },
  {
    icon: CheckCircle2,
    label: "Migração assistida concluída",
    time: "Até 48 horas",
    body: "Prazo máximo para deixar tudo rodando com seus clientes cadastrados, contando a partir do envio completo do checklist.",
  },
];

const faq = [
  {
    q: "Vou ficar sem servidor durante a migração?",
    a: "Não. A recomendação é manter o servidor antigo ativo até o último dia contratado. Nós preparamos o painel novo em paralelo e só viramos a chave quando estiver tudo testado.",
  },
  {
    q: "Preciso pagar o valor cheio para testar?",
    a: "Não. Use o cupom MIGRA no primeiro pagamento: 20% de desconto na hora e mais 20% de volta como cashback, que você usa na renovação seguinte.",
  },
  {
    q: "Meus clientes vão precisar reinstalar o aplicativo?",
    a: "Depende do painel de origem. Na maioria dos casos basta atualizar o arquivo de configuração no app. A equipe te entrega o passo a passo pronto para repassar aos seus clientes.",
  },
  {
    q: "Vocês fazem a transferência da lista de clientes?",
    a: "Sim, na migração assistida. Você envia a lista exportada (ou os prints) e nós cadastramos por você, sem cobrança extra.",
  },
  {
    q: "Preciso enviar a senha do meu painel antigo?",
    a: "Nunca. Não pedimos senha em nenhum momento, por nenhum canal. Se alguém pedir se passando pela Shadow, é golpe — reporte no suporte.",
  },
  {
    q: "E se eu perdi o autenticador 2FA do painel antigo?",
    a: "O código de 2 fatores não tem recuperação automática. Abra um chamado no suporte: validamos sua identidade, apagamos o login antigo e geramos um novo acesso.",
  },
  {
    q: "Se eu não gostar, consigo reembolso?",
    a: "Sim. Você tem até 7 dias para solicitar o reembolso direto no dashboard, e a análise acontece em até 2 dias.",
  },
  {
    q: "Dá para migrar mantendo a mesma data de vencimento?",
    a: "Dá. Informe a data do servidor antigo no checklist que ajustamos o início da sua licença para não sobrepor os períodos pagos.",
  },
];

function MigrationPage() {
  function copyCoupon() {
    navigator.clipboard.writeText(COUPON);
    toast.success(`Cupom ${COUPON} copiado`);
  }

  function downloadChecklist() {
    const content =
      "Shadow — Programa de migração\nChecklist para enviar ao suporte\n\n" +
      checklist
        .map(
          (c, i) =>
            `${i + 1}. [${c.required ? "obrigatório" : "opcional"}] ${c.title}\n   ${c.body}\n   Resposta: ______________________\n`,
        )
        .join("\n") +
      "\nNunca envie senhas. A equipe Shadow jamais pede sua senha.\n";
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "shadow-checklist-migracao.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Checklist baixado");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <div className="font-mono text-[11px] uppercase tracking-widest text-neon">Programa de migração</div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          Saindo de outro servidor? A gente conduz a mudança.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Queda de servidor, painel travando, cliente sumindo e suporte que não responde não deveriam ser rotina.
          Aqui você encontra exatamente o que precisa enviar, quanto tempo cada etapa leva e as dúvidas mais comuns
          de quem já migrou.
        </p>

        <div className="mt-6 flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider">
              Cupom <span className="text-neon">{COUPON}</span> — 20% off + 20% de cashback
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Válido no primeiro pagamento. O cashback volta como saldo para a próxima renovação.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyCoupon} className="font-mono uppercase">
              <Copy className="mr-2 h-3.5 w-3.5" /> Copiar cupom
            </Button>
            <Button asChild size="sm" className="font-mono uppercase">
              <Link to="/planos">
                Ver planos <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Checklist */}
        <section className="mt-12">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-neon" />
            <h2 className="font-display text-2xl tracking-tight">O que você precisa enviar</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Reúna estes itens antes de abrir o chamado — com tudo em mãos, a migração sai no mesmo dia.
          </p>

          <ol className="mt-5 space-y-3">
            {checklist.map((item, i) => (
              <li
                key={item.title}
                className="flex items-start gap-3 rounded-md border border-border/60 bg-card/50 p-4"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-neon/40 font-mono text-[10px] text-neon">
                  {i + 1}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold">{item.title}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                        item.required
                          ? "border border-neon/40 text-neon"
                          : "border border-border/60 text-muted-foreground"
                      }`}
                    >
                      {item.required ? "obrigatório" : "opcional"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadChecklist} className="font-mono uppercase">
              <FileDown className="mr-2 h-3.5 w-3.5" /> Baixar checklist .txt
            </Button>
            <Button asChild size="sm" className="font-mono uppercase">
              <Link to="/suporte">
                Abrir chamado de migração <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-[11px] leading-snug">
              <span className="font-semibold">Nunca envie senhas.</span> A equipe Shadow não pede senha do painel
              antigo, nem código de 2FA, nem por chat, Telegram ou WhatsApp. Usuário e prints já bastam.
            </p>
          </div>
        </section>

        {/* Formulário */}
        <section className="mt-14" id="formulario">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-neon" />
            <h2 className="font-display text-2xl tracking-tight">Enviar meu checklist</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Preencha aqui e anexe o comprovante de que você já usa outro servidor — sem copiar e colar em lugar
            nenhum. A equipe recebe tudo junto e já abre o seu chamado de migração.
          </p>
          <div className="mt-5">
            <MigrationRequestForm />
          </div>
        </section>


        {/* SLA */}
        <section className="mt-14">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-neon" />
            <h2 className="font-display text-2xl tracking-tight">SLA do suporte</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Prazos que a equipe se compromete a cumprir durante a migração.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {sla.map((s) => (
              <div key={s.label} className="rounded-md border border-border/60 bg-card/50 p-4">
                <div className="flex items-center gap-2">
                  <s.icon className="h-4 w-4 shrink-0 text-neon" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </span>
                </div>
                <div className="mt-2 font-display text-xl tracking-tight text-neon">{s.time}</div>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Os prazos começam a contar do momento em que o checklist chega completo. Itens faltando pausam a
            contagem até você complementar.
          </p>
        </section>

        {/* FAQ */}
        <section className="mt-14">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-neon" />
            <h2 className="font-display text-2xl tracking-tight">Perguntas frequentes</h2>
          </div>

          <Accordion type="single" collapsible className="mt-4">
            {faq.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
                <AccordionContent className="text-[12px] leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <div className="mt-12 flex flex-col items-center gap-3 rounded-md border border-border/60 bg-card/50 p-6 text-center">
          <h3 className="font-display text-xl tracking-tight">Pronto para sair do servidor problemático?</h3>
          <p className="max-w-md text-[12px] text-muted-foreground">
            Escolha o plano, aplique o cupom {COUPON} e abra o chamado — a equipe assume a migração com você.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm" className="font-mono uppercase">
              <Link to="/planos">
                Ver planos <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="font-mono uppercase">
              <Link to="/suporte">Falar com o suporte</Link>
            </Button>
          </div>
        </div>

        <Link to="/" className="mt-8 inline-block text-xs text-muted-foreground hover:text-foreground">
          ← Voltar ao início
        </Link>
      </main>
    </div>
  );
}
