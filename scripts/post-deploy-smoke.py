"""
Smoke test automático pós-deploy — ShadowDash Store.

Abre as rotas públicas principais, valida status HTTP, erros de console/JS e
falhas de carregamento de recursos, e grava um relatório "site saudável" em
reports/smoke-latest.md (+ JSON).

Uso:
    python3 scripts/post-deploy-smoke.py                  # http://localhost:8080
    BASE_URL=https://www.shadowdashstore.com python3 scripts/post-deploy-smoke.py

Nunca altera dados: apenas navegação anônima e leitura. Trial/bypass intactos.
"""

import asyncio
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080").rstrip("/")
REPORT_DIR = Path("reports")
REPORT_DIR.mkdir(parents=True, exist_ok=True)

ROUTES = [
    ("/", "Home"),
    ("/planos", "Planos"),
    ("/auth", "Login"),
    ("/indicacoes", "Indicações"),
    ("/mercado", "Mercado"),
    ("/tutorial", "Tutoriais"),
    ("/crypto", "Cripto"),
    ("/contato", "Contato"),
    ("/termos", "Termos"),
    ("/privacidade", "Privacidade"),
]

# Ruído conhecido que não indica site quebrado.
IGNORED_CONSOLE = re.compile(
    r"(favicon|Download the React DevTools|third-party cookie|ResizeObserver loop|"
    r"preloaded using link preload|Failed to load resource: the server responded with a status of 401)",
    re.I,
)


async def check_route(context, path, label):
    page = await context.new_page()
    result = {
        "route": path,
        "label": label,
        "status": None,
        "console_errors": [],
        "page_errors": [],
        "failed_requests": [],
        "ok": False,
    }

    page.on(
        "console",
        lambda m: result["console_errors"].append(m.text[:300])
        if m.type == "error" and not IGNORED_CONSOLE.search(m.text)
        else None,
    )
    page.on("pageerror", lambda e: result["page_errors"].append(str(e)[:300]))
    page.on(
        "requestfailed",
        lambda r: result["failed_requests"].append(f"{r.method} {r.url[:160]}")
        if not IGNORED_CONSOLE.search(r.url)
        else None,
    )
    page.on(
        "response",
        lambda r: result["failed_requests"].append(f"{r.status} {r.url[:160]}")
        if r.status >= 500
        else None,
    )

    try:
        resp = await page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded", timeout=30000)
        result["status"] = resp.status if resp else None
        await page.wait_for_timeout(1500)
        html = await page.content()
        if "Application Error" in html or "Runtime Error" in html:
            result["page_errors"].append("Tela de erro da aplicação renderizada")
        # Página vazia = build quebrado
        body_len = await page.evaluate("document.body?.innerText?.trim().length || 0")
        if body_len < 40:
            result["page_errors"].append(f"Conteúdo praticamente vazio ({body_len} chars)")
    except Exception as exc:  # noqa: BLE001
        result["page_errors"].append(f"Navegação falhou: {exc}")

    status_ok = result["status"] is not None and result["status"] < 400
    result["ok"] = (
        status_ok
        and not result["page_errors"]
        and not result["console_errors"]
        and not result["failed_requests"]
    )
    await page.close()
    return result


async def main():
    started = datetime.now(timezone.utc)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        results = []
        for path, label in ROUTES:
            r = await check_route(context, path, label)
            flag = "OK" if r["ok"] else "FALHA"
            print(f"[{flag}] {path} -> {r['status']}")
            results.append(r)
        await browser.close()

    healthy = all(r["ok"] for r in results)
    payload = {
        "base_url": BASE_URL,
        "generated_at": started.isoformat(),
        "healthy": healthy,
        "passed": sum(1 for r in results if r["ok"]),
        "total": len(results),
        "routes": results,
    }
    (REPORT_DIR / "smoke-latest.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False))

    lines = [
        "# Smoke test pós-deploy — ShadowDash Store",
        "",
        f"- Ambiente: `{BASE_URL}`",
        f"- Executado em: {started.strftime('%d/%m/%Y %H:%M UTC')}",
        f"- Resultado: **{'SITE SAUDÁVEL' if healthy else 'ATENÇÃO — FALHAS DETECTADAS'}** "
        f"({payload['passed']}/{payload['total']} rotas)",
        "",
        "| Rota | Status | Console | JS | Rede |",
        "| --- | --- | --- | --- | --- |",
    ]
    for r in results:
        lines.append(
            f"| `{r['route']}` ({r['label']}) | {r['status']} | "
            f"{len(r['console_errors'])} | {len(r['page_errors'])} | {len(r['failed_requests'])} |"
        )
    problems = [r for r in results if not r["ok"]]
    if problems:
        lines += ["", "## Detalhes das falhas", ""]
        for r in problems:
            lines.append(f"### `{r['route']}` (status {r['status']})")
            for kind in ("page_errors", "console_errors", "failed_requests"):
                for item in r[kind][:5]:
                    lines.append(f"- **{kind}**: {item}")
            lines.append("")
    (REPORT_DIR / "smoke-latest.md").write_text("\n".join(lines))

    print("\n" + "\n".join(lines[:8]))
    raise SystemExit(0 if healthy else 1)


if __name__ == "__main__":
    asyncio.run(main())
