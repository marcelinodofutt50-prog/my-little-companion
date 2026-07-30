DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.licenses'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%panel%'
  LOOP
    EXECUTE format('ALTER TABLE public.licenses DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.licenses ADD CONSTRAINT licenses_panel_check CHECK (panel IN ('v455','v457','v46'));