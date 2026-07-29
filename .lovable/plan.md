# Plano de melhorias

## 1. Conversão e página de planos

- Adicionar contador de promoção relâmpago na hero (ex: "Oferta termina em 09:59:59"), persistindo deadline por sessão.
- Destacar depoimentos acima da dobra da página de planos com notas e fotos reais.
- Criar sticky bar de garantia no topo: "7 dias de garantia · ativação automática · suporte 24/7".
- Simplificar o comparativo de planos: badge "Mais popular" no mensal, destacar economia do vitalício.
- Adicionar FAQ flutuante com busca por palavra-chave.

## 2. Experiência pós-compra

- Criar checklist de primeiros passos no dashboard com progresso salvo.
- Adicionar widget de "status do meu pedido" com timeline (PIX pendente → pago → licença gerada → entregue).
- Notificações push in-app para renovação, suspensão e aprovação de reembolso.
- Criar central de ajuda com busca por tópicos (instalação, login, servidor, APK, presentes).
- Melhorar o empty-state do dashboard quando o usuário ainda não tem licença.

## 3. Painel administrativo

- Adicionar busca global e filtros por status na lista de pedidos.
- Permitir ações em lote: aprovar reembolsos, reativar licenças, marcar como atendido.
- Adicionar cards de KPI no topo (receita do dia, pedidos pendentes, tickets abertos, taxa de conversão).
- Criar log de auditoria visível com ações de admin, IPs e timestamps.
- Adicionar atalho de "assumir ticket" e indicador de ticket em espera há mais tempo.

## Escopo técnico

- Novos componentes em `src/components/`.
- Novos server functions quando necessário (busca, KPIs, ações em lote).
- Sem alterações de schema complexas: aproveita tabelas existentes (`orders`, `licenses`, `refunds`, `support_threads`).

## Ordem de implementação

1. Página de planos (conversão — impacto rápido).
2. Dashboard pós-compra (retenção).
3. Admin (operacional).

Aprova pra eu começar?