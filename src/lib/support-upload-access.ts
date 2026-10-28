/**
 * Quem pode abrir um ticket de upload de mídia para uma conversa do suporte.
 *
 * O cargo precisa vir de uma confirmação feita no servidor (checkStaff), nunca
 * de um campo enviado pelo navegador: assim um atendente pode enviar prints em
 * qualquer conversa e um cliente apenas na própria.
 */
export function canOpenSupportUpload(args: {
  isStaff: boolean;
  threadOwnerId: string | null | undefined;
  userId: string;
}): boolean {
  if (args.isStaff) return true;
  return !!args.threadOwnerId && args.threadOwnerId === args.userId;
}
