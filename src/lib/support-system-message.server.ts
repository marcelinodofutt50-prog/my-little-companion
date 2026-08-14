/**
 * Publica mensagens automáticas (sistema/IA) em um atendimento.
 * O remetente precisa existir em auth.users (FK em support_messages.sender_id),
 * então usamos a conta de um admin real como "remetente do sistema".
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let systemSenderCache: string | null = null;

export async function resolveSystemSender(): Promise<string | null> {
  if (systemSenderCache) return systemSenderCache;
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  systemSenderCache = data?.user_id ?? null;
  return systemSenderCache;
}

export async function postSystemSupportMessage(
  threadId: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  const senderId = await resolveSystemSender();
  if (!senderId) {
    console.error("[support-system] nenhum admin cadastrado para assinar a mensagem automática");
    return { success: false, error: "sem remetente de sistema" };
  }

  const { data: msg, error } = await supabaseAdmin
    .from("support_messages")
    .insert({
      thread_id: threadId,
      sender_id: senderId,
      is_admin: true,
      is_system: true,
      body,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[support-system] falha ao gravar mensagem automática:", error);
    return { success: false, error: error.message };
  }

  if (msg) {
    await supabaseAdmin
      .from("support_threads")
      .update({ unread_by_customer: 1, last_staff_message_at: new Date().toISOString() })
      .eq("id", threadId);
  }
  return { success: true };
}
