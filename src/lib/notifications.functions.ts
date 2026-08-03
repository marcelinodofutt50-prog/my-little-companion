import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export type NotificationKind = 'support' | 'renewal' | 'refund' | 'suspended' | 'order' | 'migration' | 'license' | 'info';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  createdAt: string;
  href?: string;
  actionLabel?: string;
}

export const listMyNotifications = createServerFn({ method: "GET" })
  .handler(async () => {
    // Mock for now to satisfy InAppNotifications component
    return {
      isAdmin: false,
      items: [] as AppNotification[]
    };
  });

export const getNotificationSettings = createServerFn({ method: "GET" })
  .handler(async () => {
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
    return { success: true };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .inputValidator((d: any) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    return { success: true };
  });
