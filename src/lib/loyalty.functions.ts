import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getLoyaltyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Get Loyalty State
    const { data: loyalty } = await supabase
      .from("user_loyalty" as any)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // 2. Get Configs
    const { data: tiers } = await supabase
      .from("loyalty_tier_config" as any)
      .select("*")
      .order("priority", { ascending: true });

    const { data: missions } = await supabase
      .from("loyalty_missions" as any)
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    // 3. Get User Stats (Time as customer from profiles)
    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at, conversions_count")
      .eq("id", userId)
      .maybeSingle();

    const currentTier = tiers?.find(t => t.tier === (loyalty?.current_tier || 'starter'));
    const nextTier = tiers?.find(t => t.priority === (currentTier?.priority ?? -1) + 1);

    // 4. History and Rewards
    const { data: history } = await supabase
      .from("loyalty_history" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: rewards } = await supabase
      .from("user_rewards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    return {
      loyalty: loyalty || { points: 0, current_tier: 'starter', days_active: 0 },
      currentTier,
      nextTier,
      tiers: tiers || [],
      missions: missions || [],
      history: history || [],
      rewards: rewards || [],
      profile: profile || { created_at: new Date().toISOString() }
    };
  });

export const claimMissionReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ missionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // This would typically involve complex backend validation
    // For now, we stub the logic that would be handled by a secure RPC/Trigger
    return { success: false, message: "Validação pendente pelo processador Shadow." };
  });
