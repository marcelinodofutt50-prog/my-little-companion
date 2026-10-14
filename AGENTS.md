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
