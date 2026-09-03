import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaffChannelAccess } from "./staff-chat.server";

/**
 * Academia da Equipe — centro de treinamento INTERNO.
 * Visível apenas para admin / suporte / moderação (mesma checagem do Staff Nexus).
 * Somente admin cria, edita ou apaga módulos.
 */

async function requireAdmin(userId: string) {
  const { supabaseAdmin, role } = await assertStaffChannelAccess(userId, fallback);
  if (role !== "admin") {
    throw new Error("Apenas administradores podem editar os módulos de treinamento interno.");
  }
  return supabaseAdmin;
}

export const listStaffTrainings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    const { supabaseAdmin, role } = await assertStaffChannelAccess(userId, supabase);

    // Em produção a chave de serviço pode falhar (formato novo de chave /
    // variável ausente). Nesse caso lemos como o próprio usuário — as
    // políticas já liberam leitura para admin/suporte/moderação.
    async function readModules(client: any) {
      return client.from("staff_trainings").select("*").order("display_order", { ascending: true });
    }
    async function readProgress(client: any) {
      return client
        .from("staff_training_progress")
        .select("training_id, completed, completed_at")
        .eq("user_id", userId);
    }

    const primary = supabaseAdmin ?? supabase;
    let [{ data: modules, error }, { data: progress }]: [any, any] = await Promise.all([
      readModules(primary),
      readProgress(primary),
    ]);


    if (error && supabase) {
      console.error("[StaffAcademy] Admin falhou, tentando como usuário:", error.code, error.message);
      const retry = await readModules(supabase);
      if (!retry.error) {
        modules = retry.data;
        error = null as any;
        const p = await readProgress(supabase);
        progress = p.data;
      } else {
        error = retry.error;
      }
    }

    if (error) {
      console.error("[StaffAcademy] Falha ao listar módulos:", error.code, error.message);
      throw new Error(
        `Não foi possível carregar a Academia da Equipe (${error.code ?? "erro"}). Tente novamente.`,
      );
    }

    const done = new Set(
      (progress ?? []).filter((p: any) => p.completed).map((p: any) => p.training_id),
    );

    const items: any[] = (modules ?? [])
      .filter((m: any) => m.is_published || role === "admin")
      .map((m: any) => ({ ...m, completed: done.has(m.id) }));

    return {
      items,
      myRole: role,
      canManage: role === "admin",
      completed: items.filter((m: any) => m.completed).length,
      total: items.filter((m: any) => m.is_published).length,
    };
  });


export const setStaffTrainingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ trainingId: z.string().uuid(), completed: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await assertStaffChannelAccess(userId, fallback);
    const { error } = await supabaseAdmin.from("staff_training_progress").upsert(
      {
        user_id: userId,
        training_id: data.trainingId,
        completed: data.completed,
        completed_at: data.completed ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,training_id" },
    );
    if (error) throw new Error("Não foi possível salvar seu progresso: " + error.message);
    return { ok: true };
  });

export const saveStaffTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(3).max(160),
        description: z.string().trim().max(400).default(""),
        content: z.string().trim().max(20000).default(""),
        category: z.string().trim().min(2).max(40).default("onboarding"),
        level: z.enum(["basico", "intermediario", "avancado"]).default("basico"),
        video_url: z
          .string()
          .trim()
          .max(1000)
          .nullish()
          .transform((v) => (v ? v : null)),
        estimated_minutes: z.number().int().min(1).max(600).default(10),
        display_order: z.number().int().min(0).max(999).default(0),
        is_published: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const payload: Record<string, any> = { ...data, created_by: context.userId };
    if (!payload.id) delete payload.id;
    const { error } = await supabaseAdmin
      .from("staff_trainings")
      .upsert(payload, { onConflict: "id" });
    if (error) throw new Error("Falha ao salvar módulo: " + error.message);
    return { ok: true };
  });

export const deleteStaffTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("staff_trainings").delete().eq("id", data.id);
    if (error) throw new Error("Falha ao remover módulo: " + error.message);
    return { ok: true };
  });

/** Painel do admin: quem da equipe já concluiu o quê. */
export const getStaffTrainingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);

    const [{ data: roles }, { data: modules }, { data: progress }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("staff_trainings").select("id").eq("is_published", true),
      supabaseAdmin.from("staff_training_progress").select("user_id, training_id, completed"),
    ]);

    const staffIds = Array.from(
      new Set(
        (roles ?? [])
          .filter((r: any) => ["admin", "moderator", "support"].includes(String(r.role)))
          .map((r: any) => r.user_id),
      ),
    );

    const profileMap = new Map<string, any>();
    if (staffIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, full_name, email, avatar_url")
        .in("id", staffIds);
      for (const p of profiles ?? []) profileMap.set((p as any).id, p);
    }

    const total = (modules ?? []).length;
    const doneBy = new Map<string, number>();
    for (const p of progress ?? []) {
      if ((p as any).completed) {
        const k = (p as any).user_id;
        doneBy.set(k, (doneBy.get(k) ?? 0) + 1);
      }
    }

    const members = staffIds.map((id) => {
      const p = profileMap.get(id) || {};
      const roleRow = (roles ?? []).find((r: any) => r.user_id === id) as any;
      return {
        id,
        name: p.display_name || p.full_name || p.email?.split("@")[0] || "Membro",
        avatar: p.avatar_url || null,
        role: roleRow?.role || "staff",
        done: doneBy.get(id) ?? 0,
        total,
      };
    });

    members.sort((a, b) => b.done - a.done);
    return { members, total };
  });
