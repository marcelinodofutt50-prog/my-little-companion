import { useState } from "react";
import {
  BookOpen, MessageSquare, ShieldAlert, Clock, AlertTriangle, Search,
  KeyRound, DollarSign, Users, Activity, Sparkles, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type Entry = { id: string; label: string; what: string; when: string };

const GROUPS: { title: string; icon: typeof MessageSquare; accent: string; entries: Entry[] }[] = [
  {
    title: "Operações do dia",
    icon: MessageSquare,
    accent: "text-neon",
    entries: [
      { id: "overview", label: "Visão geral", what: "Resumo do dia: receita, pedidos pendentes, tickets abertos e alertas.", when: "Abra sempre que entrar no plantão. É o raio-x de 10 segundos." },
      { id: "ia", label: "Shadow Ops IA", what: "Diagnóstico automático: aponta erros, entregas travadas e o que precisa de atenção.", when: "Quando algo parecer estranho e você não souber por onde começar." },
      { id: "chat", label: "Chat ao vivo", what: "Conversas com clientes em tempo real. Você assume o ticket, responde e fecha.", when: "Prioridade máxima. Sempre assuma antes de responder para o cliente saber quem está atendendo." },
      { id: "apk", label: "Fila Play Protect", what: "APKs enviados pelos clientes esperando processamento.", when: "Se a fila passar de alguns itens ou um job travar em 'processando'." },
      { id: "updates", label: "Publicar update", what: "Sobe uma nova versão do app para os clientes baixarem.", when: "Só com autorização — todo mundo recebe na hora." },
    ],
  },
  {
    title: "Clientes e licenças",
    icon: KeyRound,
    accent: "text-cyan",
    entries: [
      { id: "issue", label: "Emitir licença", what: "Cria um login manualmente, sem pagamento.", when: "Compensação, teste ou pagamento por fora já confirmado. Sempre registre o motivo no ticket." },
      { id: "legacy", label: "Clientes antigos", what: "Usuários da v4.5.7 que pagam a mensalidade de servidor (R$ 250).", when: "Renovação mensal desses clientes específicos." },
      { id: "external", label: "Pagam por fora", what: "Quem pagou PIX direto; aqui você estende o acesso na mão.", when: "Só depois de ver o comprovante e conferir o valor." },
      { id: "users", label: "Usuários", what: "Todas as contas cadastradas, com e-mail e data.", when: "Para achar um cliente e abrir a ficha 360º dele." },
      { id: "licenses", label: "Licenças", what: "Todos os logins: ativos, vencendo, expirados e revogados.", when: "Prorrogar, revogar ou recriar acesso. Expirados somem após 2 dias e voltam se reativados." },
    ],
  },
  {
    title: "Financeiro",
    icon: DollarSign,
    accent: "text-violet",
    entries: [
      { id: "orders", label: "Pedidos", what: "Todas as compras: quem pagou, quanto, quando e se foi entregue.", when: "Cliente diz que pagou e não recebeu → procure o pedido e use reconciliar." },
      { id: "refunds", label: "Reembolsos", what: "Pedidos de estorno. O cliente tem 7 dias para pedir; a equipe tem 2 para responder.", when: "Todo dia. Reembolso parado é reclamação certa." },
      { id: "referrals", label: "Indicações", what: "Quem indicou quem e quanto tem de cashback a receber.", when: "Ao pagar cashback — marque como pago só depois de transferir." },
      { id: "market", label: "Mercado", what: "Produtos: preço, imagem, ativar/desativar.", when: "Mudança de catálogo ou promoção." },
    ],
  },
  {
    title: "Sistema e segurança",
    icon: ShieldAlert,
    accent: "text-amber-400",
    entries: [
      { id: "staff", label: "Equipe", what: "Define quem é admin ou moderador.", when: "Só o dono mexe aqui. Admin vê e altera tudo, inclusive financeiro." },
      { id: "health", label: "Monitoramento", what: "Erros recentes, falhas de entrega e alertas do sistema.", when: "Antes de dizer 'está tudo normal' para um cliente." },
      { id: "logs", label: "Logs do servidor", what: "Registro técnico bruto.", when: "Investigação de um caso específico, junto com o pedido/licença." },
      { id: "audit", label: "Auditoria", what: "Histórico de ações dos administradores, com data e responsável.", when: "Para entender quem fez o quê. Tudo que você faz aqui fica registrado." },
      { id: "selftest", label: "Autoteste de compra", what: "Simula uma compra PIX ponta a ponta.", when: "Depois de qualquer mudança no checkout ou se as entregas falharem." },
    ],
  },
];

const RULES = [
  { icon: Clock, title: "Assuma antes de responder", text: "No chat, clique em 'assumir' para o cliente ver quem está atendendo e para evitar duas pessoas respondendo o mesmo ticket." },
  { icon: MessageSquare, title: "Responda em até 15 minutos", text: "Tickets sem resposta por 5 horas fecham sozinhos. Se não puder resolver na hora, avise um prazo." },
  { icon: AlertTriangle, title: "Nunca peça senha do cliente", text: "Nem código 2FA, nem senha do e-mail. Suporte legítimo não pede isso — e é golpe clássico se alguém pedir." },
  { icon: ShieldAlert, title: "Nada de acesso grátis por conta própria", text: "Emitir licença, reembolsar ou estender prazo sem pagamento confirmado precisa de autorização. Fica tudo na auditoria." },
  { icon: Search, title: "Use Ctrl+K", text: "Busca global: acha cliente por e-mail, pedido, licença ou ticket, e abre a ficha 360º com todo o histórico dele." },
  { icon: Activity, title: "Na dúvida, veja o histórico primeiro", text: "Abra a ficha 360º do cliente antes de agir: pedidos, licenças, tickets e reembolsos aparecem juntos." },
];

export function AdminTeamGuide({ onOpenSection }: { onOpenSection?: (id: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
          <BookOpen className="mr-2 h-3.5 w-3.5 text-cyan" /> Guia da equipe
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-4 w-4 text-neon" /> Guia da equipe · Shadow
          </DialogTitle>
          <DialogDescription>
            Manual rápido para admins e suporte: o que cada seção faz, quando usar e as regras de atendimento.
          </DialogDescription>
        </DialogHeader>

        {/* Regras */}
        <div className="grid gap-2 sm:grid-cols-2">
          {RULES.map((r) => (
            <div key={r.title} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <r.icon className="h-3.5 w-3.5 text-neon" /> {r.title}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.text}</p>
            </div>
          ))}
        </div>

        {/* Seções */}
        <Accordion type="single" collapsible className="mt-2">
          {GROUPS.map((g) => (
            <AccordionItem key={g.title} value={g.title}>
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <g.icon className={`h-4 w-4 ${g.accent}`} /> {g.title}
                  <span className="font-mono text-[10px] text-muted-foreground">{g.entries.length} seções</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {g.entries.map((e) => (
                    <div key={e.id} className="rounded-lg border border-border/50 bg-background/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">{e.label}</div>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.what}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-neon/80">
                            <span className="font-mono uppercase tracking-wider text-muted-foreground">quando usar: </span>
                            {e.when}
                          </p>
                        </div>
                        {onOpenSection && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 font-mono text-[10px] uppercase"
                            onClick={() => { onOpenSection(e.id); setOpen(false); }}
                          >
                            Abrir <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3 text-xs leading-relaxed text-amber-200/90">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Users className="h-3.5 w-3.5" /> Novo na equipe?
          </span>{" "}
          Comece por <b>Visão geral</b> → <b>Chat ao vivo</b> → <b>Pedidos</b>. Esses três resolvem 90% do dia.
        </div>
      </DialogContent>
    </Dialog>
  );
}
