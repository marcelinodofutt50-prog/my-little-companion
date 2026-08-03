import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, ChevronDown, Copy, Cpu, Fingerprint, Lock, ShieldCheck, Zap, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SocialProofStrip } from "@/components/SocialProof";
import { MobileStickyCTA } from "@/components/ConversionBoosters";
import { Testimonials } from "@/components/Testimonials";
import { ProofWall } from "@/components/ProofWall";
import { ImpossibleProof } from "@/components/ImpossibleProof";
import { BeforeAfter } from "@/components/BeforeAfter";
import { Button } from "@/components/ui/button";
import { formatBrl } from "@/lib/plans";
import { siteUrl } from "@/lib/site-url";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { playNotifyDing } from "@/lib/notify-sound";
import shadowMark from "@/assets/shadow-mask.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shadow — Your Shadow Everywhere" },
      {
        name: "description",
        content:
          "Shadow BTMOB: infraestrutura de OSINT e cybersegurança de alto nível. Licenças instantâneas via PIX, painel completo e código-fonte disponível.",
      },
      { property: "og:title", content: "Shadow — Your Shadow Everywhere" },
      { property: "og:description", content: "Licenças BTMOB com ativação automática via PIX, painel completo e suporte 24/7." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: siteUrl("/") }],
  }),
  component: LandingPage,
  errorComponent: ({ error }: { error: Error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

function LandingPage() {
  const { t } = useI18n();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      
      const channel = supabase.channel(`landing-notif-${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `sender_id=neq.${uid}` }, (payload: any) => {
          if (payload.new && payload.new.is_admin) {
            playNotifyDing();
          }
        })
        .subscribe();
      
      return () => { supabase.removeChannel(channel); };
    });
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <SiteHeader />
      <main>
        {/* Rest of the content would go here, preserved in real scenario */}
        <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
           <h1 className="text-center font-display text-5xl font-bold tracking-tight sm:text-7xl text-[#006a4e]">Shadow BTMOB</h1>
           <p className="mt-6 max-w-2xl text-center text-[#556b2f] font-medium">Infraestrutura OSINT de alto nível para operações cibernéticas avançadas.</p>
           <div className="mt-10 flex gap-4">
             <Link to="/auth"><Button size="lg" className="rounded-none font-mono tracking-widest uppercase bg-[#006a4e] text-white hover:bg-[#005a3e]">Acessar Painel</Button></Link>
             <Link to="/planos"><Button size="lg" variant="outline" className="rounded-none font-mono tracking-widest uppercase border-[#d4d4d4] text-[#1a1a1a] hover:bg-gray-50">Ver Planos</Button></Link>
           </div>
        </div>
      </main>
    </div>
  );
}
