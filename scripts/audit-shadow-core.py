import requests
import json
import os

def audit():
    print("--- Shadow Core Audit ---")
    
    # 1. Check Files
    files = [
        "src/routes/_authenticated/shadow-pass.tsx",
        "src/lib/shadow-core.functions.ts",
        "supabase/migrations/20260809000005_shadow_core_evolution.sql"
    ]
    for f in files:
        if os.path.exists(f):
            print(f"[OK] File exists: {f}")
        else:
            print(f"[FAIL] File missing: {f}")

    # 2. Check i18n
    with open("src/lib/i18n.tsx", "r") as f:
        content = f.read()
        if "nav.shadowpass" in content:
            print("[OK] i18n key 'nav.shadowpass' found")
        else:
            print("[FAIL] i18n key 'nav.shadowpass' missing")

    # 3. Check Sidebar
    with open("src/components/AppSidebar.tsx", "r") as f:
        content = f.read()
        if "/shadow-pass" in content:
            print("[OK] Sidebar link to Shadow Pass found")
        else:
            print("[FAIL] Sidebar link missing")

    print("--- Audit Complete ---")

if __name__ == "__main__":
    audit()
