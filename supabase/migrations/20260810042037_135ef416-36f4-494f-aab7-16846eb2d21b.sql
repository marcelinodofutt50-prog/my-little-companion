-- Reparar relacionamento support_messages -> profiles para joins via sender_id
ALTER TABLE public.support_messages
DROP CONSTRAINT IF EXISTS support_messages_sender_id_profiles_fkey;

ALTER TABLE public.support_messages
ADD CONSTRAINT support_messages_sender_id_profiles_fkey
FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- Notificar o PostgREST para recarregar o esquema
NOTIFY pgrst, 'reload schema';

-- Re-garantir permissões
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
