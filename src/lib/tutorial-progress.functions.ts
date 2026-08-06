import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getTutorialProgress = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
      .from("tutorial_progress")
      .select("tutorial_id")
      .eq("user_id", session.user.id);

    if (error) throw error;
    return data.map(p => p.tutorial_id);
  });

export const toggleTutorialStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ tutorialId: z.string(), completed: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Unauthorized");

    if (data.completed) {
      const { error } = await supabase
        .from("tutorial_progress")
        .upsert({ user_id: session.user.id, tutorial_id: data.tutorialId });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("tutorial_progress")
        .delete()
        .eq("user_id", session.user.id)
        .eq("tutorial_id", data.tutorialId);
      if (error) throw error;
    }

    return { success: true };
  });
