import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getLoyaltyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Get Loyalty State (Cast to any to bypass temporary schema cache mismatch)
    const { data: loyalty } = await (supabase
      .from("user_loyalty" as any)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle() as any);

    // 2. Get Configs
    const { data: tiers } = await (supabase
      .from("loyalty_tier_config" as any)
      .select("*")
      .order("priority", { ascending: true }) as any);

    const { data: missions } = await (supabase
      .from("loyalty_missions" as any)
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false }) as any);

    // 3. Get User Stats (Time as customer from profiles)
    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at, conversions_count")
      .eq("id", userId)
      .maybeSingle();

    const tierList = (tiers || []) as any[];
    const currentTier = tierList.find(t => t.tier === (loyalty?.current_tier || 'starter'));
    const nextTier = tierList.find(t => t.priority === (currentTier?.priority ?? -1) + 1);

    // 4. History and Rewards
    const { data: history } = await (supabase
      .from("loyalty_history" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20) as any);

    const { data: rewards } = await (supabase
      .from("user_rewards" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }) as any);

    return {
      loyalty: loyalty || { points: 0, current_tier: 'starter', days_active: 0 },
      currentTier,
      nextTier,
      tiers: tierList,
      missions: (missions || []) as any[],
      history: (history || []) as any[],
      rewards: (rewards || []) as any[],
      profile: profile || { created_at: new Date().toISOString(), conversions_count: 0 }
    };
  });

export const claimMissionReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ missionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Call the database function (cast rpc name to any because it's new)
    const { data: res, error } = await (supabase.rpc as any)('complete_loyalty_mission', {
      _user_id: userId,
      _mission_id: data.missionId
    });

    if (error) throw new Error(error.message);
    const result = res as unknown as { ok: boolean; message?: string; points_earned?: number };
    
    return result;
  });
