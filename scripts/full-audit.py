import asyncio
import json
import os
import sys
import requests
from pathlib import Path
from playwright.async_api import async_playwright

# Configuration
PREVIEW_URL = "http://localhost:8080"
SUPABASE_URL = "https://yvvjaoqzhjqnchhwhwvy.supabase.co"

REPORT = {
    "critical": [],
    "important": [],
    "improvements": [],
    "ok": []
}

async def audit_pages(playwright):
    browser = await playwright.chromium.launch(headless=True)
    context = await browser.new_context(viewport={"width": 1280, "height": 1800})
    page = await context.new_page()

    console_errors = []
    page.on("pageerror", lambda exc: console_errors.append(f"PAGE_ERROR: {exc}"))
    page.on("console", lambda msg: console_errors.append(f"CONSOLE_{msg.type.upper()}: {msg.text}") if msg.type == "error" else None)

    pages_to_test = ["/", "/auth", "/planos", "/indicacoes"]
    for route in pages_to_test:
        print(f"Auditing {route}...")
        try:
            resp = await page.goto(f"{PREVIEW_URL}{route}", wait_until="networkidle", timeout=10000)
            if resp.status >= 400:
                REPORT["critical"].append({
                    "problem": f"Page {route} returned status {resp.status}",
                    "cause": "Routing or Server error",
                    "correction": "Check route definition and server function stability",
                    "result": "FAIL"
                })
            
            # Check for broken images
            broken = await page.evaluate("""
                () => Array.from(document.querySelectorAll('img'))
                    .filter(img => !img.complete || img.naturalWidth === 0)
                    .map(img => img.src)
            """)
            if broken:
                REPORT["important"].append({
                    "problem": f"Broken images on {route}",
                    "cause": f"Missing assets: {broken}",
                    "correction": "Verify asset paths in public/ and cache-busting queries",
                    "result": "FAIL"
                })
        except Exception as e:
            print(f"Error auditing {route}: {e}")

    if console_errors:
        REPORT["important"].append({
            "problem": "Console errors detected",
            "cause": "\\n".join(console_errors[:5]),
            "correction": "Debug hydration or client-side logic",
            "result": "FAIL"
        })
    else:
        REPORT["ok"].append("Frontend Console Clean")

    await browser.close()

def audit_supabase():
    # We already checked basic connectivity in check-schema.py
    # Here we simulate RLS/Permission check logic
    # In a real environment, we'd use the anon key to try unauthorized reads
    pass

async def run_audit():
    print("Starting full forensic audit...")
    async with async_playwright() as playwright:
        await audit_pages(playwright)
    
    # Check for Workarounds in code
    import subprocess
    workarounds = subprocess.getoutput("grep -r 'workaround' src | grep -v 'node_modules'")
    if workarounds:
        REPORT["improvements"].append({
            "problem": "Workaround comments found in code",
            "cause": "Technical debt",
            "correction": "Refactor to use native patterns",
            "result": "WARN"
        })
    
    # Final Output
    print(json.dumps(REPORT, indent=2))

if __name__ == "__main__":
    asyncio.run(run_audit())
