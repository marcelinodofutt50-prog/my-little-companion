# Security follow-up: middleware logging and cron credential rotation

This checklist is intentionally operational. Do not put credential values in this file, source control, issue comments, or chat.

## 1. Rotate the cron credential (manual dashboard action)

A previous read-only database inspection found a cron command containing a credential literal. Treat that credential as exposed because SQL job definitions and database logs may be visible to project operators.

1. Generate a new high-entropy value in the approved secret manager.
2. Update the matching Vercel environment variable(s) for every environment that invokes the cron endpoints (`CRON_SECRET` and/or the legacy `CRON_TRIGGER_TOKEN`, according to the configured callers).
3. Update the pg_cron job command to read the new value from a protected server-side secret source rather than embedding it in SQL text. If the current Supabase setup cannot securely inject a secret into pg_cron, move the scheduled invocation to a protected Vercel Cron endpoint or another secret-managed scheduler.
4. Coordinate the cutover so callers and endpoint validation agree. Verify successful authorized execution and 401 for a request without credentials.
5. Remove/disable obsolete cron jobs and revoke the old credential after successful verification.
6. Review access to database logs and job definitions. Rotation does not erase historical log entries.

Do not paste the old or new value into GitHub, chat, or deployment logs.

## 2. Redact request headers in the generated Supabase auth middleware

`src/integrations/supabase/auth-middleware.ts` is marked as automatically generated. Do not patch this generated file by hand: identify and change the generator/template or upstream Lovable configuration, then regenerate it.

The current no-authorization diagnostic logs the complete request-header map. Replace that diagnostic with an allowlist of non-sensitive metadata (for example method, pathname, and a request/correlation ID). Never log Authorization, Cookie, Set-Cookie, apikey, x-cron-secret, or arbitrary header values. Also remove token prefixes from authentication error logs.

After regeneration, verify that unauthenticated requests still return 401 and that no secret-bearing headers appear in application logs.

## 3. Validation before merge

- Run the project typecheck, lint, unit tests, and production build.
- Exercise staff/admin authorization for permitted and denied users, including MFA-required accounts.
- Verify cron authentication with a valid rotated secret and rejection without one.
- Inspect preview logs for header/token redaction.
- Keep this PR in draft until these checks pass.

## Scope

These steps are not executed by this branch. No Supabase production SQL, cron job, environment variable, credential, or deployment was changed.
