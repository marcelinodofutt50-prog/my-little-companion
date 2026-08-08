-- Corrigir permissões de Storage para o bucket 'tutorials'
-- Supabase usa a tabela 'storage.objects' para gerenciar permissões de arquivos

DO $$ 
BEGIN
    -- Política de visualização pública (ou para usuários autenticados)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access Tutorials') THEN
        CREATE POLICY "Public Access Tutorials" ON storage.objects FOR SELECT TO public USING (bucket_id = 'tutorials');
    END IF;

    -- Política de upload para admins
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admin Upload Tutorials') THEN
        CREATE POLICY "Admin Upload Tutorials" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tutorials' AND public.has_role(auth.uid(), 'admin'));
    END IF;

    -- Política de deleção para admins
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admin Delete Tutorials') THEN
        CREATE POLICY "Admin Delete Tutorials" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'tutorials' AND public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;
