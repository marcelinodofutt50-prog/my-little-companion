CREATE TABLE public.community_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view messages" 
ON public.community_messages FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Anyone authenticated can send messages" 
ON public.community_messages FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);
