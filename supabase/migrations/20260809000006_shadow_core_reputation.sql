-- Integration logic for Reputation Score
-- Reputation is a derived metric, but we store it for performance.
-- This function allows updating reputation based on specific events.

CREATE OR REPLACE FUNCTION public.update_reputation_score(_user_id UUID, _delta INTEGER, _reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_score INTEGER;
BEGIN
    SELECT reputation_score INTO current_score FROM profiles WHERE id = _user_id;
    
    -- Reputation is capped between 0 and 100
    UPDATE profiles 
    SET reputation_score = LEAST(100, GREATEST(0, reputation_score + _delta))
    WHERE id = _user_id;
    
    -- Optional: Log reputation change to loyalty history or a new audit table
    INSERT INTO loyalty_history (user_id, amount, description, metadata)
    VALUES (_user_id, 0, 'Reputation Change: ' || _reason, jsonb_build_object('delta', _delta, 'prev_score', current_score));
END;
$$;

-- Trigger to increase reputation on successful conversion
CREATE OR REPLACE FUNCTION public.on_conversion_reputation()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.conversions_count > OLD.conversions_count) THEN
        PERFORM public.update_reputation_score(NEW.id, 5, 'Indicação legítima convertida');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_conversion_reputation ON public.profiles;
CREATE TRIGGER tr_conversion_reputation
AFTER UPDATE OF conversions_count ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.on_conversion_reputation();
