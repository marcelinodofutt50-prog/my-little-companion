import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Exibição de preços em BRL ou USD. A cobrança continua sempre em BRL
 * (PIX/Mercado Pago) — o USD é só uma conversão aproximada para quem é de fora.
 */
export type Currency = "BRL" | "USD";
export type CurrencyMode = Currency | "auto";

const FALLBACK_RATE = 5.5; // BRL por 1 USD, usado se a cotação não carregar
const RATE_KEY = "shadow.usdbrl";
const MODE_KEY = "shadow.currency";

const BR_TZ = /^America\/(Sao_Paulo|Fortaleza|Recife|Bahia|Belem|Maceio|Araguaina|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Eirunepe|Santarem|Noronha)$/;

export function detectCurrency(): Currency {
  if (typeof navigator === "undefined") return "BRL";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (BR_TZ.test(tz)) return "BRL";
  } catch { /* ignore */ }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  if (langs.some((l) => (l || "").toLowerCase() === "pt-br")) return "BRL";
  return "USD";
}

/** Converte BRL → USD arredondando para cima em 0,99 (preço "redondo"). */
export function brlToUsd(brl: number, rate: number): number {
  const usd = brl / (rate > 0 ? rate : FALLBACK_RATE);
  if (usd >= 10) return Math.ceil(usd) - 0.01;
  return Math.round(usd * 100) / 100;
}

export function formatMoney(brl: number, currency: Currency, rate: number): string {
  if (currency === "USD") {
    return brlToUsd(Number(brl) || 0, rate).toLocaleString("en-US", { style: "currency", currency: "USD" });
  }
  return (Number(brl) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Ctx = {
  currency: Currency;
  mode: CurrencyMode;
  rate: number;
  setMode: (m: CurrencyMode) => void;
  fmt: (brl: number) => string;
  /** Partes para preços grandes: inteiro e centavos com o separador certo. */
  parts: (brl: number) => { main: string; cents: string };
};

const make = (currency: Currency, rate: number) => {
  const fmt = (brl: number) => formatMoney(brl, currency, rate);
  const parts = (brl: number) => {
    const s = fmt(brl);
    const sep = currency === "USD" ? "." : ",";
    const i = s.lastIndexOf(sep);
    return i < 0 ? { main: s, cents: "" } : { main: s.slice(0, i), cents: s.slice(i) };
  };
  return { fmt, parts };
};

const CurrencyContext = createContext<Ctx>({
  currency: "BRL", mode: "auto", rate: FALLBACK_RATE, setMode: () => {}, ...make("BRL", FALLBACK_RATE),
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<CurrencyMode>("auto");
  const [currency, setCurrency] = useState<Currency>("BRL");
  const [rate, setRate] = useState(FALLBACK_RATE);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(MODE_KEY); } catch { /* ignore */ }
    const m: CurrencyMode = saved === "BRL" || saved === "USD" ? saved : "auto";
    setModeState(m);
    const cur = m === "auto" ? detectCurrency() : m;
    setCurrency(cur);
    if (cur === "USD") loadRate().then(setRate);
  }, []);

  const setMode = (m: CurrencyMode) => {
    setModeState(m);
    const cur = m === "auto" ? detectCurrency() : m;
    setCurrency(cur);
    if (cur === "USD") loadRate().then(setRate);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
  };

  return (
    <CurrencyContext.Provider value={{ currency, mode, rate, setMode, ...make(currency, rate) }}>
      {children}
    </CurrencyContext.Provider>
  );
}

async function loadRate(): Promise<number> {
  try {
    const raw = localStorage.getItem(RATE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { r: number; t: number };
      if (c.r > 1 && c.r < 20 && Date.now() - c.t < 12 * 3600_000) return c.r;
    }
  } catch { /* ignore */ }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = await res.json();
    const r = Number(j?.rates?.BRL);
    if (r > 1 && r < 20) {
      try { localStorage.setItem(RATE_KEY, JSON.stringify({ r, t: Date.now() })); } catch { /* ignore */ }
      return r;
    }
  } catch { /* ignore */ }
  return FALLBACK_RATE;
}

export function useMoney() {
  return useContext(CurrencyContext);
}

export function CurrencyToggle({ className = "" }: { className?: string }) {
  const { mode, setMode } = useMoney();
  const btn = (value: CurrencyMode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={`px-2 py-1 transition-colors ${mode === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
      aria-pressed={mode === value}
    >
      {label}
    </button>
  );
  return (
    <div className={`inline-flex items-center rounded-none border border-border font-mono text-[10px] uppercase tracking-[0.2em] ${className}`}>
      {btn("auto", "Auto")}
      {btn("BRL", "R$")}
      {btn("USD", "US$")}
    </div>
  );
}

/** Aviso curto para quem vê em USD: a cobrança é feita em reais. */
export function UsdNotice({ className = "" }: { className?: string }) {
  const { currency, fmt } = useMoney();
  if (currency !== "USD") return null;
  return (
    <p className={`text-[11px] text-muted-foreground ${className}`}>
      Prices in US$ are approximate ({fmt(100)} ≈ R$ 100,00). Payment is charged in Brazilian reais (BRL); the exact amount appears at checkout. International buyers can also pay with crypto.
    </p>
  );
}
