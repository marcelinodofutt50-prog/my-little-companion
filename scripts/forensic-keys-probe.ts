import { createClient } from '@supabase/supabase-js';

async function probe() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing credentials");
    process.exit(1);
  }

  // Probe function for new Supabase keys (apikey header)
  const probeWithHeaders = async (targetUrl: string, targetKey: string) => {
    console.log(`\nProbing: ${targetUrl}`);
    try {
      const response = await fetch(`${targetUrl}/rest/v1/profiles?select=trial_started_at&limit=1`, {
        headers: {
          'apikey': targetKey,
          'Authorization': `Bearer ${targetKey}`
        }
      });
      const data = await response.json();
      console.log(`   Status: ${response.status}`);
      if (response.status === 200) {
        console.log(`   ✅ Success! Columns probe: ${JSON.stringify(data[0] || "empty table")}`);
      } else {
        console.log(`   ❌ Failed: ${JSON.stringify(data)}`);
      }
    } catch (e: any) {
      console.log(`   ❌ Error: ${e.message}`);
    }
  };

  await probeWithHeaders(url, key);
  await probeWithHeaders("https://dvnksmqbpbzwgwmbnjjy.supabase.co", key);
}

probe();
