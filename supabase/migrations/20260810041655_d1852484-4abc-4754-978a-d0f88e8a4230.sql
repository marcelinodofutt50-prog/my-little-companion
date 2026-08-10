-- Reparar relacionamento community_messages -> profiles
-- O PostgREST precisa de uma FK direta para public.profiles para habilitar joins automáticos

ALTER TABLE public.community_messages
DROP CONSTRAINT IF EXISTS community_messages_user_id_profiles_fkey;

ALTER TABLE public.community_messages
ADD CONSTRAINT community_messages_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Notificar o PostgREST para recarregar o esquema imediatamente
NOTIFY pgrst, 'reload schema';

-- Re-garantir permissões
GRANT SELECT, INSERT ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;
