# Smoke test pós-deploy — ShadowDash Store

- Ambiente: `http://localhost:8080`
- Executado em: 15/08/2026 00:10 UTC
- Resultado: **ATENÇÃO — FALHAS DETECTADAS** (9/10 rotas)

| Rota | Status | Console | JS | Rede |
| --- | --- | --- | --- | --- |
| `/` (Home) | 200 | 0 | 0 | 1 |
| `/planos` (Planos) | 200 | 0 | 0 | 0 |
| `/auth` (Login) | 200 | 0 | 0 | 0 |
| `/indicacoes` (Indicações) | 200 | 0 | 0 | 0 |
| `/mercado` (Mercado) | 200 | 0 | 0 | 0 |
| `/tutorial` (Tutoriais) | 200 | 0 | 0 | 0 |
| `/crypto` (Cripto) | 200 | 0 | 0 | 0 |
| `/contato` (Contato) | 200 | 0 | 0 | 0 |
| `/termos` (Termos) | 200 | 0 | 0 | 0 |
| `/privacidade` (Privacidade) | 200 | 0 | 0 | 0 |

## Detalhes das falhas

### `/` (status 200)
- **failed_requests**: HEAD https://yvvjaoqzhjqnchhwhwvy.supabase.co/rest/v1/orders?select=*&status=eq.paid
