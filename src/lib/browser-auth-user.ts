import { supabase } from "@/integrations/supabase/client";
import { singleFlight } from "./auth-request-control";

const getConcurrentUser = singleFlight(() => supabase.auth.getUser());

// Browser display consumers share an in-flight validation only. Server callers
// must never reuse another request's identity or authorization results.
export function getBrowserAuthUser() {
  return typeof window === "undefined" ? supabase.auth.getUser() : getConcurrentUser();
}