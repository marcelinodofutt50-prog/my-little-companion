# Relatório de segurança do deploy — ShadowDash Store

- Data: 2026-08-14T20:34:31.572Z
- Duração: 12.2s
- Banco verificado: dvnksmqbpbzwgwmbnjjy.supabase.co
- Commit: local
- Resultado: ✅ APROVADO

**70/70 testes aprovados** (0 falhas).

## post-login-verification.test.ts — 9/9

- ✅ Pós-login — licença no painel a licença do cliente aparece logo após o login
- ✅ Pós-login — licença no painel a licença continua visível depois do refresh do browser
- ✅ Pós-login — licença no painel o cliente não enxerga licenças de outras pessoas
- ✅ Pós-login — Centro de Treinamento as tabelas do Centro de Treinamento respondem (sem PGRST205)
- ✅ Pós-login — Centro de Treinamento o cliente consegue gravar e reler o próprio progresso
- ✅ Pós-login — Centro de Treinamento o bucket de vídeos existe e emite link assinado
- ✅ Pós-login — Staff Nexus nega o canal interno para quem não é staff
- ✅ Pós-login — Staff Nexus libera o canal interno quando a conta tem cargo de suporte, inclusive após refresh
- ✅ Pós-login — Staff Nexus staff não consegue publicar se passando por outro usuário

## prod-e2e-security.test.ts — 61/61

- ✅ Produção — infraestrutura dos fluxos críticos aponta para o projeto de produção usado pela Vercel
- ✅ Produção — infraestrutura dos fluxos críticos tabela licenses está publicada na API com as colunas esperadas
- ✅ Produção — infraestrutura dos fluxos críticos tabela trials está publicada na API com as colunas esperadas
- ✅ Produção — infraestrutura dos fluxos críticos tabela apk_jobs está publicada na API com as colunas esperadas
- ✅ Produção — infraestrutura dos fluxos críticos tabela apk_free_trials está publicada na API com as colunas esperadas
- ✅ Produção — infraestrutura dos fluxos críticos tabela device_identities está publicada na API com as colunas esperadas
- ✅ Produção — infraestrutura dos fluxos críticos tabela fraud_assessments está publicada na API com as colunas esperadas
- ✅ Produção — infraestrutura dos fluxos críticos tabela audit_logs está publicada na API com as colunas esperadas
- ✅ Produção — infraestrutura dos fluxos críticos tabela staff_messages está publicada na API com as colunas esperadas
- ✅ Produção — infraestrutura dos fluxos críticos tabela tutorials está publicada na API com as colunas esperadas
- ✅ Produção — infraestrutura dos fluxos críticos tabela tutorial_progress está publicada na API com as colunas esperadas
- ✅ Produção — infraestrutura dos fluxos críticos tabela support_messages está publicada na API com as colunas esperadas
- ✅ Produção — infraestrutura dos fluxos críticos tabela play_protect_grants está publicada na API com as colunas esperadas
- ✅ Produção — infraestrutura dos fluxos críticos bucket avatars existe
- ✅ Produção — infraestrutura dos fluxos críticos bucket tutorials existe
- ✅ Produção — infraestrutura dos fluxos críticos bucket apk-uploads existe
- ✅ Produção — infraestrutura dos fluxos críticos bucket apk-results existe
- ✅ Produção — infraestrutura dos fluxos críticos bucket support-media existe
- ✅ Produção — infraestrutura dos fluxos críticos Centro de Treinamento: upload + link assinado funcionam de ponta a ponta
- ✅ Produção — infraestrutura dos fluxos críticos índice antifraude trials_one_per_device_idx existe (1 por aparelho)
- ✅ Produção — infraestrutura dos fluxos críticos índice antifraude apk_free_trials_one_per_device_idx existe (1 por aparelho)
- ✅ Produção — infraestrutura dos fluxos críticos índice antifraude device_identities_user_device_key existe (1 por aparelho)
- ✅ Produção — infraestrutura dos fluxos críticos RLS está habilitado em trials
- ✅ Produção — infraestrutura dos fluxos críticos RLS está habilitado em licenses
- ✅ Produção — infraestrutura dos fluxos críticos RLS está habilitado em staff_messages
- ✅ Produção — infraestrutura dos fluxos críticos RLS está habilitado em device_identities
- ✅ Produção — infraestrutura dos fluxos críticos RLS está habilitado em fraud_assessments
- ✅ Produção — infraestrutura dos fluxos críticos RLS está habilitado em audit_logs
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue ler profiles
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue ler licenses
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue ler trials
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue ler orders
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue ler support_messages
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue ler support_threads
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue ler device_identities
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue ler fraud_assessments
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue ler audit_logs
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue ler recovery_codes
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue ler payout_requests
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue escrever em licenses
- ✅ Segurança — RLS bloqueia acesso anônimo anon não consegue registrar aparelho (device_identities)
- ✅ Segurança — Staff Nexus (bypass de staff) anon não lê o canal interno
- ✅ Segurança — Staff Nexus (bypass de staff) anon não publica no canal interno
- ✅ Segurança — Staff Nexus (bypass de staff) canal interno está protegido por RLS
- ✅ Segurança — uploads anon não envia arquivo para o bucket privado de tutoriais
- ✅ Segurança — uploads anon não envia avatar para a pasta de outro usuário
- ✅ Segurança — uploads anon não lê arquivos privados de outro usuário
- ✅ Conduta: só revoga com evidência válida não sinaliza cliente legítimo: que pena, não consegui instalar ainda
- ✅ Conduta: só revoga com evidência válida não sinaliza cliente legítimo: vale a pena comprar o vitalício?
- ✅ Conduta: só revoga com evidência válida não sinaliza cliente legítimo: pode repassar a senha nova pra mim?
- ✅ Conduta: só revoga com evidência válida não sinaliza cliente legítimo: bom dia, tudo bem?
- ✅ Conduta: só revoga com evidência válida não sinaliza cliente legítimo: não estou conseguindo logar no meu celular
- ✅ Conduta: só revoga com evidência válida não sinaliza cliente legítimo: instalei no meu aparelho e deu erro
- ✅ Conduta: só revoga com evidência válida não sinaliza cliente legítimo: uma pena que o servidor caiu ontem
- ✅ Conduta: só revoga com evidência válida sinaliza conduta inadequada: não estou conseguindo instalar na pena do cliente
- ✅ Conduta: só revoga com evidência válida sinaliza conduta inadequada: coloquei em umas penas aqui e deu erro
- ✅ Conduta: só revoga com evidência válida sinaliza conduta inadequada: quero usar no bico que peguei
- ✅ Conduta: só revoga com evidência válida sinaliza conduta inadequada: vou revender esse acesso
- ✅ Conduta: só revoga com evidência válida sinaliza conduta inadequada: meus clientes estão reclamando do login
- ✅ Conduta: só revoga com evidência válida sinaliza conduta inadequada: como faço pra repassar o login pra outra pessoa
- ✅ Conduta: só revoga com evidência válida mensagem vazia nunca sinaliza

---
Cobertura: RLS e bloqueio de anônimos, autorização do Staff Nexus, validação de uploads, índices anti-abuso (1 trial e 1 APK por aparelho), detecção de conduta inadequada e verificação pós-login (licença no painel, Centro de Treinamento e Staff Nexus após refresh).