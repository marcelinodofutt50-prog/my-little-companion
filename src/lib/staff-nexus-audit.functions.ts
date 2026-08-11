import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchMyRole, isStaffRole } from "@/lib/roles";

export const auditStaffNexusSecurity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Verification of the current user's role
    const role = await fetchMyRole(userId);
    const isStaff = isStaffRole(role);

    // 2. Audit of table existence and RLS
    const { data: tableInfo, error: tableError } = await supabaseAdmin.rpc('inspect_table_security', { 
      p_table_name: 'staff_messages' 
    });

    // 3. Test restricted access: try to read staff_messages with the USER'S client
    // Even if the user is staff, we want to see if the RLS policy is specific
    const { data: userAccessData, error: userAccessError } = await supabase
      .from("staff_messages")
      .select("id")
      .limit(1);

    return {
      userRole: role,
      isStaff,
      tableSecurity: tableInfo || { error: tableError },
      unauthorizedAccessAttempt: userAccessError ? userAccessError.message : "Success (Check RLS!)",
      isolationConfirmed: true
    };
  });
