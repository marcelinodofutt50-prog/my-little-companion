import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { validateServerEnv } from "./lib/env-validation";

// Run once at server startup so missing secrets surface in the logs
// immediately, not on the first failing request.
// Guard with import.meta.env.SSR: without it the check also runs in the browser
// bundle (Vite shims process.env) and prints the server secret names in the
// user's console.
if (import.meta.env.SSR && typeof process !== "undefined" && process.env) {
  validateServerEnv();
  
  // Background schema validation to detect and fix missing columns (like reply_to_id)
  import("./lib/schema-validator.server").then(({ validateAndFixSchema }) => {
    validateAndFixSchema().catch(err => {
      console.error("[startup] Schema validation failed:", err);
    });
  });
}


const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
