import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { trackSchemaFailure } from "./tutorials.functions";

export const getLoyaltyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Tática de túnel administrativo para resiliência contra PGRST108
    const fetchLoyalty = async (client: any) => client
      .from("user_loyalty")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    let { data: loyalty, error: loyaltyErr } = await fetchLoyalty(supabase);

    if (loyaltyErr && (loyaltyErr.code === 'PGRST108' || loyaltyErr.message?.includes('schema cache'))) {
      await trackSchemaFailure(loyaltyErr, "getLoyaltyDashboard", false, { stage: "user_loyalty" }, userId);
      const adminResult = await fetchLoyalty(supabaseAdmin);
      loyalty = adminResult.data;
      if (!adminResult.error) await trackSchemaFailure(loyaltyErr, "getLoyaltyDashboard", true, { stage: "user_loyalty_retry" }, userId);
    }

    // 2. Get Configs
    const fetchTiers = async (client: any) => client
      .from("loyalty_tier_config")
      .select("*")
      .order("priority", { ascending: true });

    let { data: tiers, error: tiersErr } = await fetchTiers(supabase);
    if (tiersErr && (tiersErr.code === 'PGRST108' || tiersErr.message?.includes('schema cache'))) {
      const adminResult = await fetchTiers(supabaseAdmin);
      tiers = adminResult.data;
    }

    const fetchMissions = async (client: any) => client
      .from("loyalty_missions")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    let { data: missions, error: missErr } = await fetchMissions(supabase);
    if (missErr && (missErr.code === 'PGRST108' || missErr.message?.includes('schema cache'))) {
      const adminResult = await fetchMissions(supabaseAdmin);
      missions = adminResult.data;
    }

    // 3. Get User Stats
    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at, conversions_count")
      .eq("id", userId)
      .maybeSingle();

    const tierList = (tiers || []) as any[];
    const currentTier = tierList.find(t => t.tier === (loyalty?.current_tier || 'starter'));
    const nextTier = tierList.find(t => t.priority === (currentTier?.priority ?? -1) + 1);

    // 4. History and Rewards
    const fetchHistory = async (client: any) => client
      .from("loyalty_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    let { data: history, error: histErr } = await fetchHistory(supabase);
    if (histErr && (histErr.code === 'PGRST108' || histErr.message?.includes('schema cache'))) {
      const adminResult = await fetchHistory(supabaseAdmin);
      history = adminResult.data;
    }

    const fetchRewards = async (client: any) => client
      .from("user_rewards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    let { data: rewards, error: rewErr } = await fetchRewards(supabase);
    if (rewErr && (rewErr.code === 'PGRST108' || rewErr.message?.includes('schema cache'))) {
      const adminResult = await fetchRewards(supabaseAdmin);
      rewards = adminResult.data;
    }

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
    
    // Check if already completed to prevent duplicate clicks
    const { data: existing } = await (supabase
      .from("loyalty_history" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("action_type", "mission_complete")
      .eq("reference_id", data.missionId)
      .maybeSingle() as any);

    if (existing) {
      return { ok: false, message: "Missão já concluída anteriormente." };
    }

    // Adicionando proteção contra spam e limites semanais táticos
    const { data: recent } = await (supabase
      .from("loyalty_history" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("reference_id", data.missionId)
      .gt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) as any);

    if ((recent?.length || 0) >= 3) {
      return { ok: false, message: "Limite semanal de 3 recompensas atingido para esta missão." };
    }

    const { data: res, error } = await (supabase.rpc as any)('complete_loyalty_mission', {
      _mission_id: data.missionId
    });

    if (error) {
      console.error("[Loyalty] RPC Error:", error);
      throw new Error(error.message);
    }
    
    const result = res as unknown as { ok: boolean; message?: string; points_earned?: number };
    
    return result;
  });

export const getVipBenefits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await (supabase
      .from("vip_configs" as any)
      .select("*")
      .order("min_loyalty_points", { ascending: true }) as any);
    return data || [];
  });

export const getSystemStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Buscar logs de falha recentes (PGRST108)
    const { data: logs } = await supabaseAdmin
      .from("integration_logs")
      .select("*")
      .eq("action", "pgrst108_sync_error")
      .order("created_at", { ascending: false })
      .limit(5);

    // Calcular taxa de falhas (mock-up baseado em logs reais se disponíveis ou heurística)
    const { count: totalLogs } = await supabaseAdmin
      .from("integration_logs")
      .select("*", { count: 'exact', head: true });
    
    const { count: failLogs } = await supabaseAdmin
      .from("integration_logs")
      .select("*", { count: 'exact', head: true })
      .eq("outcome", "failure");

    // Verificar conexão atual
    const startTime = Date.now();
    const { error: connError } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
    const latency = Date.now() - startTime;

    return {
      connection: {
        status: connError ? 'unstable' : 'healthy',
        latency: `${latency}ms`,
        lastChecked: new Date().toISOString()
      },
      postgrest: {
        failureRate: totalLogs ? `${Math.round(((failLogs || 0) / (totalLogs || 1)) * 100)}%` : '0%',
        lastRepair: logs?.[0]?.created_at || null,
        totalRepairs: totalLogs || 0
      },
      recentIncidents: (logs || []).map((l: any) => ({
        id: l.id,
        time: l.created_at,
        context: l.context?.location || 'unknown',
        recovered: l.outcome === 'recovered'
      }))
    };
  });
