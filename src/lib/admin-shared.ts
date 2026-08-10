import { z } from "zod";

/** Próximo dia 20 (corte da mensalidade de servidor). */
export function nextDay20(): Date {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), 20, 23, 59, 59);
  if (d.getDate() >= 20) t.setMonth(t.getMonth() + 1);
  return t;
}

/** Alias histórico usado nos pagamentos externos. */
export const nextDay20Date = nextDay20;

/** Calcula expiração da licença + corte do servidor. */
export function computeExpiries(planSlug: string, customExpire?: string | null) {
  const serverPaidUntil = nextDay20();
  let expiresAt: Date;
  if (customExpire) expiresAt = new Date(customExpire);
  else if (planSlug === "login-7d") { expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7); }
  else if (planSlug === "login-lifetime") { expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 20); }
  else if (planSlug === "trial") { expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 1); }
  else { expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 30); }
  return { expiresAt, serverPaidUntil };
}

export const CreateLicenseInput = z.object({
  userEmail: z.string().trim().email().max(255),
  planSlug: z.enum(["login-7d", "login-30d", "login-lifetime"]),
  panel: z.enum(["v455", "v457", "v46"]).optional(),
  isLegacy: z.boolean().optional(),
  customExpireDate: z.string().optional(),
  legacyServerFeeBrl: z.number().positive().max(10000).optional(),
  postToThreadId: z.string().uuid().optional(),
});

export const RegisterLegacyInput = z.object({
  userEmail: z.string().trim().email().max(255),
  planSlug: z.enum(["login-7d", "login-30d", "login-lifetime"]),
  yaarsaUsername: z.string().trim().min(1).max(64),
  yaarsaEmail: z.string().trim().email().max(255),
  yaarsaPassword: z.string().trim().min(1).max(128),
  panel: z.enum(["v455", "v457", "v46"]).optional(),
  serverIp: z.string().trim().min(1).max(64).optional(),
  expiresAt: z.string().min(1),
  legacyServerFeeBrl: z.number().positive().max(10000).optional(),
});
