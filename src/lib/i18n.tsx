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

  // ===== Home / hero =====
  "home.eyebrow": { pt: "Cyber Operations · Est. 2024", en: "Cyber Operations · Est. 2024" },
  "home.slogan.a": { pt: "Your shadow,", en: "Your shadow," },
  "home.slogan.b": { pt: "everywhere.", en: "everywhere." },
  "home.sub": {
    pt: "Infraestrutura de cybersegurança de alto desempenho. Provisionada em segundos. Blindada por padrão.",
    en: "High-performance cybersecurity infrastructure. Provisioned in seconds. Hardened by default.",
  },
  "home.cta.start": { pt: "Começar agora", en: "Get started" },
  "home.cta.trial": { pt: "Testar grátis por 24h", en: "Try free for 24h" },
  "home.trust.uptime": { pt: "99.9% uptime", en: "99.9% uptime" },
  "home.trust.operators": { pt: "2.400+ operadores", en: "2,400+ operators" },
  "home.trust.support": { pt: "Suporte 24/7", en: "24/7 support" },
  "home.scroll": { pt: "scroll", en: "scroll" },

  // ===== Home / features =====
  "home.features.kicker": { pt: "// recursos", en: "// features" },
  "home.features.title.a": { pt: "Blindagem", en: "Native" },
  "home.features.title.b": { pt: "nativa", en: "hardening" },
  "home.features.lead": {
    pt: "Cada camada foi desenhada para operações de alto risco. Zero superfície de exposição.",
    en: "Every layer is designed for high-risk operations. Zero exposure surface.",
  },
  "feat.aes.title": { pt: "AES-256-GCM", en: "AES-256-GCM" },
  "feat.aes.desc": {
    pt: "Credenciais criptografadas ponta-a-ponta. Nem nós lemos em texto puro.",
    en: "End-to-end encrypted credentials. Not even we can read them in plain text.",
  },
  "feat.pix.title": { pt: "PIX automático", en: "Automatic PIX" },
  "feat.pix.desc": {
    pt: "Mercado Pago aprovou → licença provisionada em segundos.",
    en: "Payment approved → license provisioned in seconds.",
  },
  "feat.anon.title": { pt: "Anonimato real", en: "Real anonymity" },
  "feat.anon.desc": {
    pt: "Servidor dedicado, sem logs cruzados, com rotação IP.",
    en: "Dedicated server, no cross logs, with IP rotation.",
  },
  "feat.panel.title": { pt: "Painel OSINT", en: "OSINT dashboard" },
  "feat.panel.desc": {
    pt: "Dashboard operacional com métricas em tempo real.",
    en: "Operational dashboard with real-time metrics.",
  },
  "feat.trial.title": { pt: "Trial 24h", en: "24h trial" },
  "feat.trial.desc": {
    pt: "1 trial gratuito por conta. Testa antes de comprar.",
    en: "1 free trial per account. Test before you buy.",
  },
  "feat.renew.title": { pt: "Renovação D-20", en: "Day-20 renewal" },
  "feat.renew.desc": {
    pt: "Servidor renova todo dia 20. Automatizado no painel.",
    en: "Server renews every 20th. Automated in the dashboard.",
  },

  // ===== Home / pricing =====
  "home.plans.kicker": { pt: "// licenças", en: "// licenses" },
  "home.plans.title.a": { pt: "Acesso à", en: "Access to the" },
  "home.plans.title.b": { pt: "ferramenta", en: "tool" },
  "home.plans.lead": {
    pt: "Pagamento PIX automático · Liberação em segundos",
    en: "Automatic PIX payment · Released in seconds",
  },
  "home.plans.popular": { pt: "Mais escolhido", en: "Most chosen" },
  "home.plans.subscribe": { pt: "Assinar agora", en: "Subscribe now" },
  "home.plans.buy": { pt: "Comprar", en: "Buy" },
  "plan.7d.duration": { pt: "7 Dias", en: "7 Days" },
  "plan.30d.duration": { pt: "30 Dias", en: "30 Days" },
  "plan.life.duration": { pt: "Vitalício", en: "Lifetime" },
  "plan.7d.desc": {
    pt: "Acesso completo à ferramenta para operações curtas e reconhecimento tático.",
    en: "Full tool access for short operations and tactical recon.",
  },
  "plan.30d.desc": {
    pt: "Capacidade operacional estendida com processamento prioritário.",
    en: "Extended operational capacity with priority processing.",
  },
  "plan.life.desc": {
    pt: "Acesso permanente + todas as atualizações futuras. Suporte VIP.",
    en: "Permanent access + all future updates. VIP support.",
  },
  "plan.f.panel": { pt: "Painel completo", en: "Full dashboard" },
  "plan.f.aes": { pt: "Credenciais AES-256", en: "AES-256 credentials" },
  "plan.f.support": { pt: "Suporte 24/7", en: "24/7 support" },
  "plan.f.allweekly": { pt: "Tudo do Weekly", en: "Everything in Weekly" },
  "plan.f.queue": { pt: "Fila prioritária", en: "Priority queue" },
  "plan.f.trial": { pt: "Trial de 1 dia incluso", en: "1-day trial included" },
  "plan.f.lifetime": { pt: "Licença vitalícia", en: "Lifetime license" },
  "plan.f.updates": { pt: "Updates for life", en: "Updates for life" },
  "plan.f.vip": { pt: "VIP direto", en: "Direct VIP line" },
  "plan.tier2": { pt: "TIER_02 · PRIORITÁRIO", en: "TIER_02 · PRIORITY" },

  // ===== Home / source code =====
  "home.src.kicker": { pt: "// código-fonte", en: "// source code" },
  "home.src.title.a": { pt: "Soberania", en: "Total" },
  "home.src.title.b": { pt: "total", en: "sovereignty" },
  "home.src.lead": {
    pt: "Para quem prefere rodar a infraestrutura por conta própria. Entrega por transferência criptografada.",
    en: "For those who prefer to run the infrastructure themselves. Delivered via encrypted transfer.",
  },
  "src.panel.name": { pt: "Código-fonte do painel", en: "Dashboard source code" },
  "src.panel.desc": {
    pt: "Repositório completo do painel para hospedagem soberana.",
    en: "Full dashboard repository for sovereign hosting.",
  },
  "src.full.name": { pt: "BTMOB + Servidor", en: "BTMOB + Server" },
  "src.full.desc": {
    pt: "Código-fonte do programa e do servidor. Independência absoluta.",
    en: "Source code for the software and the server. Absolute independence.",
  },
  "home.src.once": { pt: "Aquisição única", en: "One-time purchase" },
  "home.src.request": { pt: "Solicitar", en: "Request" },

  // ===== Home / cashback =====
  "home.cashback.kicker": { pt: "// cashback", en: "// cashback" },
  "home.cashback.title": {
    pt: "de retorno no primeiro depósito.",
    en: "back on your first deposit.",
  },
  "home.cashback.lead": {
    pt: "Aplique o cupom no checkout. Após o pagamento aprovado, 40% do valor retorna como saldo Shadow — utilizável em qualquer próxima compra ou renovação mensal do servidor.",
    en: "Apply the coupon at checkout. Once payment is approved, 40% comes back as Shadow balance — usable on any future purchase or monthly server renewal.",
  },
  "home.cashback.coupon": { pt: "Cupom", en: "Coupon" },
  "home.cashback.copied": { pt: "Cupom BTMOB40 copiado", en: "Coupon BTMOB40 copied" },

  // ===== Home / FAQ =====
  "home.faq.kicker": { pt: "// faq", en: "// faq" },
  "home.faq.title.a": { pt: "Perguntas", en: "Frequently asked" },
  "home.faq.title.b": { pt: "frequentes", en: "questions" },
  "faq.q1": { pt: "Como funciona o pagamento?", en: "How does payment work?" },
  "faq.a1": {
    pt: "Totalmente automático via PIX (Mercado Pago). Você escolhe o plano, paga o QR Code e, assim que o Mercado Pago confirma, a licença é provisionada e aparece no seu painel — normalmente em menos de 60 segundos.",
    en: "Fully automatic via PIX (Mercado Pago). Pick a plan, pay the QR code and as soon as payment is confirmed your license is provisioned and shows up in your dashboard — usually in under 60 seconds.",
  },
  "faq.q2": { pt: "Como recebo minhas credenciais?", en: "How do I get my credentials?" },
  "faq.a2": {
    pt: "Após o pagamento aprovado, o sistema cria um usuário aleatório no servidor, criptografa a senha com AES-256-GCM e mostra usuário, e-mail, senha e IP do servidor no seu painel. Ninguém mais tem acesso ao texto claro.",
    en: "After payment is approved the system creates a random server user, encrypts the password with AES-256-GCM and shows username, e-mail, password and server IP in your dashboard. Nobody else can read the plain text.",
  },
  "faq.q3": { pt: "Como funciona o cupom BTMOB40?", en: "How does the BTMOB40 coupon work?" },
  "faq.a3": {
    pt: "Aplique BTMOB40 no seu primeiro pedido. Após o pagamento aprovado, 40% do valor retorna como saldo Shadow, que você pode usar em qualquer próxima compra ou renovação de servidor.",
    en: "Apply BTMOB40 on your first order. Once payment is approved, 40% comes back as Shadow balance you can use on any future purchase or server renewal.",
  },
  "faq.q4": { pt: "E o trial de 1 dia?", en: "What about the 1-day trial?" },
  "faq.a4": {
    pt: "Todo usuário novo pode ativar 1 trial de 1 dia, uma vez por conta, direto no painel. Serve para você testar o BTMOB antes de comprar.",
    en: "Every new user can activate one 1-day trial, once per account, straight from the dashboard. It lets you test BTMOB before buying.",
  },
  "faq.q5": { pt: "Como funciona a renovação do servidor?", en: "How does server renewal work?" },
  "faq.a5": {
    pt: "O servidor renova todo dia 20. Se a mensalidade de R$ 450 não for paga, a licença é revogada automaticamente até você renovar. Assim que o pagamento cai, o acesso volta na hora.",
    en: "The server renews every 20th. If the R$ 450 monthly fee is not paid, the license is revoked automatically until you renew. Access returns instantly once payment clears.",
  },
  "faq.q6": { pt: "Vocês vendem o código-fonte?", en: "Do you sell the source code?" },
  "faq.a6": {
    pt: "Sim. Código-fonte do painel proprietário por R$ 2.700 e o pacote completo BTMOB + servidor por R$ 4.600. Independência total para você hospedar tudo em ambiente próprio.",
    en: "Yes. Proprietary dashboard source code for R$ 2,700 and the full BTMOB + server bundle for R$ 4,600. Total independence to host everything yourself.",
  },

  // ===== Home / final CTA + footer =====
  "home.cta.kicker": { pt: "// pronto para começar?", en: "// ready to start?" },
  "home.cta.title.a": { pt: "Entra na", en: "Join" },
  "home.cta.title.b": { pt: "e opere", en: "and operate" },
  "home.cta.title.c": { pt: "sem deixar rastros", en: "leaving no traces" },
  "home.cta.plans": { pt: "Ver planos", en: "See plans" },
  "home.cta.activate": { pt: "Ativar trial", en: "Activate trial" },
  "footer.tagline": { pt: "Your shadow everywhere · v4.6", en: "Your shadow everywhere · v4.6" },
  "footer.terms": { pt: "Termos", en: "Terms" },
  "footer.privacy": { pt: "Privacidade", en: "Privacy" },
  "footer.rights": { pt: "Shadow · Infraestrutura OSINT segura", en: "Shadow · Secure OSINT Infrastructure" },

  // ===== Tutorial =====
  "tutorial.kicker": { pt: "// docs", en: "// docs" },
  "tutorial.title": { pt: "Tutoriais Shadow", en: "Shadow tutorials" },
  "tutorial.lead": {
    pt: "Vídeos oficiais de como configurar e operar o BTMOB.",
    en: "Official videos on how to set up and operate BTMOB.",
  },
  "tutorial.yt.title": { pt: "Canal oficial no YouTube", en: "Official YouTube channel" },
  "tutorial.yt.desc": { pt: "@krebgulin — tutoriais completos", en: "@krebgulin — full tutorials" },
  "tutorial.yt.cta": { pt: "Assistir tutoriais", en: "Watch tutorials" },
  "tutorial.dl.title": { pt: "Baixar BTMOB", en: "Download BTMOB" },
  "tutorial.dl.pass": { pt: "Senha do arquivo:", en: "Archive password:" },
  "tutorial.dl.cta": { pt: "Download Mediafire", en: "Mediafire download" },

  // ===== Contato =====
  "contact.kicker": { pt: "// contact", en: "// contact" },
  "contact.title": { pt: "Fale conosco", en: "Contact us" },
  "contact.lead": {
    pt: "Já é cliente? Use o chat com admin dentro do painel — resposta muito mais rápida.",
    en: "Already a customer? Use the admin chat inside the dashboard — much faster replies.",
  },
  "contact.email.title": { pt: "E-mail oficial", en: "Official e-mail" },
  "contact.chat.title": { pt: "Chat com Admin", en: "Admin chat" },
  "contact.chat.desc": {
    pt: "Disponível dentro do painel após login.",
    en: "Available inside the dashboard after signing in.",
  },
  "contact.chat.cta": { pt: "Acessar painel", en: "Open dashboard" },
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
