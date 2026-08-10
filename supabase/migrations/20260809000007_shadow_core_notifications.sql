-- Enforce deduplication on notifications
-- We assume an app_notifications table exists based on previous messages, 
-- but we ensure it has a unique key for deduplication.

ALTER TABLE IF EXISTS public.app_notifications 
ADD COLUMN IF NOT EXISTS event_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_event_key ON public.app_notifications (user_id, event_key) WHERE event_key IS NOT NULL;

-- Function to send notification with deduplication
CREATE OR REPLACE FUNCTION public.send_shadow_notification(
    _user_id UUID, 
    _kind TEXT, 
    _title TEXT, 
    _description TEXT, 
    _href TEXT DEFAULT NULL, 
    _event_key TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO app_notifications (user_id, kind, title, description, href, event_key)
    VALUES (_user_id, _kind, _title, _description, _href, _event_key)
    ON CONFLICT (user_id, event_key) DO NOTHING;
END;
$$;

-- Hook into Community Goals for notifications
CREATE OR REPLACE FUNCTION public.on_community_goal_achieved()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.achieved_at IS NOT NULL AND OLD.achieved_at IS NULL) THEN
        -- Notify all users
        INSERT INTO app_notifications (user_id, kind, title, description, href, event_key)
        SELECT id, 'info', '🎉 Meta da Comunidade!', 'Alcançamos ' || NEW.target_members || ' membros! Recompensa: ' || NEW.reward_description, '/shadow-pass', 'goal_' || NEW.id
        FROM profiles
        ON CONFLICT (user_id, event_key) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_community_goal_notify ON public.community_goals;
CREATE TRIGGER tr_community_goal_notify
AFTER UPDATE OF achieved_at ON public.community_goals
FOR EACH ROW EXECUTE FUNCTION public.on_community_goal_achieved();
