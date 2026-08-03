import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getAuditLogs = createServerFn({ method: "GET" })
  .handler(async () => {
    // In a real scenario, we'd fetch from a logs table. 
    // For now, we'll return structured mock data representing system decisions for the current user.
    return [
      {
        id: "1",
        event: "VALIDATION_CHECK",
        decision: "APPROVED",
        reason: "Active license v4.6 detected in history.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
        system: "Shadow Auth Guard"
      },
      {
        id: "2",
        event: "INFRA_PROVISIONING",
        decision: "SUCCESS",
        reason: "VPS slot allocated on Cluster-02.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.9).toISOString(),
        system: "Panel Router"
      },
      {
        id: "3",
        event: "LEGACY_CLAIM",
        decision: "PENDING",
        reason: "Waiting for manual validation of payment proof.",
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30m ago
        system: "Billing Controller"
      }
    ];
  });
