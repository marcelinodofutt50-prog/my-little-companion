import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getLoyaltyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Get Loyalty Info
    const { data: loyalty } = await (supabaseAdmin
      .from("user_loyalty")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle());

    // 2. Get Tiers
    const { data: tiers } = await (supabaseAdmin
      .from("loyalty_tier_config")
      .select("*")
      .order("priority", { ascending: true }));

    const currentTier = (tiers || []).find(t => t.tier === (loyalty?.current_tier || 'starter'));
    const nextTier = (tiers || []).find(t => t.priority === (currentTier?.priority ?? -1) + 1);

    // 3. Get Missions (with progress)
    const { data: missions } = await supabaseAdmin
      .from("loyalty_missions")
      .select("*")
      .eq("status", "active");

    const { data: userMissions } = await supabaseAdmin
      .from("user_missions")
      .select("*")
      .eq("user_id", userId);

    const missionsWithProgress = (missions || []).map(m => {
      const um = (userMissions || []).find(u => u.mission_id === m.id);
      return { ...m, ...um };
    });

    // 4. Get History
    const { data: history } = await supabaseAdmin
      .from("points_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    // 5. Profile info for metadata
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("created_at, conversions_count")
      .eq("id", userId)
      .single();

    return {
      loyalty: loyalty || { points: 0, days_active: 0 },
      currentTier,
      nextTier,
      missions: missionsWithProgress,
      history: (history || []).map(h => ({ ...h, description: h.reason })),
      rewards: [],
      profile: profile || { created_at: new Date().toISOString(), conversions_count: 0 }
    };
  });

export const claimMissionReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { missionId: string }) => z.object({ missionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { missionId } = data;
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      // 1. Fetch mission
      const { data: mission } = await supabaseAdmin
        .from("loyalty_missions")
        .select("*")
        .eq("id", missionId)
        .single();

      if (!mission) return { ok: false, message: "Missão não encontrada." };

      // 2. Check if already claimed
      const { data: existing } = await supabaseAdmin
        .from("user_missions")
        .select("*")
        .eq("user_id", userId)
        .eq("mission_id", missionId)
        .maybeSingle();

      if (existing?.completed_at && (mission.limit_count || 1) <= 1) {
        return { ok: false, message: "Recompensa já resgatada." };
      }

      // 3. Award points & update profile
      const { data: profile } = await supabaseAdmin.from("profiles").select("reward_points, total_points_earned").eq("id", userId).single();
      
      await supabaseAdmin.from("profiles").update({
        reward_points: (profile?.reward_points || 0) + mission.reward_points,
        total_points_earned: (profile?.total_points_earned || 0) + mission.reward_points
      }).eq("id", userId);

      // 4. Mark mission as completed
      await supabaseAdmin.from("user_missions").upsert({
        user_id: userId,
        mission_id: missionId,
        completed_at: new Date().toISOString(),
        progress: 100
      });

      // 5. History log
      await supabaseAdmin.from("points_history").insert({
        user_id: userId,
        amount: mission.reward_points,
        reason: `Recompensa: ${mission.title}`,
        metadata: { mission_id: missionId, type: 'mission_complete' }
      });

      return { ok: true, message: `+${mission.reward_points} pontos resgatados!` };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  });

export const getSystemStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    // Mock status for diagnostics widget
    return {
      connection: { status: 'healthy', latency: '42ms' },
      postgrest: { failureRate: '0.2%', totalRepairs: 12, lastRepair: new Date().toISOString() },
      recentIncidents: []
    };
  });

export const getPointsHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("points_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  });
