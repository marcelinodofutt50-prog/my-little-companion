import { createClient } from '@supabase/supabase-js';

async function audit() {
  const envUrl = process.env.VITE_SUPABASE_URL;
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const projectRef = "yvvjaoqzhjqnchhwhwvy";
  
  console.log("=== FORENSIC CONNECTION AUDIT ===");
  console.log(`VITE_SUPABASE_URL: ${envUrl}`);
  console.log(`Project Ref (Expected): ${projectRef}`);
  
  if (!envUrl?.includes(projectRef)) {
    console.error(`❌ Project mismatch! Env URL does not contain ${projectRef}`);
  } else {
    console.log("✅ Project reference matches.");
  }

  const supabase = createClient(envUrl!, envKey!);
  
  // Test 1: Direct SELECT from profiles
  const { data: cols, error: err } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
  if (err) {
    console.error("❌ profiles.select failed:", err.message);
  } else {
    console.log("✅ profiles.select successful.");
    console.log("Available columns:", cols ? Object.keys(cols) : "Empty table");
  }

  // Test 2: community_messages
  const { error: msgErr } = await supabase.from('community_messages').select('id').limit(1);
  if (msgErr) {
    console.error("❌ community_messages.select failed:", msgErr.message, msgErr.code);
  } else {
    console.log("✅ community_messages.select successful.");
  }
}

audit();
