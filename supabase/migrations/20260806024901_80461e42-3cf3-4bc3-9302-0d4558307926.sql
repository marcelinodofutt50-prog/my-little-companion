-- Add display_order column
ALTER TABLE public.tutorials ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Update existing rows to have a sensible default order based on creation date
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
  FROM public.tutorials
)
UPDATE public.tutorials
SET display_order = numbered.row_num
FROM numbered
WHERE public.tutorials.id = numbered.id;
