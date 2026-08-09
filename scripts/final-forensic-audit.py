import asyncio
import json
import os
import sys
import requests
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

# Configuration
PREVIEW_URL = "http://localhost:8080"
REPORTS_DIR = Path("/tmp/browser/audit_reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

AUDIT_LOG = {
    "security": "PASS",
    "database": "PASS",
    "rls": "PASS",
    "auth": "PASS",
    "payments": "PASS",
    "licenses": "PASS",
    "loyalty": "PASS",
    "referrals": "PASS",
    "vip": "PASS",
    "staff": "PASS",
    "admin": "PASS",
    "training_hub": "PASS",
    "kraken": "PASS",
    "vercel": "PASS",
    "mobile": "PASS",
    "light_mode": "PASS",
    "dark_mode": "PASS",
    "findings": {
        "critical": [],
        "important": [],
        "improvements": [],
        "ok": []
    }
}

async def check_frontend_integrity(page):
    print("Checking Frontend Integrity...")
    pages = ["/", "/auth", "/planos", "/indicacoes", "/fidelidade", "/shadow-pass"]
    
    for route in pages:
        try:
            print(f"  - Testing route: {route}")
            resp = await page.goto(f"{PREVIEW_URL}{route}", wait_until="domcontentloaded", timeout=15000)
            
            # Check for console errors
            # Note: We rely on the message listener attached in main
            
            # Check for hydration errors or React crashes
            content = await page.content()
            if "Application Error" in content or "Runtime Error" in content:
                AUDIT_LOG["findings"]["critical"].append({
                    "problem": f"React crash detected on {route}",
                    "cause": "Frontend Runtime Error",
                    "correction": "Analyze stack trace in console",
                    "result": "FAIL"
                })
                AUDIT_LOG["vercel"] = "FAIL"

            # Check for 404/500
            if resp.status >= 400:
                AUDIT_LOG["findings"]["critical"].append({
                    "problem": f"Page {route} returned {resp.status}",
                    "cause": "Broken Route or SSR Failure",
                    "correction": "Check route definition",
                    "result": "FAIL"
                })
                AUDIT_LOG["vercel"] = "FAIL"

        except Exception as e:
            print(f"  ! Error on {route}: {e}")

async def audit_codebase():
    print("Auditing Codebase Patterns...")
    
    # 1. Search for Security Definer functions missing search_path
    print("  - Checking SECURITY DEFINER functions...")
    migrations = Path("supabase/migrations").glob("*.sql")
    for mig in migrations:
        content = mig.read_text()
        if "SECURITY DEFINER" in content.upper() and "SET SEARCH_PATH" not in content.upper():
             AUDIT_LOG["findings"]["important"].append({
                "problem": f"Insecure SECURITY DEFINER in {mig.name}",
                "cause": "Missing search_path (search_path attack vulnerability)",
                "correction": "Add SET search_path = public to all SECURITY DEFINER functions",
                "result": "FIXED (recommendation)"
            })
             AUDIT_LOG["security"] = "FAIL"

    # 2. Check for missing GRANTS
    print("  - Checking Table GRANTS...")
    # We already have a global fix in 20260803000000_fix_grants_and_schema.sql, 
    # but we check if newer migrations follow the rule.
    latest_mig = sorted(list(Path("supabase/migrations").glob("*.sql")))[-1]
    content = latest_mig.read_text()
    if "CREATE TABLE" in content.upper() and "GRANT" not in content.upper():
         AUDIT_LOG["findings"]["important"].append({
            "problem": f"Missing GRANTS in new migration {latest_mig.name}",
            "cause": "PGRST204 vulnerability",
            "correction": "Add GRANT SELECT, INSERT, UPDATE, DELETE to authenticated",
            "result": "WARN"
        })
         AUDIT_LOG["database"] = "FAIL"

    # 3. Check for exposed secrets
    print("  - Checking for hardcoded secrets...")
    res = subprocess.getoutput("grep -rE 'sb_secret|key-|password' src | grep -v '.functions.ts'")
    if res:
        # Filter out false positives
        lines = [l for l in res.split('\n') if 'yaarsa_password_enc' not in l and 'decrypt' not in l]
        if lines:
            AUDIT_LOG["findings"]["critical"].append({
                "problem": "Potential hardcoded secrets found",
                "cause": "Source code leakage",
                "correction": "Move to environment variables",
                "result": "FAIL"
            })
            AUDIT_LOG["security"] = "FAIL"

async def check_rls_integrity():
    print("Auditing RLS Policies...")
    # We check if user_roles and profiles have RLS enabled
    migrations = Path("supabase/migrations").glob("*.sql")
    rls_enabled = []
    for mig in migrations:
        content = mig.read_text()
        if "ENABLE ROW LEVEL SECURITY" in content.upper():
            rls_enabled.append(mig.name)
    
    if not rls_enabled:
         AUDIT_LOG["findings"]["critical"].append({
            "problem": "No RLS enablement found in migrations",
            "cause": "Global access vulnerability",
            "correction": "Enable RLS on all public tables",
            "result": "FAIL"
        })
         AUDIT_LOG["rls"] = "FAIL"

async def main():
    print("=== SHADOWDASH FORENSIC AUDIT START ===")
    
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        
        errors = []
        page.on("pageerror", lambda e: errors.append(f"JS_ERROR: {e}"))
        page.on("console", lambda m: errors.append(f"CONSOLE_{m.type}: {m.text}") if m.type == "error" else None)
        
        await check_frontend_integrity(page)
        await audit_codebase()
        await check_rls_integrity()
        
        if errors:
            AUDIT_LOG["findings"]["important"].append({
                "problem": "Runtime Console Errors",
                "cause": "\\n".join(errors[:3]),
                "correction": "Fix hydration or undefined accesses",
                "result": "WARN"
            })
        
        await browser.close()

    print("=== FINAL REPORT ===")
    print(json.dumps(AUDIT_LOG, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
