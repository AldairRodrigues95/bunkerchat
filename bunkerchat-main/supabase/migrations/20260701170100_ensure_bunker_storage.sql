-- Garante bucket + políticas de storage ao entrar no chat
CREATE OR REPLACE FUNCTION public.ensure_chat_storage()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage
AS $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'chat-uploads',
    'chat-uploads',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_chat_storage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_chat_storage() TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_bunker_conversation()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage
AS $$
DECLARE
  me UUID := auth.uid();
  conv_id UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM public.ensure_chat_storage();

  SELECT conversation_id INTO conv_id
  FROM public.conversation_participants
  WHERE user_id = me
  ORDER BY joined_at ASC
  LIMIT 1;

  IF conv_id IS NULL THEN
    SELECT id INTO conv_id FROM public.conversations ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (title, created_by, is_group)
    VALUES ('Bunker Particular', me, false)
    RETURNING id INTO conv_id;
  END IF;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  SELECT conv_id, p.id
  FROM public.profiles p
  ON CONFLICT DO NOTHING;

  RETURN conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_bunker_conversation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_bunker_conversation() TO authenticated;
