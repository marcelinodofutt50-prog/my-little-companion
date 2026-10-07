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

- O reparo de acesso só pode concluir após reaplicar a senha exibida na licença; presença da conta ou “subscription Updated” não comprovam credenciais válidas.
- A license's `server_ip` must always be the host of the panel where its account lives (trials included); the repair treats the IP shown to a paying customer as the panel to fix. Why: the customer logs into BTmob by that IP, and a mismatch shows "license doesn't exist".
- Renewing an existing panel account always restores its status (add; if "already in use and active", remove → add), never `cexpire` alone. Why: `cexpire` keeps subtype 'new', so BTmob answers "subscription has expired" even with a future date.
