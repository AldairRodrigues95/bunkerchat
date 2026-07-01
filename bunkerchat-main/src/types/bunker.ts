// Local domain types for BUNKER CHAT.
// The auto-generated Supabase types haven't been regenerated yet for our new tables,
// so we use these directly. Casts to `any` on the supabase client where needed.

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  last_seen: string;
  is_online: boolean;
  created_at: string;
};

export type Conversation = {
  id: string;
  title: string | null;
  created_by: string | null;
  is_group: boolean;
  archived: boolean;
  pinned: boolean;
  last_message: string | null;
  last_message_time: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  user_id: string | null;
  content: string | null;
  image_url: string | null;
  voice_url: string | null;
  location_url: string | null;
  type: string;
  reply_to: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type Reaction = {
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
};
