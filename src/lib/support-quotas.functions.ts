import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    
    // Check if admin (unlimited)
    const { data: roleData } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (roleData) return { unlimited: true };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [quotaRes, dailyCountRes, monthlyCountRes] = await Promise.all([
      supabase.from('support_quotas').select('daily_limit, monthly_limit').eq('user_id', userId).maybeSingle(),
      supabase.from('license_generation_logs').select('id', { count: 'exact', head: true }).eq('staff_id', userId).gte('created_at', today.toISOString()),
      supabase.from('license_generation_logs').select('id', { count: 'exact', head: true }).eq('staff_id', userId).gte('created_at', firstOfMonth.toISOString()),
    ]);

    const dailyLimit = quotaRes.data?.daily_limit ?? 5;
    const monthlyLimit = quotaRes.data?.monthly_limit ?? 30;
    const dailyUsed = dailyCountRes.count ?? 0;
    const monthlyUsed = monthlyCountRes.count ?? 0;

    return {
      unlimited: false,
      daily: { limit: dailyLimit, used: dailyUsed, remaining: Math.max(0, dailyLimit - dailyUsed) },
      monthly: { limit: monthlyLimit, used: monthlyUsed, remaining: Math.max(0, monthlyLimit - monthlyUsed) }
    };
  });

export const updateSupportQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    targetUserId: z.string().uuid(),
    dailyLimit: z.number().int().min(0).max(100),
    monthlyLimit: z.number().int().min(0).max(1000),
  }))
  .handler(async ({ data, context }) => {
    const { assertAdminRole } = await import("@/lib/roles.server");
    await assertAdminRole(context);

    const { error } = await context.supabase
      .from('support_quotas')
      .upsert({ 
        user_id: data.targetUserId, 
        daily_limit: data.dailyLimit, 
        monthly_limit: data.monthlyLimit,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) throw new Error(error.message);
    return { ok: true };
  });
