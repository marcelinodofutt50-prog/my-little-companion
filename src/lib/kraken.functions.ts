import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { trackSchemaFailure } from "./tutorials.functions";

export const krakenInputSchema = z.object({
  command: z.string(),
  params: z.record(z.string(), z.any()).optional()
});

export type KrakenInput = z.infer<typeof krakenInputSchema>;

export interface KrakenOutput {
  success: boolean;
  message: string;
  timestamp: string;
}


/**
 * Interface de comando para o Kraken Control.
 * Permite que o operador envie instruções táticas para os nodes da Shadow-Ops.
 */
export const krakenHandler = async (args: { data: KrakenInput, context: any }) => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const data = args.data;
    
    // Log tático no banco para rastreabilidade
    if (supabaseAdmin) {
      const { error } = await (supabaseAdmin.from("integration_logs") as any).insert({
        source: "kraken-v2",
        user_id: args.context?.userId,
        action: `command:${data.command}`,
        outcome: "success",
        context: { params: data.params, metadata: (data as any).metadata } as any
      });
      
      if (error && (error.code === 'PGRST108' || error.message?.includes('schema cache'))) {
        await trackSchemaFailure(error, "krakenHandler", false, { command: data.command, ...(data as any).metadata }, args.context?.userId);
      }
    }

    const logStr = `[Kraken] Executing command: ${data.command}`;
    console.log(logStr);
    
    await new Promise(r => setTimeout(r, 800));
    
    return {
      success: true,
      message: `Comando '${data.command}' processado pelo Kraken Node 0xFA-88`,
      timestamp: new Date().toISOString()
    };
  } catch (err: any) {
    console.error("[KRAKEN_ERR] handler:", err);
    throw err;
  }
};

export const krakenCommand = createServerFn({ method: "POST" })

  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => {
    return krakenInputSchema.parse(d);
  })
  .handler(krakenHandler);


