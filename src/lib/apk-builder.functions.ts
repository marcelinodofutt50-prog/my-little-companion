import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getMyBuildJobs = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await supabase
      .from("apk_build_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  });

export const createBuildJob = createServerFn({ method: "POST" })
  .input(z.object({
    appName: z.string().min(1),
    originalApkUrl: z.string().url(),
    originalIconUrl: z.string().url().optional(),
  }))
  .handler(async ({ data }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: job, error } = await supabase
      .from("apk_build_jobs")
      .insert({
        user_id: user.id,
        app_name: data.appName,
        original_apk_url: data.originalApkUrl,
        original_icon_url: data.originalIconUrl || null,
        status: "pending",
        progress: 0
      })
      .select()
      .single();

    if (error) throw error;
    return job;
  });
