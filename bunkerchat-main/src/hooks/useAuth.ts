import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/types/bunker";

export type AuthState = {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
};

export function useAuth(): AuthState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({ loading: true, userId: null, profile: null });

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id ?? null;
    if (!uid) {
      setState({ loading: false, userId: null, profile: null });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    setState({ loading: false, userId: uid, profile: profile as Profile | null });
  }

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void refresh();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { ...state, refresh };
}
