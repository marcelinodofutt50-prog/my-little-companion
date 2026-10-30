import { z } from "zod";

/**
 * Regras puras da ficha privada de compras (somente admin).
 * Os registros são manuais: não aprovam pagamento, não liberam licença nem benefício.
 */
export const PURCHASE_RECORD_KINDS = ["purchase", "note"] as const;
export type PurchaseRecordKind = (typeof PURCHASE_RECORD_KINDS)[number];

/** Sequência longa de dígitos parece número de cartão; não deve ficar em anotações. */
export function looksLikeCardNumber(text: string): boolean {
  return /(?:^|\D)(?:\d[ -]?){12,18}\d(?:\D|$)/.test(text);
}

/** Converte "1.234,56" / "350" / "350.5" em número com 2 casas, ou null se vazio/inválido. */
export function parseAmountInput(raw: string | null | undefined): number | null | "invalid" {
  const s = (raw ?? "").trim().replace(/^R\$\s*/i, "");
  if (!s) return null;
  const normalized = /,/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return "invalid";
  const n = Number(normalized);
  return Number.isFinite(n) && n <= 1_000_000 ? Math.round(n * 100) / 100 : "invalid";
}

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const purchaseRecordInputSchema = z
  .object({
    userId: z.string().uuid(),
    kind: z.enum(PURCHASE_RECORD_KINDS),
    title: optionalText(120),
    note: optionalText(1000),
    amount: z.number().min(0).max(1_000_000).nullable().optional(),
    purchasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    receiptMessageId: z.string().uuid().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "purchase" && !v.title) ctx.addIssue({ code: "custom", path: ["title"], message: "Informe o que o cliente comprou." });
    if (v.kind === "note") {
      if (!v.note) ctx.addIssue({ code: "custom", path: ["note"], message: "Escreva a anotação." });
      if (v.title || v.amount != null) ctx.addIssue({ code: "custom", path: ["kind"], message: "Anotação não leva produto nem valor." });
    }
    for (const field of ["title", "note"] as const) {
      const text = v[field];
      if (text && looksLikeCardNumber(text)) ctx.addIssue({ code: "custom", path: [field], message: "Não registre números de cartão." });
    }
    if (v.purchasedOn) {
      const d = new Date(`${v.purchasedOn}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v.purchasedOn) ctx.addIssue({ code: "custom", path: ["purchasedOn"], message: "Data inválida." });
    }
  });

export type PurchaseRecordInput = z.infer<typeof purchaseRecordInputSchema>;

export type PurchaseRecordItem = {
  id: string;
  kind: PurchaseRecordKind;
  title: string | null;
  note: string | null;
  amount: number | null;
  purchasedOn: string | null;
  createdAt: string;
  receipt: { messageId: string; url: string | null; type: string | null } | null;
};

export function totalRecordedPurchases(items: PurchaseRecordItem[]): number {
  return Math.round(items.filter((i) => i.kind === "purchase").reduce((sum, i) => sum + (i.amount ?? 0), 0) * 100) / 100;
}
