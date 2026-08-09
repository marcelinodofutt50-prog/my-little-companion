import os
import requests
import json

def audit_schema():
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    supabase_key = "sb_publishable__u2iOefPQwvWF_XDRML4jg_Y7YbITnt"
    
    if not supabase_url:
        print("Missing VITE_SUPABASE_URL")
        return

    # Check for community_goals table
    print("--- Auditing Community Goals Tables ---")
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}"
    }
    
    # Try to select from community_goals
    response = requests.get(f"{supabase_url}/rest/v1/community_goals?select=*", headers=headers)
    if response.status_code == 200:
        print("✅ community_goals table exists and is accessible.")
        print(f"Goals found: {len(response.json())}")
    elif response.status_code == 404:
        print("❌ community_goals table NOT FOUND (404).")
    else:
        print(f"⚠️ community_goals check returned {response.status_code}: {response.text}")

    # Check for profiles reputation/VIP columns
    response = requests.get(f"{supabase_url}/rest/v1/profiles?select=reputation_score,vip_tier&limit=1", headers=headers)
    if response.status_code == 200:
        print("✅ profiles table has reputation_score and vip_tier columns.")
    else:
        print(f"❌ profiles columns check failed: {response.text}")

if __name__ == "__main__":
    audit_schema()
