CREATE TABLE IF NOT EXISTS public.support_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  source_thread_id uuid,
  created_by uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  uses integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('portuguese', coalesce(question,'')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(answer,'')), 'B')
  ) STORED
);
CREATE INDEX IF NOT EXISTS support_knowledge_search_idx ON public.support_knowledge USING gin(search);
CREATE INDEX IF NOT EXISTS support_knowledge_thread_idx ON public.support_knowledge(source_thread_id);
GRANT SELECT, UPDATE, DELETE ON public.support_knowledge TO authenticated;
GRANT ALL ON public.support_knowledge TO service_role;
ALTER TABLE public.support_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read knowledge" ON public.support_knowledge FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff update knowledge" ON public.support_knowledge FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete knowledge" ON public.support_knowledge FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.match_support_knowledge(_q text, _limit integer DEFAULT 3)
RETURNS TABLE(id uuid, question text, answer text, rank real)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE tq tsquery;
BEGIN
  SELECT string_agg(quote_literal(lexeme), ' | ')::tsquery INTO tq
  FROM (SELECT DISTINCT unnest(tsvector_to_array(to_tsvector('portuguese', coalesce(_q,'')))) AS lexeme) l
  WHERE length(lexeme) >= 3;
  IF tq IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT k.id, k.question, k.answer, ts_rank(k.search, tq) AS rank
    FROM public.support_knowledge k
    WHERE k.status = 'active' AND k.search @@ tq
    ORDER BY rank DESC, k.uses DESC
    LIMIT greatest(1, least(_limit, 5));
END $$;
REVOKE ALL ON FUNCTION public.match_support_knowledge(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_support_knowledge(text, integer) TO service_role;