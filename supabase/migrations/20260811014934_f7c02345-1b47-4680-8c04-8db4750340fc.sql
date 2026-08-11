-- 1. Community Messages Policies
CREATE POLICY "Allow authenticated to read community messages" 
ON public.community_messages 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow users to insert their own messages" 
ON public.community_messages 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 2. Tutorials Policies
CREATE POLICY "Allow authenticated to read tutorials" 
ON public.tutorials 
FOR SELECT 
TO authenticated 
USING (true);

-- 3. Tutorial Progress Policies
CREATE POLICY "Allow users to manage their own progress" 
ON public.tutorial_progress 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id);

-- 4. Reload PostgREST Cache
NOTIFY pgrst, 'reload schema';
