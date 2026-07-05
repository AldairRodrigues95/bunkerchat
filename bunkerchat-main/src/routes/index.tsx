import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { BunkerLogin } from "@/components/BunkerLogin";
import { BunkerChat } from "@/components/BunkerChat";
import { BunkerLogo } from "@/components/BunkerLogo";

export const Route = createFileRoute("/")({
  ssr: false,
  component: BunkerIndex,
});

export function BunkerIndex() {
  const { loading, userId, profile, refresh } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bunker-vignette">
        <div className="flex flex-col items-center gap-3">
          <BunkerLogo size="lg" className="animate-pulse" />
          <p className="text-stencil text-xs text-muted-foreground">CARREGANDO BUNKER...</p>
        </div>
      </div>
    );
  }

  if (!userId || !profile) {
    return <BunkerLogin onSuccess={() => void refresh()} />;
  }

  return <BunkerChat me={profile} onSignOut={() => void refresh()} />;
}
