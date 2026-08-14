DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

DROP POLICY IF EXISTS "Messages are viewable by everyone" ON public.community_messages;
DROP POLICY IF EXISTS "Anyone authenticated can read messages" ON public.community_messages;
DROP POLICY IF EXISTS "Anyone authenticated can view messages" ON public.community_messages;
DROP POLICY IF EXISTS "Anyone can view community messages" ON public.community_messages;
DROP POLICY IF EXISTS "Anyone can view messages" ON public.community_messages;
DROP POLICY IF EXISTS "Community messages are viewable by everyone" ON public.community_messages;
DROP POLICY IF EXISTS "Allow authenticated to read community messages" ON public.community_messages;

DROP POLICY IF EXISTS "Allow users to insert their own messages" ON public.community_messages;
DROP POLICY IF EXISTS "Anyone authenticated can send messages" ON public.community_messages;
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.community_messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.community_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.community_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.community_messages;

CREATE POLICY "community_messages_read_authenticated"
  ON public.community_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "community_messages_insert_own"
  ON public.community_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

REVOKE SELECT ON public.community_messages FROM anon;
REVOKE SELECT ON public.profiles FROM anon;