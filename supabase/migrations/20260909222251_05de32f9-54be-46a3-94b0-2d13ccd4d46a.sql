do $$ begin
  begin
    alter publication supabase_realtime add table public.announcements;
  exception when duplicate_object then null; end;
end $$;