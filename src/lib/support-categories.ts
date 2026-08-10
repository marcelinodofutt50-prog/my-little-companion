export const SUPPORT_CATEGORIES = [
  "servidor",
  "login",
  "pagamento",
  "apk",
  "reembolso",
  "outro",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export type SupportCategoryMeta = {
  id: SupportCategory;
  label: string;
  hint: string;
  emoji: string;
  urgent?: boolean;
  quickMessages: string[];
};

export const SUPPORT_CATEGORY_META: SupportCategoryMeta[] = [
  {
    id: "servidor",
    label: "Servidor off / instável",
    hint: "Não conecta, cai toda hora, lag",
    emoji: "📡",
    urgent: true,
    quickMessages: [
      "O servidor está offline pra mim, não consigo conectar.",
      "Está caindo a conexão a cada poucos minutos.",
      "Está muito lento / com lag alto agora.",
    ],
  },
  {
    id: "login",
    label: "Login / acesso",
    hint: "Senha, 2FA, conta bloqueada",
    emoji: "🔑",
    quickMessages: [
      "Meu login não está funcionando no painel.",
      "Perdi o acesso ao meu 2FA.",
      "Minha licença sumiu do dashboard.",
    ],
  },
  {
    id: "pagamento",
    label: "Pagamento / PIX",
    hint: "Paguei e não recebi, cobrança",
    emoji: "💳",
    urgent: true,
    quickMessages: [
      "Paguei o PIX e ainda não recebi meus dados.",
      "O pagamento ficou pendente, pode verificar?",
      "Fui cobrado duas vezes.",
    ],
  },
  {
    id: "apk",
    label: "Play Protect / APK",
    hint: "Fila, upload, APK bloqueado",
    emoji: "🛡️",
    quickMessages: [
      "Meu APK está travado na fila do Play Protect.",
      "O upload do APK está dando erro.",
      "O Play Protect continua bloqueando o app.",
    ],
  },
  {
    id: "reembolso",
    label: "Reembolso",
    hint: "Solicitação e status",
    emoji: "↩️",
    quickMessages: [
      "Quero solicitar reembolso da minha compra.",
      "Meu reembolso ainda não foi aprovado.",
    ],
  },
  {
    id: "outro",
    label: "Outro assunto",
    hint: "Dúvidas gerais",
    emoji: "💬",
    quickMessages: [
      "Tenho uma dúvida sobre os planos.",
      "Preciso de ajuda com outra coisa.",
    ],
  },
];

export function categoryMeta(id?: string | null): SupportCategoryMeta {
  return SUPPORT_CATEGORY_META.find((c) => c.id === id) ?? SUPPORT_CATEGORY_META[SUPPORT_CATEGORY_META.length - 1];
}
