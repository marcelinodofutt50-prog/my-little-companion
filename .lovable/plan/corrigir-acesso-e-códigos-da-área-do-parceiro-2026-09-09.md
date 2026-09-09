# Corrigir acesso e códigos da Área do Parceiro

## Objetivo
Garantir que administradores entrem na mesa de revenda no site publicado e que geração e resgate de códigos de parceria fiquem visíveis e funcionais.

## Implementação
- Tornar a identificação de administrador independente de falhas da consulta de cargo, usando a validação segura já centralizada no servidor.
- Exibir na própria Área do Parceiro um bloco administrativo para gerar e gerenciar códigos de acesso.
- Exibir o resgate de código antes da mensagem de “nenhum serviço”, permitindo liberar a área sem compra.
- Atualizar os textos da navegação administrativa para deixar claro que os códigos também liberam serviços de parceria.
- Preservar as regras atuais: código de revenda libera 60 dias; gestão mensal libera 30 dias; instalação abre atendimento; um código não pode ser aplicado duas vezes pela mesma pessoa.

## Validação
- Testar como administrador real: abrir `/parceiro`, confirmar “Acesso da administração” e a mesa de revenda.
- Gerar um código de parceria, conferir sua prévia e resgatá-lo com uma conta de teste sem permitir troca de proprietário.
- Confirmar o acesso concedido no banco e o histórico do resgate.
- Rodar testes focados, suíte completa e verificar o resultado do site publicado.

## Detalhes técnicos
- As verificações de cargo continuam no servidor; nenhuma permissão será confiada ao navegador.
- A geração usa o painel já protegido para equipe, e o resgate usa a função autenticada existente.
- A publicação precisa conter o código corrigido; a captura mostra que o domínio ainda está entregando a versão anterior.
