// Shadow Protocol v24.0: BUSINESS LOGIC CORRECTION - TRIAL 1 DAY.
// Status: PRODUCTION DEPLOY (Target: dvnksmqbpbzwgwmbnjjy).
// Certification Level: PROD-READY v24.0.
//
// Correção importante na regra comercial:
// O Trial não é de 7 dias.
// TRIAL CORRETO: 1 DIA
// Quem comprar um login mensal ou vitalício recebe automaticamente 1 dia de acesso ao benefício do Play Protect/análise de APK, conforme a elegibilidade definida no sistema.
// Depois de 24 horas: o benefício expira automaticamente; o acesso deve ser bloqueado; para continuar utilizando o serviço, o usuário precisa realizar o pagamento correspondente.
// Regras obrigatórias: started_at deve registrar o início; expires_at deve ser started_at + 24 horas; a validação deve ser feita no servidor; não confiar no relógio do navegador; não permitir reiniciar o benefício criando novas sessões; não permitir múltiplos trials para a mesma conta/compra; registrar o histórico da utilização; mostrar claramente no Shadow Pass quanto tempo resta.
// IMPORTANTE: Não confunda o Trial de 1 dia com o sistema de níveis VIP. O VIP continua sendo conquistado através de pontos e missões e permanece independente do Trial.
// Atualize também qualquer referência no banco, backend, frontend, textos, testes e documentação que ainda esteja dizendo trial_7d, 7 dias ou 7-day trial.
// Depois valide na Vercel Production que: Compra elegível → Trial de 24h ativado → acesso liberado → 24h completas → acesso expirado.
// Não altere outras funcionalidades que já estejam funcionando.

import { SiteHeader } from "@/components/SiteHeader";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import { siteUrl } from "@/lib/site-url";
import { useEffect, useState } from "react";
import { useSearch, createFileRoute, Link } from "@tanstack/react-router";
import { useThemeSearchParam } from "@/hooks/use-theme-param";
import { toast } from "sonner";
import { SocialProofStrip } from "@/components/SocialProof";
import { MobileStickyCTA } from "@/components/ConversionBoosters";
import { Testimonials } from "@/components/Testimonials";
import { ProofWall } from "@/components/ProofWall";
import { ImpossibleProof } from "@/components/ImpossibleProof";
import { BeforeAfter } from "@/components/BeforeAfter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBrl } from "@/lib/plans";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { playNotifyDing } from "@/lib/notify-sound";
import { motion } from "framer-motion";
import { 
  Shield, 
  Zap, 
  Lock, 
  Globe, 
  ShieldCheck, 
  Server, 
  Rocket, 
  ArrowRight, 
  CheckCircle2, 
  Store, 
  Users, 
  Gift 
} from "lucide-react";
// ... (rest of the imports remain the same)
