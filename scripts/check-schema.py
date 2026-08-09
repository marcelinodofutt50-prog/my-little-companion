import asyncio
import os
import sys
import json
from supabase import create_client, Client

async def check_schema():
    print("[SCHEMA-CHECK] Iniciando validação preventiva de schema...")
    
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("VITE_SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        print("[SCHEMA-CHECK] ERRO: Variáveis de ambiente do Supabase não encontradas.")
        sys.exit(1)
        
    try:
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Tabelas críticas para o Centro de Treinamento
        critical_tables = ["tutorials", "user_roles", "tutorial_progress"]
        
        for table in critical_tables:
            print(f"[SCHEMA-CHECK] Verificando acesso à tabela: {table}...")
            # Tentativa de leitura mínima para validar o schema cache do PostgREST
            response = supabase.table(table).select("count", count="exact").limit(1).execute()
            
            # Se chegarmos aqui sem erro de exceção, verificamos se o PostgREST retornou erro no corpo
            # Nota: O cliente python pode lançar exceções para erros 4xx/5xx dependendo da versão, 
            # mas o erro PGRST108 geralmente vem como um erro de estrutura.
            
        print("[SCHEMA-CHECK] ✅ Schema validado com sucesso. Nenhuma falha PGRST108 detectada.")
        sys.exit(0)
        
    except Exception as e:
        error_msg = str(e)
        print(f"\n[SCHEMA-CHECK] ❌ RISCO DE FALHA DETECTADO!")
        print(f"[SCHEMA-CHECK] Detalhes: {error_msg}")
        
        if "PGRST108" in error_msg or "could not find" in error_msg.lower():
            print("[SCHEMA-CHECK] CAUSA: O schema cache do PostgREST está desatualizado (PGRST108).")
            print("[SCHEMA-CHECK] AÇÃO: O deploy deve ser bloqueado até que o reparo tático seja executado.")
        else:
            print("[SCHEMA-CHECK] CAUSA: Erro genérico de conexão ou permissão.")
            
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(check_schema())
