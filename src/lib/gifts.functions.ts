import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GiftRecord = {
  order_id: string;
  plan_slug: string;
  plan_name: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  message: string | null;
  /** e-mail da contraparte (destinatário se enviado, remetente se recebido) */
  counterpart_email: string | null;
  mp_payment_id: string | null;
  mp_preference_id: string | null;
  license: {
    id: string;
    expires_at: string | null;
    revoked: boolean;
    panel: string;
  } | null;
};

function mask(email: string | null | undefined) {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/**
 * Histórico de presentes: o que o usuário comprou pra outra pessoa
 * e o que recebeu de alguém. Usa o client admin porque o pedido pertence
 * a quem pagou (RLS não deixa o presenteado ver a linha) — mas só
 * retornamos linhas onde o usuário logado é comprador ou beneficiário.
 */
export const listMyGifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const myEmail = String((claims as any)?.email ?? "").toLowerCase() || null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [sentRes, receivedRes, plansRes] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id,plan_slug,amount,status,created_at,paid_at,metadata,mp_payment_id,mp_preference_id,user_id")
        .eq("user_id", userId)
        .not("metadata->gift", "is", null)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("orders")
        .select("id,plan_slug,amount,status,created_at,paid_at,metadata,mp_payment_id,mp_preference_id,user_id")
        .eq("metadata->gift->>recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin.from("plans").select("slug,name"),
    ]);

    const planName = new Map<string, string>(
      ((plansRes.data ?? []) as any[]).map((p) => [p.slug, p.name]),
    );

    const allOrders = [...((sentRes.data ?? []) as any[]), ...((receivedRes.data ?? []) as any[])];
    const orderIds = allOrders.map((o) => o.id);

    let licenseByOrder = new Map<string, any>();
    if (orderIds.length) {
      const { data: lics } = await supabaseAdmin
        .from("licenses")
        .select("id,order_id,expires_at,revoked,panel")
        .in("order_id", orderIds);
      licenseByOrder = new Map(((lics ?? []) as any[]).map((l) => [l.order_id, l]));
    }

    const map = (o: any, kind: "sent" | "received"): GiftRecord => {
      const gift = o.metadata?.gift ?? {};
      const lic = licenseByOrder.get(o.id);
      return {
        order_id: o.id,
        plan_slug: o.plan_slug,
        plan_name: planName.get(o.plan_slug) ?? o.plan_slug,
        amount: Number(o.amount ?? 0),
        status: o.status,
        created_at: o.created_at,
        paid_at: o.paid_at ?? null,
        message: gift.message ?? null,
        counterpart_email:
          kind === "sent" ? mask(gift.email) : mask(gift.from) ?? "Alguém especial",
        mp_payment_id: o.mp_payment_id ?? null,
        mp_preference_id: o.mp_preference_id ?? null,
        license: lic
          ? { id: lic.id, expires_at: lic.expires_at, revoked: lic.revoked, panel: lic.panel }
          : null,
      };
    };

    return {
      myEmail,
      sent: ((sentRes.data ?? []) as any[]).map((o) => map(o, "sent")),
      received: ((receivedRes.data ?? []) as any[]).map((o) => map(o, "received")),
    };
  });
