import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const repairStorageBuckets = createServerFn({ method: "POST" })
  .handler(async () => {
    // 1. Ensure 'avatars' bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const hasAvatars = buckets?.find(b => b.name === 'avatars');

    if (!hasAvatars) {
      console.log("[Repair] Creating 'avatars' bucket...");
      const { error } = await supabaseAdmin.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: 2097152, // 2MB
      });
      if (error) throw error;
    } else {
      console.log("[Repair] 'avatars' bucket already exists. Updating to ensure public access...");
      await supabaseAdmin.storage.updateBucket('avatars', { public: true });
    }
    
    return { success: true, bucket: 'avatars' };
  });
