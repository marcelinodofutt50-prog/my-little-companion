import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Trophy, ArrowRight, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

export function PromotionsWidget() {
  const { data: promotions, isLoading } = useQuery({
    queryKey: ['active-promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('promo_type', 'community_goal')
        .eq('active', true)
        .order('priority', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  if (isLoading || !promotions) return null;

  const progress = Math.min(100, (promotions.goal_current_value / promotions.goal_target_value) * 100);
  const remaining = promotions.goal_target_value - promotions.goal_current_value;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="enterprise-surface p-4 relative overflow-hidden group bg-primary/5 border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.05)]"
    >
      <div className="absolute top-0 right-0 p-2 opacity-10">
        <Zap className="h-12 w-12 text-primary" />
      </div>

      <div className="space-y-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Meta da Comunidade</span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">{promotions.goal_current_value} / {promotions.goal_target_value}</span>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase mb-1">{promotions.name}</h4>
          <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1">{promotions.description}</p>
        </div>

        <div className="space-y-1.5">
          <Progress value={progress} className="h-1.5 bg-primary/10" />
          <p className="text-[9px] font-mono uppercase text-primary/80">
            {remaining > 0 ? `Faltam ${remaining} membros para o desbloqueio!` : '🎯 META ALCANÇADA! PROMOÇÃO ATIVA.'}
          </p>
        </div>

        <Link 
          to="/planos" 
          className="flex items-center gap-1.5 text-[9px] font-mono uppercase text-primary hover:gap-2 transition-all pt-1"
        >
          Ver Benefícios <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  );
}
