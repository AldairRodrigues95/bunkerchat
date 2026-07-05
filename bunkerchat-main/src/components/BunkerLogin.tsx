import { useState } from "react";
import { Lock } from "lucide-react";
import { BunkerLogo } from "@/components/BunkerLogo";
import { BUNKER_USERS, BUNKER_PASSWORD, signInBunker, type BunkerUsername } from "@/lib/bunker-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BunkerLogin({ onSuccess }: { onSuccess: () => void }) {
  const [selected, setSelected] = useState<BunkerUsername | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return toast.error("Selecione o operador");
    if (password !== BUNKER_PASSWORD) return toast.error("Senha incorreta");
    setLoading(true);
    try {
      await signInBunker(selected, password);
      toast.success(`Bem-vindo(a), ${selected}`);
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no acesso";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bunker-vignette bunker-grid flex items-center justify-center px-4 py-8">
      <div className="relative w-full max-w-md">
        {/* Corner brackets */}
        <div className="absolute -top-2 -left-2 h-6 w-6 border-t-2 border-l-2 border-gold" />
        <div className="absolute -top-2 -right-2 h-6 w-6 border-t-2 border-r-2 border-gold" />
        <div className="absolute -bottom-2 -left-2 h-6 w-6 border-b-2 border-l-2 border-gold" />
        <div className="absolute -bottom-2 -right-2 h-6 w-6 border-b-2 border-r-2 border-gold" />

        <div className="rounded-lg border border-border/60 bg-card/70 backdrop-blur p-8 shadow-bunker">
          <div className="flex flex-col items-center text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-gold/60 bg-bunker/40 shadow-gold p-1">
              <BunkerLogo size="xl" className="h-full w-full" />
            </div>
            <h1 className="mt-4 text-stencil text-2xl text-gold">BUNKER CHAT</h1>
            <p className="mt-1 text-xs text-muted-foreground">Nosso Bunker Particular ❤️</p>
            <div className="my-6 flex items-center gap-2 w-full">
              <div className="h-px flex-1 bg-border" />
              <span className="text-stencil text-[10px] text-muted-foreground">CONTROLE DE ACESSO</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p className="text-stencil text-[10px] text-muted-foreground mb-2">Escolha</p>
              <div className="grid grid-cols-2 gap-3">
                {BUNKER_USERS.map((u) => (
                  <button
                    key={u.username}
                    type="button"
                    onClick={() => setSelected(u.username)}
                    className={`group relative rounded-md border px-4 py-3 text-left transition-all ${
                      selected === u.username
                        ? "border-gold bg-gold/10 shadow-gold"
                        : "border-border bg-secondary/40 hover:border-gold/50"
                    }`}
                  >
                    <div className="text-stencil text-[10px] text-muted-foreground">USUÁRIO</div>
                    <div className="font-display text-lg text-foreground">{u.username}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-stencil text-[10px] text-muted-foreground mb-2">Senha do Bunker</p>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  inputMode="numeric"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 font-display tracking-widest bg-input/60"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !selected || !password}
              className="w-full bg-gold text-gold-foreground hover:bg-gold/90 font-display tracking-wider"
            >
              {loading ? "AUTENTICANDO..." : "ACESSAR O BUNKER"}
            </Button>
          </form>

          <p className="mt-6 text-center text-[10px] text-muted-foreground text-stencil">
            NOSSO BUNKER · NOSSO MUNDINHO · SÓ NOSSO
          </p>
        </div>
      </div>
    </div>
  );
}
