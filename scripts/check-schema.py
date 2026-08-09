import os
import json
import requests
import sys

def check_schema():
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("VITE_SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase environment variables")
        return False

    print(f"Checking Supabase at: {supabase_url}")
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}"
    }
    
    # Check tutorial_progress
    tables = ["tutorials", "tutorial_progress", "licenses", "orders"]
    all_ok = True
    
    for table in tables:
        url = f"{supabase_url}/rest/v1/{table}?select=count&limit=1"
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                print(f"✅ Table '{table}': Accessible")
            elif response.status_code == 406 and "PGRST108" in response.text:
                print(f"❌ Table '{table}': PGRST108 (Schema cache error)")
                all_ok = False
            elif response.status_code == 404:
                print(f"❌ Table '{table}': 404 (Not found)")
                all_ok = False
            else:
                print(f"⚠️ Table '{table}': Status {response.status_code} - {response.text[:100]}")
                # We don't mark as failure for auth errors here, just connectivity
        except Exception as e:
            print(f"❌ Table '{table}': Exception {str(e)}")
            all_ok = False

    return all_ok

if __name__ == "__main__":
    success = check_schema()
    if not success:
        sys.exit(1)
    sys.exit(0)
