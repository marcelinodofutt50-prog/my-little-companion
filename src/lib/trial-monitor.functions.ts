import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const adminListTrialStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pegamos os trials recentes (provisionados)
    const { data: trials, error: trialsErr } = await supabaseAdmin
      .from("trials")
      .select(`
        id,
        created_at,
        user_id,
        license_id,
        profiles!inner (
          email
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    // Pegamos os blocos antifraude (falhas de validação)
    const { data: blocks, error: blocksErr } = await supabaseAdmin
      .from("trial_blocks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (trialsErr) console.error("Error fetching trials:", trialsErr);
    if (blocksErr) console.error("Error fetching blocks:", blocksErr);

    return {
      trials: trials || [],
      blocks: blocks || []
    };
  });
