# Investigation and fix: trial, "Corrigir problemas", and the R$ 999,90 Lifetime plan

## What the real site's data shows right now (checked before planning)

- The published site is running the latest version: the health page shows `welcome-offer-v2` and `reparo-v455-reativa`.
- **Trial:** the 4 trials from the last 8 hours (19:47, 21:24, 21:42 and 22:18 Brasília) all got "Account created successfully!" from the 4.5.5 server. The site saved them only after that answer, so creation on the panel is confirmed. We still haven't checked that the login stays on the panel or works in the BTmob app afterwards.
- **"Reparar acesso" (automatic repair):** the last 5 repairs ended as "recreated". The panel confirmed "Expire Date updated successfully!" with dates 08/10 and 09/10 (trial rule: today + 2 days).
- **New problem found:** in 3 repairs the site also switched off a copy of the same login on the **4.5.7**, then recreated it only on the 4.5.5. That copy on the 4.5.7 is left switched off.
- **"Corrigir problemas" (admin button):** this is a separate, older routine (`fixLoginInconsistency`). It moves the date forward 1 day and then "puts it back" to the license's date, worked out in London time. For a trial that date is the same day, and late in the evening it's already the next day, so the panel can end up with a date that cuts the login off. This is the most likely source of the wrong dates.
- **R$ 999,90:** today's customer signed up at 22:17 and created 2 Lifetime orders at R$ 999,90 at 01:18 and 01:20, inside his 6h30. Both are still "pending", with no blocked-price record and no payment-start record. We don't know yet where it stops: opening Mercado Pago, the Pix screen, or the customer giving up.

## Steps

1. **R$ 999,90, find the break before fixing**
   - Follow the 2 real orders from "Comprar" to Mercado Pago: is the payment link created, does Mercado Pago accept the amount 999.90, and what comes back.
   - Record each step of starting a payment (created link / Mercado Pago error / customer didn't open it), so a "pending" order always shows its reason.
   - Fix the cause found, and compare with the R$ 750 plan, which works with the same flow.

2. **"Corrigir problemas" button**
   - Replace the old routine with the same repair engine as "Reparar acesso": same date rule (Brasília time, trial = today + 2 days, lifetime = day 20, monthly/weekly = expiry + 1 day). It must reapply the password shown on the license and only report success after the panel confirms the password and the date.
   - Never send the panel today's date or a date in London time.

3. **Repair must not switch off logins on other servers**
   - Only delete or switch off on the license's own server. If a copy turns up on another server, only record it (no automatic action).
   - List the 4.5.7 copies that were switched off in the last few days so the admin can decide what to do.

4. **Trial, confirm from start to finish**
   - After creating it, check on the panel that the login exists with the right date. Show the customer an error if the panel doesn't confirm.
   - Find out why customers report "not created": review the error messages they saw (24h block, device already used, server full) in the last days' records.

5. **Final report** with problem, root cause, file, fix, test and result for each item, using the panel's real answers.

## Technical details

- Files: `src/lib/admin-fix.functions.ts` (replace with `healLicenseLogin`), `src/lib/license-heal.server.ts` (limit removal to `lic.panel`), `src/lib/checkout.functions.ts` and `src/routes/api/public/payments/mercadopago.ts` (step logs in `integration_logs`), `src/lib/license.server.ts` (post-create check of the trial).
- New tests: real 4.5.5 behavior, a copy on another server, "Corrigir problemas" dates around 21h-23h Brasília, and a R$ 999,90 order in Mercado Pago (mocked).
- Nothing changes in the look of the site.
