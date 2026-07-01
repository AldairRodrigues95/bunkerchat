
CREATE OR REPLACE FUNCTION public.ensure_bunker_conversation()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  conv_id UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Look for an existing conversation I already participate in
  SELECT conversation_id INTO conv_id
  FROM public.conversation_participants
  WHERE user_id = me
  ORDER BY joined_at ASC
  LIMIT 1;

  -- If none, look for any existing conversation (there should be only one bunker)
  IF conv_id IS NULL THEN
    SELECT id INTO conv_id FROM public.conversations ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- Create if still none
  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (title, created_by, is_group)
    VALUES ('Bunker Particular', me, false)
    RETURNING id INTO conv_id;
  END IF;

  -- Ensure ALL current profiles are participants (so second user auto-joins)
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  SELECT conv_id, p.id
  FROM public.profiles p
  ON CONFLICT DO NOTHING;

  RETURN conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_bunker_conversation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_bunker_conversation() TO authenticated;
