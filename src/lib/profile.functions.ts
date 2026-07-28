import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Apelido público: sem @, sem espaços, sem cara de e-mail.
const nickSchema = z
  .string()
  .trim()
  .min(3, "Mínimo de 3 caracteres")
  .max(20, "Máximo de 20 caracteres")
  .regex(/^[a-zA-Z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou underline")
  .refine((v) => !v.includes("@"), "O apelido não pode conter @")
  .refine((v) => !/\.(com|net|org|br)$/i.test(v), "O apelido não pode parecer um e-mail");

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("id,email,display_name,full_name")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      id: context.userId,
      email: (data as any)?.email ?? null,
      display_name: (data as any)?.display_name ?? null,
      full_name: (data as any)?.full_name ?? null,
    };
  });

export const updateMyDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ displayName: z.union([nickSchema, z.literal("")]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const value = data.displayName.trim() === "" ? null : data.displayName.trim();

    if (value) {
      const { data: taken } = await context.supabase
        .from("profiles")
        .select("id")
        .ilike("display_name", value)
        .neq("id", context.userId)
        .maybeSingle();
      if (taken) throw new Error("Esse apelido já está em uso");
    }

    const { error } = await context.supabase
      .from("profiles")
      .update({ display_name: value })
      .eq("id", context.userId);
    if (error) {
      if (/duplicate key|unique/i.test(error.message)) throw new Error("Esse apelido já está em uso");
      throw new Error(error.message);
    }
    return { ok: true, display_name: value };
  });
