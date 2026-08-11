import { createClient } from '@supabase/supabase-js';

// ESTE SCRIPT DEVE SER EXECUTADO COM A CHAVE DE SERVIÇO DO PROJETO dvnksmqbpbzwgwmbnjjy
// CASO ELA SEJA DIFERENTE DA ATUAL NO AMBIENTE.
// No entanto, vou tentar rodar com as credenciais atuais para ver se elas por acaso já foram trocadas ou se funcionam.

async function main() {
  const url = "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
  // Tentamos ler do env, mas se o usuário quer que eu corrija ESSE projeto, 
  // e eu estou no 'yvvjaoqzhjqnchhwhwvy', as chaves de serviço provavelmente não vão funcionar 
  // a menos que o usuário as tenha atualizado no sandbox.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    console.error('ERRO: SUPABASE_SERVICE_ROLE_KEY não encontrada.');
    process.exit(1);
  }

  console.log(`--- REPARO DE PRODUÇÃO: ${url} ---`);
  const supabase = createClient(url, key);

  // Testar conexão
  const { data: authTest, error: authErr } = await supabase.from('profiles').select('count');
  if (authErr && authErr.message.includes('JWT')) {
    console.error('ERRO CRÍTICO: A chave de serviço atual NÃO pertence ao projeto dvnksmqbpbzwgwmbnjjy.');
    console.error('Causa: O sandbox ainda está configurado com o projeto yvvjaoqzhjqnchhwhwvy.');
    console.error('Ação: Por favor, adicione a SERVICE_ROLE_KEY correta do projeto dvnksmqbpbzwgwmbnjjy para que eu possa prosseguir com o reparo.');
    process.exit(1);
  }

  console.log('Conexão estabelecida com sucesso. Iniciando reparo...');

  // 1. Buckets
  console.log('Verificando buckets...');
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find(b => b.name === 'avatars')) {
    console.log('Criando bucket "avatars"...');
    await supabase.storage.createBucket('avatars', { public: true });
  }

  // 2. Tabelas e Colunas (via SQL se possível, ou verificando)
  // Nota: Como não posso rodar SQL arbitrário sem um RPC de 'exec_sql' ou similar (que costuma ser perigoso),
  // e o usuário quer que eu corrija, eu deveria usar migrations. 
  // Mas se as migrations não estão sendo aplicadas na Vercel para esse banco, eu preciso entender o porquê.
  
  console.log('Reparo inicial concluído.');
}

main().catch(console.error);
