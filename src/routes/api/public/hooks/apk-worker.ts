import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

// Shared-secret HMAC. Worker sends `X-Worker-Signature: sha256=<hex>` over the raw body.
function verifyHmac(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const clean = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(clean, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const ClaimSchema = z.object({
  action: z.literal("claim"),
  worker_id: z.string().min(1).max(64),
});

const StatusSchema = z.object({
  action: z.literal("status"),
  job_id: z.string().uuid(),
  status: z.enum(["sending", "processing"]),
});

const CompleteSchema = z.object({
  action: z.literal("complete"),
  job_id: z.string().uuid(),
  ok: z.boolean(),
  error: z.string().max(500).optional(),
  result_filename: z.string().max(200).optional(),
  result_size_bytes: z.number().int().positive().optional(),
});

async function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/hooks/apk-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.APK_WORKER_HMAC_SECRET;
        if (!secret) return json(500, { error: "worker secret not configured" });

        const raw = await request.text();
        if (!verifyHmac(raw, request.headers.get("x-worker-signature"), secret)) {
          return json(401, { error: "invalid signature" });
        }

        let parsed: unknown;
        try { parsed = JSON.parse(raw); } catch { return json(400, { error: "invalid json" }); }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const action = (parsed as any)?.action;

        // ---- CLAIM: pull next queued job atomically ----
        if (action === "claim") {
          const { worker_id } = ClaimSchema.parse(parsed);

          const { data: next } = await supabaseAdmin
            .from("apk_jobs")
            .select("id,user_id,source_path,source_filename,source_size_bytes")
            .eq("status", "queued")
            .order("queued_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (!next) return json(200, { job: null });

          // Guarded update: only claim if still queued.
          const { data: claimed, error: claimErr } = await supabaseAdmin
            .from("apk_jobs")
            .update({
              status: "claimed",
              worker_id,
              claimed_at: new Date().toISOString(),
            } as any)
            .eq("id", next.id)
            .eq("status", "queued")
            .select("id,user_id,source_path,source_filename,source_size_bytes")
            .maybeSingle();
          if (claimErr) return json(500, { error: claimErr.message });
          if (!claimed) return json(200, { job: null }); // Lost race

          // Signed download URL for the source APK (15 min)
          const { data: dl, error: dlErr } = await supabaseAdmin.storage
            .from("apk-uploads")
            .createSignedUrl(claimed.source_path, 60 * 15);
          if (dlErr || !dl) {
            await supabaseAdmin.from("apk_jobs").update({
              status: "failed",
              error_message: `Falha ao gerar URL de origem: ${dlErr?.message}`,
              completed_at: new Date().toISOString(),
            } as any).eq("id", claimed.id);
            return json(500, { error: "failed to sign source url" });
          }

          // Signed upload URL for the result (worker PUTs the processed APK here)
          const resultPath = `${claimed.user_id}/${claimed.id}/result.apk`;
          const { data: up, error: upErr } = await supabaseAdmin.storage
            .from("apk-results")
            .createSignedUploadUrl(resultPath);
          if (upErr || !up) {
            return json(500, { error: "failed to sign upload url" });
          }

          return json(200, {
            job: {
              id: claimed.id,
              source_url: dl.signedUrl,
              source_filename: claimed.source_filename,
              source_size_bytes: claimed.source_size_bytes,
              result_upload_url: up.signedUrl,
              result_upload_token: up.token,
              result_path: resultPath,
            },
          });
        }

        // ---- STATUS: worker heartbeat ----
        if (action === "status") {
          const { job_id, status } = StatusSchema.parse(parsed);
          const patch: any = { status };
          if (status === "processing") patch.started_at = new Date().toISOString();
          const { error } = await supabaseAdmin.from("apk_jobs").update(patch).eq("id", job_id);
          if (error) return json(500, { error: error.message });
          return json(200, { ok: true });
        }

        // ---- COMPLETE: worker uploaded the result APK and reports outcome ----
        if (action === "complete") {
          const c = CompleteSchema.parse(parsed);
          const { data: job } = await supabaseAdmin
            .from("apk_jobs").select("user_id,id").eq("id", c.job_id).maybeSingle();
          if (!job) return json(404, { error: "job not found" });

          if (!c.ok) {
            await supabaseAdmin.from("apk_jobs").update({
              status: "failed",
              error_message: c.error ?? "Worker reportou falha",
              completed_at: new Date().toISOString(),
            } as any).eq("id", c.job_id);
            return json(200, { ok: true });
          }

          const resultPath = `${job.user_id}/${job.id}/result.apk`;
          await supabaseAdmin.from("apk_jobs").update({
            status: "done",
            result_path: resultPath,
            result_filename: c.result_filename ?? "protected.apk",
            result_size_bytes: c.result_size_bytes ?? null,
            completed_at: new Date().toISOString(),
          } as any).eq("id", c.job_id);
          return json(200, { ok: true });
        }

        return json(400, { error: "unknown action" });
      },
    },
  },
});
