import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTutorialProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabase, userId } = context;

    const { data, error } = await supabase
      .from("tutorial_progress")
      .select("tutorial_id")
      .eq("user_id", userId);

    if (error) {
      console.error("[tutorial_progress] Fetch error:", error);
      const isSchemaError = error.message?.includes("schema cache") || 
                           error.message?.includes("does not exist") ||
                           error.code === 'PGRST108' ||
                           error.code === '42P01';
      
      if (isSchemaError) {
        const wrapped = new Error(error.message);
        (wrapped as any)._schemaError = "public.tutorial_progress";
        throw wrapped;
      }
      throw new Error(error.message);
    }
    return (data ?? []).map((p: any) => p.tutorial_id);
  });

export const toggleTutorialStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tutorialId: z.string(), completed: z.boolean() }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.completed) {
      const { error } = await supabase
        .from("tutorial_progress")
        .upsert({ user_id: userId, tutorial_id: data.tutorialId });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("tutorial_progress")
        .delete()
        .eq("user_id", userId)
        .eq("tutorial_id", data.tutorialId);
      if (error) throw new Error(error.message);
    }

    return { success: true };
  });
