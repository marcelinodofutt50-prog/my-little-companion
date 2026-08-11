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
  
  "nav.shadowpass": { pt: "Shadow Pass", en: "Shadow Pass" },
  "nav.panel": { pt: "Painel", en: "Dashboard" },
  "nav.signin": { pt: "Entrar", en: "Sign in" },
  "nav.signout": { pt: "Sair", en: "Sign out" },
  "nav.navigation": { pt: "Navegação", en: "Navigation" },
  "nav.market": { pt: "Mercado", en: "Market" },
  "nav.gifts": { pt: "Presentes", en: "Gifts" },
  "nav.support": { pt: "Suporte", en: "Support" },
  "nav.admin": { pt: "Painel Admin", en: "Admin Panel" },
  "nav.playprotect": { pt: "Bypass Play Protect", en: "Bypass Play Protect" },
  "nav.tutorials": { pt: "Centro de Treinamento", en: "Training Hub" },
  "nav.kraken": { pt: "Kraken (2.0)", en: "Kraken (2.0)" },


  // ===== Dashboard =====
  "dash.client_panel": { pt: "Painel do cliente", en: "Customer Dashboard" },
  "dash.access_level": { pt: "Nível de Acesso", en: "Access Level" },
  "nav.loyalty": { pt: "Shadow Loyalty", en: "Shadow Loyalty" },
  "loyalty.title": { pt: "Shadow Loyalty Center", en: "Shadow Loyalty Center" },
  "loyalty.missions": { pt: "Missões de Sombra", en: "Shadow Missions" },
  "loyalty.rewards": { pt: "Recompensas", en: "Rewards" },
  "loyalty.vip_status": { pt: "Status VIP", en: "VIP Status" },
  "vip.none": { pt: "Nenhum", en: "None" },
  "vip.vip": { pt: "Shadow VIP", en: "Shadow VIP" },
  "vip.gold": { pt: "Shadow GOLD", en: "Shadow GOLD" },
  "vip.elite": { pt: "Shadow ELITE", en: "Shadow ELITE" },

  "dash.license_days": { pt: "dias de licença", en: "license days" },
  "dash.expires_today": { pt: "expira hoje", en: "expires today" },
  "dash.offline": { pt: "acesso offline", en: "offline access" },
  "dash.active_terminals": { pt: "terminals ativ.", en: "active terminals" },
  "dash.archived": { pt: "Arquivadas", en: "Archived" },
  "dash.trial": { pt: "Trial", en: "Trial" },
  "dash.active": { pt: "Ativas", en: "Active" },
  "dash.all": { pt: "Todas", en: "All" },
  "dash.filter": { pt: "Filtro:", en: "Filter:" },
  "dash.sort": { pt: "Ordem:", en: "Sort:" },
  "dash.expires_asc": { pt: "Expira (cresc)", en: "Expires (asc)" },
  "dash.expires_desc": { pt: "Expira (decresc)", en: "Expires (desc)" },
  "dash.created_desc": { pt: "Novo primeiro", en: "Newest first" },
  "dash.created_asc": { pt: "Antigo primeiro", en: "Oldest first" },
  "dash.no_licenses": { pt: "Nenhuma licença ativa encontrada com este filtro.", en: "No active licenses found with this filter." },
  "dash.operator_console": { pt: "operator console", en: "operator console" },

  // ===== Support / Chat =====
  "chat.title": { pt: "Suporte Shadow", en: "Shadow Support" },
  "chat.online": { pt: "online agora", en: "online now" },
  "chat.ticket": { pt: "ticket", en: "ticket" },
  "chat.attendant": { pt: "atendente", en: "agent" },
  "chat.fix_login": { pt: "Corrigir erro de login", en: "Fix login error" },
  "chat.ai_trigger": { pt: "Gatilho de correção ativado", en: "Correction trigger activated" },
  "chat.ai_trigger_desc": { pt: "Envie a mensagem agora para que a Shadow IA tente corrigir seu login automaticamente.", en: "Send the message now so Shadow AI can try to fix your login automatically." },
  "chat.new_response": { pt: "nova resposta do admin", en: "new agent response" },
  "chat.load_older": { pt: "Carregar mensagens anteriores", en: "Load previous messages" },
  "chat.placeholder": { pt: "Descreva seu problema...", en: "Describe your problem..." },
  "chat.wait": { pt: "Aguarde...", en: "Wait..." },
  "chat.sending": { pt: "Enviando...", en: "Sending..." },
  "chat.retry": { pt: "Tentar novamente", en: "Retry" },
  "chat.discard": { pt: "Descartar", en: "Discard" },
  "chat.choose_cat": { pt: "Qual é o assunto?", en: "What is the subject?" },
  "chat.cat_label": { pt: "Assunto do atendimento", en: "Support subject" },

  // ===== Play Protect / Bypass Play Protect =====
  "pp.title": { pt: "Bypass Play Protect (Play Protect Bypass)", en: "Bypass Play Protect (Play Protect Bypass)" },
  "pp.header": { pt: "Bypass Play Protect (Public Builder)", en: "Bypass Play Protect (Public Builder)" },
  "pp.desc": { pt: "O console automatizado para injeção de dropper (Shadow Bypass v4.6) e bypass polimórfico total do Play Protect.", en: "The automated console for Shadow Bypass v4.6 dropper injection and total polymorphic Play Protect bypass." },
  "pp.no_access": { pt: "Este recurso está disponível apenas para clientes com plano Mensal (4.5.7) ou Vitalício (4.6).", en: "This feature is available only for Monthly (4.5.7) or Lifetime (4.6) customers." },
  "pp.new_op": { pt: "Nova Operação", en: "New Operation" },
  "pp.app_name": { pt: "Nome do Aplicativo", en: "App Name" },
  "pp.apk_file": { pt: "Arquivo APK Original", en: "Original APK File" },
  "pp.icon_file": { pt: "Ícone Customizado (Opcional)", en: "Custom Icon (Optional)" },
  "pp.start_build": { pt: "Iniciar Compilação", en: "Start Build" },
  "pp.processing": { pt: "Processando em cluster...", en: "Processing in cluster..." },
  "pp.ready": { pt: "Pronto para implantação", en: "Ready for deployment" },
  "pp.download": { pt: "Download", en: "Download" },
  "pp.recent_ops": { pt: "Operações Recentes", en: "Recent Operations" },
  "pp.no_builds": { pt: "Nenhuma build registrada", en: "No builds registered" },
  "pp.managed_service": { pt: "Serviço Gerenciado (Play Protect Cloak)", en: "Managed Service (Play Protect Cloak)" },
  "pp.managed_desc": { pt: "Precisa de um bypass manual persistente ou suporte para APKs complexos?", en: "Need a persistent manual bypass or support for complex APKs?" },
  "pp.access_queue": { pt: "Acessar Fila de Envios", en: "Access Submission Queue" },
  "pp.est_time": { pt: "O APK Tool processa os arquivos em servidores remotos. O tempo estimado de build é de 2 a 5 minutos.", en: "APK Tool processes files on remote servers. Estimated build time is 2-5 minutes." },
  "pp.fill_fields": { pt: "Por favor, preencha o nome do app e selecione um APK.", en: "Please fill the app name and select an APK." },
  "pp.build_success": { pt: "Build iniciada com sucesso!", en: "Build started successfully!" },
  "pp.build_error": { pt: "Erro ao iniciar build", en: "Error starting build" },
  
  // ===== Referrals =====
  "ref.program": { pt: "Programa de Indicações", en: "Referral Program" },
  "ref.kicker": { pt: "// referral program", en: "// referral program" },
  "ref.lead": { pt: "Indique novos operadores e receba R$ 150 por cada conversão confirmada. Saldo resgatável via PIX.", en: "Refer new operators and earn R$ 150 for each confirmed conversion. Balance withdrawable via PIX." },
  "ref.code_label": { pt: "seu código de indicação", en: "your referral code" },
  "ref.share_tip": { pt: "Compartilhe o link ou apenas o código. A pessoa digita seu código no checkout.", en: "Share the link or just the code. The person enters your code at checkout." },
  "ref.stats_total": { pt: "Indicações", en: "Referrals" },
  "ref.stats_granted": { pt: "Recompensadas", en: "Rewarded" },
  "ref.stats_pending": { pt: "Pendentes", en: "Pending" },
  "ref.stats_cashback": { pt: "Cashback total", en: "Total Cashback" },
  "ref.pref_title": { pt: "Como você quer receber?", en: "How do you want to receive?" },
  "ref.pref_save": { pt: "Salvar preferência", en: "Save preference" },
  "ref.list_title": { pt: "Suas indicações", en: "Your referrals" },
  "ref.no_referrals": { pt: "Ninguém usou seu código ainda.", en: "No one has used your code yet." },
  "ref.table_when": { pt: "Quando", en: "When" },
  "ref.table_who": { pt: "Indicado", en: "Referred" },
  "ref.table_reward": { pt: "Recompensa", en: "Reward" },
  "ref.table_amount": { pt: "Valor", en: "Amount" },
  "ref.table_status": { pt: "Status", en: "Status" },

  // ===== Gifts =====
  "gift.title": { pt: "Histórico de presentes", en: "Gifts History" },
  "gift.lead": { pt: "Tudo que você presenteou e tudo que recebeu — com status, datas e comprovante.", en: "Everything you gifted and everything you received — with status, dates, and receipt." },
  "gift.send_btn": { pt: "Presentear alguém", en: "Gift someone" },
  "gift.received": { pt: "Recebidos", en: "Received" },
  "gift.sent": { pt: "Enviados", en: "Sent" },
  "gift.total": { pt: "Total presenteado", en: "Total gifted" },
  "gift.loading": { pt: "Carregando histórico...", en: "Loading history..." },
  "gift.empty_received": { pt: "Você ainda não recebeu nenhum presente.", en: "You haven't received any gifts yet." },
  "gift.empty_sent": { pt: "Você ainda não presenteou ninguém.", en: "You haven't gifted anyone yet." },
  "gift.card_to": { pt: "Para", en: "To" },
  "gift.card_from": { pt: "De", en: "From" },
  "gift.dl_receipt": { pt: "Baixar comprovante", en: "Download receipt" },
  "gift.copy_data": { pt: "Copiar dados", en: "Copy data" },
  "gift.see_my_access": { pt: "Ver meus acessos", en: "See my access" },



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
  "home.btmob.kicker": { pt: "// integrações & módulos", en: "// integrations & modules" },
  "home.btmob.title": { pt: "Btmob core conexxion", en: "Btmob core connection" },
  "home.btmob.lead": { 
    pt: "Interface real do ecossistema Shadow · sincronizada em tempo real com sua VPS", 
    en: "Real interface of the Shadow ecosystem · synchronized in real-time with your VPS" 
  },
  "home.btmob.client_manager": { pt: "GERENCIADOR DE CLIENTES", en: "CLIENT MANAGER" },
  "home.btmob.updates": { pt: "BTMOB ATUALIZAÇÕES", en: "BTMOB UPDATES" },
  "home.cta.ready": { pt: "Pronto para o próximo nível?", en: "Ready for the next level?" },
  "home.cta.desc": {
    pt: "Tá esperando o quê? Entre na Shadow e opere sem deixar rastros. Ativação imediata via PIX Mercado Pago.",
    en: "What are you waiting for? Join Shadow and operate without leaving a trace. Immediate activation via automatic payment."
  },
  "home.cta.buy": { pt: "Adquirir Acesso Agora", en: "Get Access Now" },
  "home.cta.mobile": { pt: "Entrar na Shadow", en: "Join Shadow" },
  "home.feat.signer.title": { pt: "Bypass Play Protect", en: "Bypass Play Protect" },
  "home.feat.signer.desc": { 
    pt: "Assinatura digital V2/V3 com bypass nativo Play Protect. Seus APKs limpos e operacionais em segundos.", 
    en: "V2/V3 digital signature with native Play Protect bypass. Your APKs clean and operational in seconds." 
  },
  "home.feat.vps.title": { pt: "VPS Dedicada", en: "Dedicated VPS" },
  "home.feat.vps.desc": { 
    pt: "Rede de servidores distribuídos com IP fixo e uptime de 99.9%. Velocidade e estabilidade para sua operação.", 
    en: "Distributed server network with fixed IP and 99.9% uptime. Speed and stability for your operation." 
  },
  "home.feat.osint.title": { pt: "OSINT Tools", en: "OSINT Tools" },
  "home.feat.osint.desc": { 
    pt: "Módulos avançados de busca e mineração de dados em fontes abertas. Inteligência digital na ponta dos dedos.", 
    en: "Advanced search and data mining modules from open sources. Digital intelligence at your fingertips." 
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
  "plan.monthly.note": { 
    pt: "Atenção: Este plano libera o LOGIN. Se você já tem um login ativo (incluindo Trial) e só quer pagar a manutenção, use 'Renovação Servidor'.", 
    en: "Warning: This plan releases the LOGIN. If you already have an active login (including Trial) and just want to pay maintenance, use 'Server Renewal'." 
  },
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

  // ===== Components / BeforeAfter =====
  "ba.kicker": { pt: "// antes vs depois", en: "// before vs after" },
  "ba.title": { pt: "Antes vs Shadow BTMOB", en: "Before vs Shadow BTMOB" },
  "ba.desc": { pt: "Métricas reais reportadas pelos operadores que já migraram de builds próprios ou de concorrentes instáveis. Sem promessa vaga — número frio.", en: "Real metrics reported by operators who migrated from their own builds or unstable competitors. No vague promises — cold numbers." },
  "ba.col.metric": { pt: "Métrica", en: "Metric" },
  "ba.col.before": { pt: "Sem Shadow", en: "Without Shadow" },
  "ba.col.after": { pt: "Shadow", en: "Shadow" },
  "ba.col.gain": { pt: "Ganho", en: "Gain" },
  "ba.metric.setup": { pt: "Tempo de setup", en: "Setup time" },
  "ba.metric.setup.before": { pt: "3–7 dias tentando compilar sozinho", en: "3–7 days trying to compile alone" },
  "ba.metric.setup.after": { pt: "< 60 segundos após o PIX", en: "< 60 seconds after payment" },
  "ba.metric.risk": { pt: "Risco de bloqueio", en: "Block risk" },
  "ba.metric.risk.before": { pt: "APK bloqueado no primeiro install", en: "APK blocked on first install" },
  "ba.metric.risk.after": { pt: "Bypass automático em cada build", en: "Automatic bypass on every build" },
  "ba.metric.success": { pt: "Taxa de êxito", en: "Success rate" },
  "ba.metric.success.before": { pt: "~35% (build instável, crash)", en: "~35% (unstable build, crash)" },
  "ba.metric.success.after": { pt: "98%+ verificado por clientes", en: "98%+ verified by customers" },
  "ba.metric.support": { pt: "Apoio técnico", en: "Technical support" },
  "ba.metric.support.before": { pt: "Fóruns, Discord, sem resposta", en: "Forums, Discord, no response" },
  "ba.metric.support.after": { pt: "Chat interno · resposta em min.", en: "Internal chat · reply in mins" },
  "ba.metric.cost": { pt: "Custo operacional", en: "Operational cost" },
  "ba.metric.cost.before": { pt: "R$ 1.200+ (VPS + dev + tempo)", en: "R$ 1,200+ (VPS + dev + time)" },
  "ba.metric.cost.after": { pt: "A partir de R$ 300/mês", en: "Starting at R$ 300/month" },

  // ===== Components / ProofWall =====
  "pw.kicker": { pt: "// resultados", en: "// results" },
  "pw.title": { pt: "Resultados que falam por si.", en: "Results that speak for themselves." },
  "pw.desc": { pt: "Capturas de tela reais de clientes utilizando a Shadow em operações ativas.", en: "Real customer screenshots using Shadow in active operations." },
  "pw.badge": { pt: "Resultados verificados", en: "Verified results" },
  "pw.label.ref": { pt: "Referência", en: "Ref" },
  "pw.label.nav": { pt: "clique para ampliar · use ← → para navegar", en: "click to enlarge · use ← → to navigate" },
  "pw.caption.phones": { pt: '"Deu bom" · "finalmente 🔥🔥" — 3 dispositivos espelhados no PC operando em tempo real.', en: '"It worked" · "finally 🔥🔥" — 3 devices mirrored on PC operating in real time.' },
  "pw.caption.pix1800": { pt: 'PIX de R$ 1.800 recebido · cliente confirma "meu login ai · ta rodando ag ainda"', en: 'R$ 1,800 PIX received · customer confirms "my login is here · running now"' },
  "pw.caption.pix900": { pt: 'PIX de R$ 900 do "cliente btmob" — "Brigado pela confiança 🔥"', en: 'R$ 900 PIX from "btmob customer" — "Thanks for the trust 🔥"' },
  "pw.caption.renew300": { pt: 'Renovação de R$ 300 · painel responde "Expire Date updated successfully!" em segundos.', en: 'R$ 300 renewal · panel replies "Expire Date updated successfully!" in seconds.' },
  "pw.caption.src": { pt: 'Entrega do BTMOB 4.0 FULL SRC (912 MB) · "Obrigado pela confiança 🔥🔥🔥"', en: 'BTMOB 4.0 FULL SRC delivery (912 MB) · "Thanks for the trust 🔥🔥🔥"' },
  "pw.caption.support": { pt: '"Se eu for precisando de suporte só acionar né?" · "sim claro" — suporte pós-venda ativo.', en: '"If I need support just call, right?" · "yes sure" — active after-sales support.' },
  "pw.caption.activation": { pt: '"criar seu login e ja era" · "ja ta tudo pronto" — ativação instantânea confirmada pelo cliente.', en: '"create your login and that\'s it" · "everything is ready" — instant activation confirmed by customer.' },
  "pw.tag.operation": { pt: "Operação real", en: "Real operation" },
  "pw.tag.payment": { pt: "Pagamento + entrega", en: "Payment + delivery" },
  "pw.tag.recurring": { pt: "Cliente recorrente", en: "Recurring customer" },
  "pw.tag.autorenew": { pt: "Renovação automática", en: "Auto renewal" },
  "pw.tag.sourcecode": { pt: "Código-fonte entregue", en: "Source code delivered" },
  "pw.tag.support": { pt: "Suporte contínuo", en: "Continuous support" },
  "pw.tag.activation": { pt: "Ativação em minutos", en: "Activation in minutes" },
  "pw.source.wa": { pt: "WhatsApp · conversa", en: "WhatsApp · chat" },
  "pw.source.mp": { pt: "Mercado Pago · comprovante", en: "Mercado Pago · receipt" },
  "pw.source.panel": { pt: "Painel Shadow · log", en: "Shadow Panel · log" },
  "pw.source.tg": { pt: "Telegram · atendimento", en: "Telegram · support" },

  // ===== Components / Testimonials =====
  "test.kicker": { pt: "// depoimentos", en: "// testimonials" },
  "test.title": { pt: "O que dizem sobre a Shadow", en: "What they say about Shadow" },
  "test.desc": { pt: "Operadores ativos compartilham suas experiências de campo.", en: "Active operators share their field experiences." },
  "test.reviews": { pt: "avaliações", en: "reviews" },
  "test.footer.1": { pt: "Pagamento aprovado instantaneamente", en: "Payment approved instantly" },
  "test.footer.2": { pt: "Suporte técnico 24/7", en: "24/7 technical support" },
  "test.footer.3": { pt: "Privacidade absoluta", en: "Absolute privacy" },
  "test.txt.rafael": { pt: "Comprei às 2h da manhã, em 40 segundos o login já tava no painel. Nunca vi entrega tão rápida em ferramenta desse nível.", en: "I bought at 2am, in 40 seconds the login was already in the dashboard. Never seen such fast delivery for a tool of this level." },
  "test.txt.juliana": { pt: "Já usei outras duas concorrentes e caía Play Protect no meio da op. Aqui não caiu uma vez em 3 meses. Suporte responde em minutos.", en: "I've used two other competitors and Play Protect would drop mid-op. Here it hasn't dropped once in 3 months. Support replies in minutes." },
  "test.txt.diego": { pt: "Migrei do 4.5.7 pro vitalício 4.6 e o upgrade foi automático mesmo. Não precisei falar com ninguém. Cashback do BTMOB40 caiu direitinho.", en: "I migrated from 4.5.7 to lifetime 4.6 and the upgrade was really automatic. I didn't have to talk to anyone. BTMOB40 cashback worked perfectly." },
  "test.txt.bruno": { pt: "Peguei o pacote completo com fonte. Sessão de handoff bem técnica, engenheiro documentou tudo. Vale cada centavo.", en: "I got the full package with source code. Very technical handoff session, engineer documented everything. Worth every penny." },
  "test.txt.carla": { pt: "Tava com medo de PIX pra ferramenta paga assim, mas o comprovante do Mercado Pago veio na hora. Segurança total.", en: "I was afraid of doing a PIX for a paid tool like this, but the Mercado Pago receipt came instantly. Total security." },
  "test.txt.vinicius": { pt: "3 updates gratuitos em 2 meses, cada um trazendo módulo novo. A promessa de 'updates for life' é real.", en: "3 free updates in 2 months, each bringing a new module. The 'updates for life' promise is real." },

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
  "contact.chat.title": { pt: "Central de atendimento", en: "Support center" },
  "contact.chat.desc": {
    pt: "Disponível dentro do painel após login.",
    en: "Available inside the dashboard after signing in.",
  },
  "contact.chat.cta": { pt: "Acessar painel", en: "Open dashboard" },
};

export type LangMode = Lang | "system";

type Ctx = {
  lang: Lang;
  mode: LangMode;
  setLang: (l: LangMode) => void;
  t: (k: keyof typeof DICT) => string;
};

const I18nContext = createContext<Ctx>({
  lang: "pt",
  mode: "system",
  setLang: () => {},
  t: (k) => DICT[k]?.pt ?? String(k),
});

function systemLang(): Lang {
  if (typeof navigator === "undefined") return "pt";
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  const first = (langs[0] || "pt").toLowerCase();
  return first.startsWith("pt") ? "pt" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<LangMode>("system");
  const [lang, setLangState] = useState<Lang>("pt");

  // Preferência salva (ou idioma do sistema/navegador) após a hidratação
  useEffect(() => {
    let saved: LangMode | null = null;
    try {
      saved = localStorage.getItem("shadow.lang") as LangMode | null;
    } catch {
      /* storage bloqueado */
    }
    const next: LangMode = saved === "pt" || saved === "en" || saved === "system" ? saved : "system";
    setMode(next);
    setLangState(next === "system" ? systemLang() : next);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
  }, [lang]);

  const setLang = (l: LangMode) => {
    setMode(l);
    setLangState(l === "system" ? systemLang() : l);
    try {
      localStorage.setItem("shadow.lang", l);
    } catch {
      /* storage bloqueado */
    }
  };

  const t = (k: keyof typeof DICT) => DICT[k]?.[lang] ?? String(k);
  return <I18nContext.Provider value={{ lang, mode, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { mode, setLang } = useI18n();
  const btn = (value: LangMode, label: string) => (
    <button
      type="button"
      onClick={() => setLang(value)}
      className={`px-2 py-1 transition-colors ${
        mode === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
      }`}
      aria-pressed={mode === value}
      title={value === "system" ? "Usar o idioma do sistema" : label}
    >
      {label}
    </button>
  );
  return (
    <div className={`inline-flex items-center rounded-none border border-border font-mono text-[10px] uppercase tracking-[0.2em] ${className}`}>
      {btn("system", "Auto")}
      {btn("pt", "PT")}
      {btn("en", "EN")}
    </div>
  );
}
