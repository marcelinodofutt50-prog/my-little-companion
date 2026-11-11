// Regras do cupom de recuperação de carrinho (winback).
// Mantido fora do arquivo de server functions para não vazar no bundle client.

export type WinbackTier = {
  key: "novo" | "cliente" | "vip" | "legacy";
  discountPct: number;
  label: string;
};

export function computeWinbackTier(input: {
  paidOrders: number;
  totalSpent: number;
  isLegacy: boolean;
}): WinbackTier {
  const { paidOrders, totalSpent, isLegacy } = input;

  if (isLegacy) {
    return { key: "legacy", discountPct: 15, label: "Cliente desde a 4.5.7" };
  }
  if (paidOrders >= 3 || totalSpent >= 1000) {
    return { key: "vip", discountPct: 12, label: "Cliente VIP" };
  }
  if (paidOrders >= 1) {
    return { key: "cliente", discountPct: 8, label: "Cliente recorrente" };
  }
  return { key: "novo", discountPct: 5, label: "Primeira compra" };
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateWinbackCode(): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `VOLTA-${s}`;
}

// Janela de urgência do cupom (minutos).
export const WINBACK_TTL_MINUTES = 30;
