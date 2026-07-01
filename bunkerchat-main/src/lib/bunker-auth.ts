import { supabase } from "@/integrations/supabase/client";

export const BUNKER_USERS = [
  { username: "@Beca", email: "beca@bunker.local" },
  { username: "@Arck", email: "arck@bunker.local" },
] as const;

export const BUNKER_PASSWORD = "99655974";
export type BunkerUsername = (typeof BUNKER_USERS)[number]["username"];

export async function signInBunker(username: BunkerUsername, password: string) {
  const user = BUNKER_USERS.find((u) => u.username === username);
  if (!user) throw new Error("Usuário inválido");

  const first = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (!first.error) return first.data;

  const msg = first.error.message.toLowerCase();
  const looksMissing = msg.includes("invalid") || msg.includes("not found") || msg.includes("credentials");
  if (!looksMissing) throw first.error;

  const signUp = await supabase.auth.signUp({
    email: user.email,
    password,
    options: { data: { username } },
  });
  if (signUp.error) throw signUp.error;

  const second = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (second.error) throw second.error;
  return second.data;
}

export async function ensureBunkerConversation(): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_bunker_conversation");
  if (error) throw error;
  return data as string;
}

export async function signOut() {
  await supabase.auth.signOut();
}
