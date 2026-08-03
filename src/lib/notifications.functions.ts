import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getNotificationSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    // In a real app, fetch from a user_preferences table
    return {
      email_enabled: true,
      webhook_enabled: false,
      webhook_url: "",
      notify_on_approval: true,
      notify_on_pending: true,
      notify_on_denial: true
    };
  });

export const updateNotificationSettings = createServerFn({ method: "POST" })
  .inputValidator((d: any) => z.object({
    email_enabled: z.boolean(),
    webhook_enabled: z.boolean(),
    webhook_url: z.string().url().optional().or(z.literal("")),
    notify_on_approval: z.boolean(),
    notify_on_pending: z.boolean(),
    notify_on_denial: z.boolean()
  }).parse(d))
  .handler(async ({ data }) => {
    // Update logic would go here
    return { success: true };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .inputValidator((d: any) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    // Send a mock notification
    return { success: true };
  });
