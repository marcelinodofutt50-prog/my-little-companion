# Corrigir conexão do monitor em produção

## Objetivo
Fazer o painel e o monitor usarem o banco novo também nas funções do servidor, eliminando o aviso de chave secreta ausente.

## Implementação
- Aplicar as credenciais no início de cada execução do servidor, quando o ambiente real da hospedagem já está disponível.
- Permitir nova tentativa de alinhamento caso as credenciais ainda não existam durante a inicialização.
- Garantir que o monitor faça o alinhamento antes de criar a conexão administrativa.
- Adicionar testes para inicialização tardia e para o ambiente recebido pela hospedagem.

## Validação
- Executar os testes direcionados e verificar o estado do build.
- Testar no navegador o monitor, login e painel.
- Publicar a correção e conferir o site publicado.
