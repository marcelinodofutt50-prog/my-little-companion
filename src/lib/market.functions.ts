import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days

async function signImage(admin: any, path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = await admin.storage.from("market-images").createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}

export const listMarketProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("slug, name, description, price_brl, image_url, sort_order, category, active")
    .eq("category", "market")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const signed = await Promise.all(rows.map(async (r: any) => ({ ...r, image_url: await signImage(supabaseAdmin, r.image_url) })));
  return signed;
});

export const adminListMarketProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("plans")
      .select("slug, name, description, price_brl, image_url, sort_order, active, category")
      .eq("category", "market")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const signed = await Promise.all(rows.map(async (r: any) => ({ ...r, image_signed_url: await signImage(supabaseAdmin, r.image_url) })));
    return signed;
  });

const slugRe = /^[a-z0-9-]{3,48}$/;

export const adminUpsertMarketProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      slug: z.string().trim().toLowerCase().regex(slugRe, "slug: minúsculas, números e hífen, 3-48 caracteres"),
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().max(2000).optional().nullable(),
      price_brl: z.number().positive().max(1_000_000),
      image_url: z.string().trim().max(500).optional().nullable(),
      sort_order: z.number().int().min(0).max(9999).optional(),
      active: z.boolean().optional(),
      original_slug: z.string().trim().optional(), // for updates that rename
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload: any = {
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      price_brl: data.price_brl,
      image_url: data.image_url ?? null,
      sort_order: data.sort_order ?? 0,
      active: data.active ?? true,
      category: "market",
      days: null,
    };

    if (data.original_slug && data.original_slug !== data.slug) {
      // rename not supported (FK from orders); reject
      throw new Error("Não é possível renomear o slug de um produto existente. Crie um novo.");
    }

    const { error } = await supabaseAdmin.from("plans").upsert(payload, { onConflict: "slug" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteMarketProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // If orders reference this plan, just deactivate instead of hard-delete.
    const { data: existingOrder } = await supabaseAdmin.from("orders").select("id").eq("plan_slug", data.slug).limit(1).maybeSingle();
    if (existingOrder) {
      const { error } = await supabaseAdmin.from("plans").update({ active: false }).eq("slug", data.slug).eq("category", "market");
      if (error) throw new Error(error.message);
      return { ok: true, deactivated: true };
    }
    const { error } = await supabaseAdmin.from("plans").delete().eq("slug", data.slug).eq("category", "market");
    if (error) throw new Error(error.message);
    return { ok: true, deleted: true };
  });

export const adminUploadMarketImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      slug: z.string().regex(slugRe),
      contentType: z.string().max(80),
      dataBase64: z.string().min(10).max(6_500_000), // ~5MB after b64 overhead
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(data.contentType)) throw new Error("Tipo de imagem não suportado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = data.contentType.split("/")[1].replace("jpeg", "jpg");
    const path = `${data.slug}/${Date.now()}.${ext}`;
    const bytes = Buffer.from(data.dataBase64, "base64");
    if (bytes.length > 5_000_000) throw new Error("Imagem maior que 5 MB");
    const { error } = await supabaseAdmin.storage.from("market-images").upload(path, bytes, { contentType: data.contentType, upsert: true });
    if (error) throw new Error(error.message);
    const { data: signed } = await supabaseAdmin.storage.from("market-images").createSignedUrl(path, SIGNED_TTL);
    return { path, signedUrl: signed?.signedUrl ?? null };
  });

export const createMarketCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      slug: z.string(),
      returnOrigin: z.string().url(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { createMpPreference } = await import("./mercadopago.server");
    const { supabase, userId, claims } = context;

    const { data: plan, error: planErr } = await supabase
      .from("plans").select("*").eq("slug", data.slug).eq("category", "market").eq("active", true).maybeSingle();
    if (planErr || !plan) throw new Error("Produto não encontrado");

    const amount = Number(plan.price_brl);
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        plan_slug: plan.slug,
        amount,
        status: "pending",
        metadata: { market: true } as any,
      } as any)
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message || "Falha ao criar pedido");

    const origin = data.returnOrigin.replace(/\/$/, "");
    const pref = await createMpPreference({
      orderId: order.id,
      planName: `Shadow Mercado — ${plan.name}`,
      amount,
      payerEmail: claims?.email as string | undefined,
      successUrl: `${origin}/mercado/sucesso?order=${order.id}`,
      pendingUrl: `${origin}/pagamento/pendente?order=${order.id}`,
      failureUrl: `${origin}/pagamento/erro?order=${order.id}`,
      notificationUrl: `${origin}/api/public/mp-webhook`,
    });

    await supabase.from("orders").update({ mp_preference_id: pref.id }).eq("id", order.id);
    return { orderId: order.id, initPoint: pref.init_point, sandboxInitPoint: pref.sandbox_init_point };
  });

export const getMarketOrderState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase
      .from("orders").select("id, status, plan_slug, amount, paid_at, metadata")
      .eq("id", data.orderId).eq("user_id", context.userId).maybeSingle();
    return { order: order ?? null };
  });
