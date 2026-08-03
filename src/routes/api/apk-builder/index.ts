import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/apk-builder")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // This will be the endpoint for the external APK Tool worker to poll for jobs
        const authHeader = request.headers.get("Authorization");
        const secret = process.env.APK_WORKER_SECRET;
        
        if (!secret || authHeader !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: jobs, error } = await supabaseAdmin
          .from("apk_build_jobs")
          .select("*")
          .eq("status", "pending")
          .limit(1);

        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        
        if (jobs && jobs.length > 0) {
          // Update status to processing immediately
          await supabaseAdmin
            .from("apk_build_jobs")
            .update({ status: "processing", progress: 10 })
            .eq("id", jobs[0].id);
        }

        return new Response(JSON.stringify(jobs?.[0] || null), {
          headers: { "Content-Type": "application/json" }
        });
      },
      POST: async ({ request }) => {
        // Update job status/progress/output from worker
        const authHeader = request.headers.get("Authorization");
        const secret = process.env.APK_WORKER_SECRET;
        
        if (!secret || authHeader !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = await request.json();
        const { jobId, status, progress, outputUrl, error } = body;

        const { data: supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: updateError } = await supabaseAdmin
          .from("apk_build_jobs")
          .update({
            status,
            progress,
            output_apk_url: outputUrl,
            error_message: error
          })
          .eq("id", jobId);

        if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
        
        return new Response(JSON.stringify({ success: true }));
      }
    }
  }
});
