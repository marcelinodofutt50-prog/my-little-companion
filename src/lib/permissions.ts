/**
 * Matriz de permissões do painel Shadow.
 *
 * Fonte única de verdade sobre o que cada papel pode VER e EXECUTAR.
 * A checagem final continua no servidor (RPC `has_role` + RLS) — isto aqui
 * controla a interface e serve de documentação para a equipe.
 */

export type Role = "admin" | "moderator" | "user";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  moderator: "Suporte",
  user: "Cliente",
};

export const ROLE_DESC: Record<Role, string> = {
  admin: "Acesso total: financeiro, licenças, equipe e sistema.",
  moderator: "Atendimento: chat, tickets, fila de APK e consulta de pedidos.",
  user: "Cliente comum: apenas o próprio painel.",
};

/** Tudo que pode ser feito no painel. */
export type Capability =
  // visualização
  | "view.overview" | "view.chat" | "view.apk" | "view.users" | "view.orders"
  | "view.licenses" | "view.referrals" | "view.refunds" | "view.market"
  | "view.updates" | "view.staff" | "view.system" | "view.audit"
  // ações
  | "chat.reply" | "chat.assume" | "chat.close"
  | "apk.manage"
  | "license.issue" | "license.extend" | "license.revoke"
  | "order.reconcile"
  | "refund.decide"
  | "referral.pay"
  | "market.edit" | "updates.publish"
  | "announcements.create" | "announcements.approve" | "announcements.publish"
  | "staff.manage" | "system.selftest" | "tutorials.manage";

const SUPPORT_CAPS: Capability[] = [
  "view.overview", "view.chat", "view.apk", "view.users", "view.orders", "view.licenses",
  "chat.reply", "chat.assume", "chat.close", "apk.manage",
  "announcements.create", "tutorials.manage", "license.issue",
];

const ALL_CAPS: Capability[] = [
  ...SUPPORT_CAPS,
  "view.referrals", "view.refunds", "view.market", "view.updates", "view.staff",
  "view.system", "view.audit",
  "license.issue", "license.extend", "license.revoke", "order.reconcile",
  "refund.decide", "referral.pay", "market.edit", "updates.publish",
  "announcements.approve", "announcements.publish",
  "staff.manage", "system.selftest",
];

export const ROLE_CAPS: Record<Role, Capability[]> = {
  admin: ALL_CAPS,
  moderator: SUPPORT_CAPS,
  user: [],
};

export function can(role: Role | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPS[role]?.includes(cap) ?? false;
}


/** Seção do painel -> capacidade mínima para enxergar. */
export const SECTION_CAP: Record<string, Capability> = {
  overview: "view.overview",
  ia: "view.system",
  chat: "view.chat",
  issue: "license.issue",
  legacy: "license.extend",
  external: "license.extend",
  users: "view.users",
  licenses: "view.licenses",
  orders: "view.orders",
  market: "view.market",
  referrals: "view.referrals",
  refunds: "view.refunds",
  staff: "view.staff",
  health: "view.system",
  servers: "system.selftest",
  logs: "view.system",
  audit: "view.audit",
  apk: "view.apk",
  updates: "view.updates",
  tutorials: "tutorials.manage",
  selftest: "system.selftest",
  trial_monitor: "view.system",
  vip: "view.users",
  nexus: "view.chat",
  academy: "view.chat",
};

/** Linhas exibidas na matriz visual (Equipe → Matriz de permissões). */
export const MATRIX_ROWS: { group: string; items: { cap: Capability; label: string; note?: string }[] }[] = [
  {
    group: "Atendimento",
    items: [
      { cap: "view.chat", label: "Ver chat ao vivo" },
      { cap: "chat.assume", label: "Assumir ticket" },
      { cap: "chat.reply", label: "Responder cliente" },
      { cap: "chat.close", label: "Fechar ticket" },
      { cap: "view.apk", label: "Ver fila Play Protect" },
      { cap: "apk.manage", label: "Gerenciar fila de APK" },
    ],
  },
  {
    group: "Clientes e licenças",
    items: [
      { cap: "view.users", label: "Ver clientes e ficha 360º" },
      { cap: "view.licenses", label: "Ver licenças" },
      { cap: "license.issue", label: "Emitir licença manual", note: "sujeito a cotas diárias/mensais para Suporte" },
      { cap: "license.extend", label: "Estender prazo" },
      { cap: "license.revoke", label: "Revogar acesso" },
    ],
  },
  {
    group: "Financeiro",
    items: [
      { cap: "view.orders", label: "Ver pedidos" },
      { cap: "order.reconcile", label: "Reconciliar pedido" },
      { cap: "view.refunds", label: "Ver reembolsos" },
      { cap: "refund.decide", label: "Aprovar/recusar reembolso" },
      { cap: "view.referrals", label: "Ver indicações" },
      { cap: "referral.pay", label: "Marcar cashback como pago" },
      { cap: "market.edit", label: "Editar Mercado e preços" },
    ],
  },
  {
    group: "Sistema",
    items: [
      { cap: "view.system", label: "Monitoramento e logs" },
      { cap: "view.audit", label: "Auditoria de ações" },
      { cap: "updates.publish", label: "Publicar update do app" },
      { cap: "system.selftest", label: "Rodar autoteste de compra" },
      { cap: "staff.manage", label: "Definir cargos da equipe", note: "só o dono" },
    ],
  },
  {
    group: "Comunicados",
    items: [
      { cap: "announcements.create", label: "Criar rascunhos de comunicados" },
      { cap: "announcements.approve", label: "Revisar e aprovar comunicados" },
      { cap: "announcements.publish", label: "Publicar comunicados (site-wide)" },
    ],
  },
  {
    group: "Conteúdo",
    items: [
      { cap: "tutorials.manage", label: "Gerenciar Centro de Treinamento", note: "Vídeos e fotos" },
    ],
  },
];
