<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Paid VPS delivery tickets are created transactionally by the orders trigger with a unique source_order_id; this prevents duplicate tickets and partial delivery when payment callbacks repeat.
- Giveaway winner selection uses uint32 rejection sampling and Fisher–Yates sampling in shared pure helpers; this keeps selection unbiased and testable.
- Recording protection shares sensitive-data detection with public giveaway labels, and private media must use data-sensitive wrappers; this protects images that cannot be classified from text.

- O reparo de acesso só pode concluir após reaplicar a senha exibida na licença; presença da conta ou “subscription Updated” não comprovam credenciais válidas.
- A license's `server_ip` must always be the host of the panel where its account lives (trials included); the repair treats the IP shown to a paying customer as the panel to fix. Why: the customer logs into BTmob by that IP, and a mismatch shows "license doesn't exist".
- Renewing an existing panel account always restores its status (add; if "already in use and active", remove → add), never `cexpire` alone. Why: `cexpire` keeps subtype 'new', so BTmob answers "subscription has expired" even with a future date.
- Creator program writes (applications, license claims, videos, staff reviews) go only through SECURITY DEFINER RPCs; tables are SELECT-only for clients so members cannot self-approve or bypass limits.
- Creator status lookups allow only the caller's own account or MFA-validated staff; application reviews derive attribution inside the review RPC, preventing cross-user status disclosure and forged reviewers.
- Creator video links use the shared creator-link-safety helper before rendering on customer and staff screens; stored or imported URLs are untrusted and must not become arbitrary clickable destinations.

- The published site (shadowdashstore.com) uses the backend at FILES_SUPABASE_* (DB: FILES_SUPABASE_DB_URL); apply every db/*.sql and drizzle migration there too, not only to Lovable Cloud or EXT_SUPABASE_*. Why: changes applied only elsewhere left the live site without the Creator functions.
- Login pause/resume logic lives only in `src/lib/license-pause.server.ts` (confirmed remove on pause; add with original credentials and explicit calculated expiry on resume) and `src/lib/license-pause-rules.ts` (pure date math); client, staff and auto-resume use the same core. Resolve the panel from the displayed server host and require password application before clearing pause state, so access and frozen dates stay consistent.
- Global promotional countdowns use a shared pure deadline helper and hydrate the clock after mount; this prevents session resets and SSR mismatches without changing checkout eligibility.
- Customer sheets isolate rendering errors and ignore superseded requests; this keeps an individual customer failure from breaking admin or displaying the previous customer's data.
- Admin license lists use pure display helpers for status/archive/search and identified confirmation dialogs for mutations; paused access stays visible and credentials never appear in success notifications.
- General customer renewal links go to the eligibility-filtered plans catalog, not the legacy credential-claim page; catalog lookup errors remain distinct from missing products so standard customers are not forced into legacy-only checkout.

- Browser identity consumers share only concurrent getUser validation via browser-auth-user; never cache completed identity checks or share server callers. Root auth invalidation tracks account transitions, not repeated same-user SIGNED_IN events, and ordinary network failures must not reload the page, to prevent request amplification without weakening server authorization.

- Server-renewal fulfillment uses renewal-delivery to require panel expiry and original-password application before saving active access; failures remain retryable and paused licenses never recreate access. Renewal options are owner-scoped and the checkout validates the selected license price class.
- Support renewal guidance uses a fixed system-only action marker rendered as allowlisted internal Buttons; auto-close requires the latest customer resolution confirmation, no pending order/crypto payment, five idle hours and an unchanged thread update timestamp, so silence or payment claims cannot authorize closure.
- Purchase evidence is private and separate from payment approval: customer uploads use owned paid orders and validated bytes; support attachments are transactionally indexed as unverified candidates, and provider snapshots are allowlisted and idempotent. Only owners/admins may download through RLS-checked short-lived URLs, so receipts cannot approve purchases or expose financial documents in community chat.
- Support attachment send endpoints share canonical storage-key authorization before privileged signing, and customer read-state fallbacks retain owner filters; this prevents cross-conversation disclosure or mutation when administrative clients bypass RLS.
- Admin chat media galleries read through the existing authenticated staff message endpoint, scan history only while open, and reset on thread changes; this preserves access checks and prevents previous-conversation media from leaking into the selected chat.

- Admin support chat controls live in the shared toolbar clusters from chat-toolbar.tsx: classification with conversation tools in one row, ticket lifecycle actions in the header. No control gets its own row, so the panel stays scannable.
- Admin asynchronous searches use latest-request cancellation across query changes, close and unmount; stale responses must not restore old results or clear a newer loading state.
- Highlight buttons pair bg-neon with text-neon-foreground, a token defined per theme in styles.css; without that token the text silently inherits and renders unreadable on the fill.

- Chat media upload tickets confirm the sender's role on the server before granting a storage path; the browser never declares staff status. A client-supplied flag locked attendants out of customer conversations while text messages kept working.

- Chat async work is scoped to a conversation visit, not just its ID; changing account, leaving or A→B→A invalidates old callbacks before state mutations, and desktop notifications never include customer text.

- Payment destination validation uses explicit project origins rather than wildcard hosting domains; notification destinations use a narrower allowlist to prevent caller-selected callbacks.
- Schema health reads return generic failures, and global schema-repair RPCs require server-side administrative authorization and MFA; ordinary customer diagnostics cannot trigger repairs.
- APK job client INSERT grants are defensively revoked; existing user-scoped creation handlers are blocked, not migrated to privileged execution. Do not describe creation as operational.

- Creator screens (member area and staff review) share creator-errors messages, ignore superseded loads via latest-request, and treat a failed read as an error with retry, never as "not approved" or "empty"; staff review preserves the saved note unless edited. Why: a failed query otherwise locks approved creators out or erases comments.
- Creator mutation UI uses account-actions to invalidate completions across account transitions and unmount, with synchronous per-operation locks; authorization stays in RPCs/RLS. Why: old responses must not clear another account's drafts or release its active locks.
- Creator read recovery uses creator-read-recovery with bounded transient-only retries and AbortSignals scoped to the current load; never retry mutations automatically, because a lost response may hide a committed write.
