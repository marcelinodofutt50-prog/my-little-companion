import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-helpers.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createCipheriv, randomBytes } from "node:crypto";

function encryptVpsPassword(password: string) {
  const secret = process.env.VPS_DELIVERY_ENCRYPTION_KEY;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error("Entrega desativada: configure VPS_DELIVERY_ENCRYPTION_KEY com 64 caracteres hexadecimais.");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(secret, "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return {
    encrypted_password: encrypted.toString("base64"),
    encryption_iv: iv.toString("base64"),
    encryption_tag: cipher.getAuthTag().toString("base64"),
  };
}

export const adminListVpsOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await supabaseAdmin.from("vps_orders")
      .select("id,user_id,order_reference,plan_name,cpu_brand,amount_cents,payment_status,created_at")
      .order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const userIds = [...new Set(rows.map((row: any) => row.user_id))];
    const profilesResult = userIds.length
      ? await supabaseAdmin.from("profiles").select("id,email,full_name,display_name").in("id", userIds)
      : { data: [], error: null };
    if (profilesResult.error) throw new Error(profilesResult.error.message);
    const byId = new Map((profilesResult.data ?? []).map((profile: any) => [profile.id, profile]));
    const deliveryResult = rows.length
      ? await supabaseAdmin.from("vps_deliveries").select("vps_order_id,delivered_at").in("vps_order_id", rows.map((row: any) => row.id))
      : { data: [], error: null };
    if (deliveryResult.error) throw new Error(deliveryResult.error.message);
    const delivered = new Map((deliveryResult.data ?? []).map((item: any) => [item.vps_order_id, item.delivered_at]));
    return rows.map((row: any) => ({ ...row, profile: byId.get(row.user_id) ?? null, delivered_at: delivered.get(row.id) ?? null }));
  });

export const adminDeliverVps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({
    orderId: z.string().uuid(),
    serverIp: z.string().trim().min(1).max(255),
    serverPort: z.coerce.number().int().min(1).max(65535),
    username: z.string().trim().min(1).max(128),
    initialPassword: z.string().min(12).max(512),
    note: z.string().trim().max(1000).optional().default(""),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: order, error: orderError } = await supabaseAdmin.from("vps_orders")
      .select("id,payment_status").eq("id", data.orderId).maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Pedido VPS não encontrado.");
    if (order.payment_status !== "paid") throw new Error("Só é possível entregar VPS com pagamento confirmado.");
    const { data: existing, error: existingError } = await supabaseAdmin.from("vps_deliveries")
      .select("id").eq("vps_order_id", data.orderId).maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) throw new Error("Este pedido já tem uma entrega registrada.");
    const encrypted = encryptVpsPassword(data.initialPassword);
    const { error } = await supabaseAdmin.from("vps_deliveries").insert({
      vps_order_id: data.orderId, server_ip: data.serverIp, server_port: data.serverPort,
      username: data.username, ...encrypted, admin_note: data.note || null, delivered_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });
