import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "pt" | "en";

type Dict = Record<string, { pt: string; en: string }>;

const DICT: Dict = {
  "nav.home": { pt: "Início", en: "Home" },
  "nav.plans": { pt: "Planos", en: "Plans" },
  "nav.tutorial": { pt: "Tutorial", en: "Tutorial" },
  "nav.contact": { pt: "Contato", en: "Contact" },
  "nav.crypto": { pt: "Cripto", en: "Crypto" },
  "nav.downloads": { pt: "Downloads", en: "Downloads" },
  "nav.referrals": { pt: "Indicações", en: "Referrals" },
  "nav.panel": { pt: "Painel", en: "Dashboard" },
  "nav.signin": { pt: "Entrar", en: "Sign in" },

  "crypto.title": { pt: "Pagamento em Cripto", en: "Crypto Payment" },
  "crypto.kicker": { pt: "// alternative rail", en: "// alternative rail" },
  "crypto.subtitle": {
    pt: "Para clientes internacionais (Angola, Europa e outros). Escolha a rede, envie o valor equivalente ao plano e nos avise no suporte.",
    en: "For international customers (Angola, Europe and others). Pick a network, send the amount equivalent to your plan, then notify our support team.",
  },
  "crypto.howto.title": { pt: "Como pagar em 3 passos", en: "How to pay in 3 steps" },
  "crypto.howto.1": {
    pt: "Escolha a moeda e a rede correta abaixo. Copie o endereço ou escaneie o QR.",
    en: "Pick the correct coin and network below. Copy the address or scan the QR code.",
  },
  "crypto.howto.2": {
    pt: "Envie o valor equivalente ao plano desejado (converta BRL → USD/USDT/BTC/ETH pela cotação atual).",
    en: "Send the amount equivalent to your chosen plan (convert BRL → USD/USDT/BTC/ETH at the current rate).",
  },
  "crypto.howto.3": {
    pt: "Abra o Suporte no painel e envie: (1) hash da transação, (2) print do envio, (3) plano desejado. Liberamos sua licença manualmente em minutos.",
    en: "Open Support in the dashboard and send: (1) transaction hash, (2) screenshot of the transfer, (3) desired plan. We release your license manually within minutes.",
  },
  "crypto.warn.network": {
    pt: "Atenção à rede. Envios pela rede errada são perdidos permanentemente.",
    en: "Mind the network. Transfers on the wrong chain are lost permanently.",
  },
  "crypto.copy": { pt: "Copiar endereço", en: "Copy address" },
  "crypto.copied": { pt: "Endereço copiado", en: "Address copied" },
  "crypto.openSupport": { pt: "Abrir suporte com o comprovante", en: "Open support with the receipt" },
  "crypto.network": { pt: "Rede", en: "Network" },
  "crypto.address": { pt: "Endereço", en: "Address" },
  "crypto.sendOnly": { pt: "Envie apenas", en: "Send only" },
  "crypto.toThisAddress": { pt: "para este endereço.", en: "to this address." },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof DICT) => string };

const I18nContext = createContext<Ctx>({ lang: "pt", setLang: () => {}, t: (k) => DICT[k]?.pt ?? String(k) });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt");
  useEffect(() => {
    const saved = (typeof window !== "undefined" && (localStorage.getItem("shadow.lang") as Lang | null)) || null;
    if (saved === "pt" || saved === "en") setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("shadow.lang", l); } catch {}
  };
  const t = (k: keyof typeof DICT) => DICT[k]?.[lang] ?? String(k);
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`inline-flex items-center rounded-none border border-border font-mono text-[10px] uppercase tracking-[0.2em] ${className}`}>
      <button
        type="button"
        onClick={() => setLang("pt")}
        className={`px-2 py-1 transition-colors ${lang === "pt" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        aria-pressed={lang === "pt"}
      >PT</button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2 py-1 transition-colors ${lang === "en" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        aria-pressed={lang === "en"}
      >EN</button>
    </div>
  );
}
