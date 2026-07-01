-- Bucket para upload de imagens no chat
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-uploads',
  'chat-uploads',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Upload: participantes da conversa podem enviar imagens na pasta da conversa
CREATE POLICY "chat uploads insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-uploads'
  AND (storage.foldername(name))[1] IN (
    SELECT conversation_id::text
    FROM public.conversation_participants
    WHERE user_id = auth.uid()
  )
);

-- Leitura: participantes podem ver imagens das conversas em que participam
CREATE POLICY "chat uploads select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-uploads'
  AND (storage.foldername(name))[1] IN (
    SELECT conversation_id::text
    FROM public.conversation_participants
    WHERE user_id = auth.uid()
  )
);

-- Atualização (upsert)
CREATE POLICY "chat uploads update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-uploads'
  AND (storage.foldername(name))[1] IN (
    SELECT conversation_id::text
    FROM public.conversation_participants
    WHERE user_id = auth.uid()
  )
);
