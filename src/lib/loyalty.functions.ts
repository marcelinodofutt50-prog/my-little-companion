import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAvailableMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Get all active missions
    const { data: missions, error: missionsError } = await supabaseAdmin
      .from("loyalty_missions")
      .select("*")
      .eq("status", "active");

    if (missionsError) throw missionsError;

    // 2. Get user's progress/completion for these missions
    const { data: userMissions, error: userMissionsError } = await supabaseAdmin
      .from("user_missions")
      .select("*")
      .eq("user_id", userId);

    if (userMissionsError) throw userMissionsError;

    return (missions || []).map(mission => {
      const userProgress = (userMissions || []).find(um => um.mission_id === mission.id);
      return {
        ...mission,
        progress: userProgress?.progress || 0,
        completed_at: userProgress?.completed_at || null,
        metadata: userProgress?.metadata || {}
      };
    });
  });

export const completeMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { missionId: string }) => z.object({ missionId: z.string().uuid() }).parse(data))
  .handler(async ({ data: input, context }) => {
    const { missionId } = input;
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch mission details
    const { data: mission, error: missionError } = await supabaseAdmin
      .from("loyalty_missions")
      .select("*")
      .eq("id", missionId)
      .maybeSingle();

    if (missionError || !mission) throw new Error("Mission not found");

    // 2. Check if already completed or reached limit
    const { data: userMission, error: umError } = await supabaseAdmin
      .from("user_missions")
      .select("*")
      .eq("user_id", userId)
      .eq("mission_id", missionId)
      .maybeSingle();

    if (userMission?.completed_at && (mission.limit_count || 1) <= 1) {
      throw new Error("Missão já concluída.");
    }

    // 3. Award points (Server-side validation of actual logic would go here)
    // For this generic function, we'll mark it as completed.
    // In a real scenario, specific missions would have specific validation handlers.
    
    const { error: completeError } = await supabaseAdmin
      .from("user_missions")
      .upsert({
        user_id: userId,
        mission_id: missionId,
        completed_at: new Date().toISOString(),
        progress: 100
      });

    if (completeError) throw completeError;

    // 4. Update profile points
    const { data: profile } = await supabaseAdmin.from("profiles").select("reward_points, total_points_earned").eq("id", userId).single();
    
    await supabaseAdmin.from("profiles").update({
      reward_points: (profile?.reward_points || 0) + mission.reward_points,
      total_points_earned: (profile?.total_points_earned || 0) + mission.reward_points
    }).eq("id", userId);

    // 5. Log history
    await supabaseAdmin.from("points_history").insert({
      user_id: userId,
      amount: mission.reward_points,
      reason: `Missão concluída: ${mission.title}`,
      metadata: { mission_id: missionId }
    });

    return { success: true, reward: mission.reward_points };
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
