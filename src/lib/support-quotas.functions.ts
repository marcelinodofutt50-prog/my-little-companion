import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface QuotaInfo {
  unlimited: boolean;
  daily: { limit: number; used: number; remaining: number };
  monthly: { limit: number; used: number; remaining: number };
}

export interface SupportStaffQuota extends QuotaInfo {
  userId: string;
  email?: string;
}

export const getMyQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    
    // Check if admin (unlimited)
    const { data: roleData } = await supabase.rpc('has_role' as any, { _user_id: userId, _role: 'admin' });
    if (roleData) return { unlimited: true } as QuotaInfo;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [quotaRes, dailyCountRes, monthlyCountRes] = await Promise.all([
      (supabase.from('support_quotas' as any).select('daily_limit, monthly_limit') as any).eq('user_id', userId).maybeSingle(),
      (supabase.from('license_generation_logs' as any).select('id', { count: 'exact', head: true }) as any).eq('staff_id', userId).gte('created_at', today.toISOString()),
      (supabase.from('license_generation_logs' as any).select('id', { count: 'exact', head: true }) as any).eq('staff_id', userId).gte('created_at', firstOfMonth.toISOString()),
    ]);

    const dailyLimit = (quotaRes.data as any)?.daily_limit ?? 5;
    const monthlyLimit = (quotaRes.data as any)?.monthly_limit ?? 30;
    const dailyUsed = dailyCountRes.count ?? 0;
    const monthlyUsed = monthlyCountRes.count ?? 0;

    return {
      unlimited: false,
      daily: { limit: dailyLimit, used: dailyUsed, remaining: Math.max(0, dailyLimit - dailyUsed) },
      monthly: { limit: monthlyLimit, used: monthlyUsed, remaining: Math.max(0, monthlyLimit - monthlyUsed) }
    } as QuotaInfo;
  });

export const updateSupportQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    targetUserId: z.string().uuid(),
    dailyLimit: z.number().int().min(0).max(100),
    monthlyLimit: z.number().int().min(0).max(1000),
  }))
  .handler(async ({ data, context }) => {
    const { assertAdminRole } = await import("@/lib/roles.server");
    await assertAdminRole(context);

    const { error } = await context.supabase
      .from('support_quotas' as any)
      .upsert({ 
        user_id: data.targetUserId, 
        daily_limit: data.dailyLimit, 
        monthly_limit: data.monthlyLimit,
        updated_at: new Date().toISOString()
      } as any, { onConflict: 'user_id' });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSupportQuotas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdminRole } = await import("@/lib/roles.server");
    await assertAdminRole(context);
    const { supabase } = context;

    const { data: staffRoles } = await supabase
      .from('user_roles' as any)
      .select('user_id')
      .eq('role', 'moderator');
    
    if (!staffRoles || staffRoles.length === 0) return [];

    const staffIds = staffRoles.map((r: any) => r.user_id);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', staffIds);

    const emailMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [quotasRes, logsRes] = await Promise.all([
      supabase.from('support_quotas' as any).select('*').in('user_id', staffIds),
      supabase.from('license_generation_logs' as any).select('staff_id, created_at').in('staff_id', staffIds).gte('created_at', firstOfMonth.toISOString())
    ]);

    const quotas = quotasRes.data || [];
    const logs = logsRes.data || [];

    return staffIds.map(id => {
      const q = quotas.find((x: any) => x.user_id === id);
      const staffLogs = logs.filter((l: any) => l.staff_id === id);
      const dailyUsed = staffLogs.filter((l: any) => new Date(l.created_at) >= today).length;
      const monthlyUsed = staffLogs.length;
      
      const dailyLimit = (q as any)?.daily_limit ?? 5;
      const monthlyLimit = (q as any)?.monthly_limit ?? 30;

      return {
        userId: id,
        email: emailMap.get(id),
        unlimited: false,
        daily: { limit: dailyLimit, used: dailyUsed, remaining: Math.max(0, dailyLimit - dailyUsed) },
        monthly: { limit: monthlyLimit, used: monthlyUsed, remaining: Math.max(0, monthlyLimit - monthlyUsed) }
      } as SupportStaffQuota;
    });
  });
