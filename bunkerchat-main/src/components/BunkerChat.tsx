import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureBunkerConversation, signOut } from "@/lib/bunker-auth";
import { fileToDataUrl, fromStoragePath, resolveImageUrl, toStoragePath } from "@/lib/chat-images";
import type { Message, Profile } from "@/types/bunker";
import { toast } from "sonner";
import { Send, Smile, Image as ImageIcon, LogOut, Loader2, Camera, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BunkerLogo } from "@/components/BunkerLogo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const QUICK_EMOJIS = ["❤️", "😂", "😍", "🥰", "😮", "😢", "👍", "🔥", "🛡️", "✨", "🎉", "😘"];
const IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif";

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "HOJE";
  if (sameDay(d, yesterday)) return "ONTEM";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function BunkerChat({ me, onSignOut }: { me: Profile; onSignOut: () => void }) {
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [resolvedImages, setResolvedImages] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createSignedUrl = useCallback(async (path: string) => {
    const { data, error } = await supabase.storage
      .from("chat-uploads")
      .createSignedUrl(path, 60 * 60 * 24);
    if (error) return null;
    return data.signedUrl;
  }, []);

  // Bootstrap: ensure conversation + load messages + profiles
  useEffect(() => {
    void (async () => {
      try {
        const id = await ensureBunkerConversation();
        setConvId(id);
        const { data: msgs } = await db
          .from("messages")
          .select("*")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true })
          .limit(200);
        setMessages((msgs ?? []) as Message[]);
        const { data: profs } = await db.from("profiles").select("*");
        const map: Record<string, Profile> = {};
        for (const p of (profs ?? []) as Profile[]) map[p.id] = p;
        setProfiles(map);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao carregar o bunker");
      }
    })();
  }, []);

  // Resolve storage paths to signed URLs for display
  useEffect(() => {
    const pending = messages.filter((m) => m.image_url);
    if (pending.length === 0) return;

    void (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        pending.map(async (m) => {
          const url = await resolveImageUrl(m.image_url, createSignedUrl);
          if (url) updates[m.id] = url;
        }),
      );
      if (Object.keys(updates).length > 0) {
        setResolvedImages((prev) => {
          const merged = { ...prev };
          let changed = false;
          for (const [id, url] of Object.entries(updates)) {
            if (!merged[id]) {
              merged[id] = url;
              changed = true;
            }
          }
          return changed ? merged : prev;
        });
      }
    })();
  }, [messages, createSignedUrl]);

  // Realtime: messages + presence + typing broadcast
  useEffect(() => {
    if (!convId) return;
    const channel = supabase
      .channel(`conv:${convId}`, { config: { presence: { key: me.id } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId !== me.id) {
          setTypingUser(payload.username as string);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTypingUser(null), 2500);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString(), username: me.username });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [convId, me.id, me.username]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typingUser]);

  const grouped = useMemo(() => {
    const groups: Array<{ day: string; items: Message[] }> = [];
    for (const m of messages) {
      const day = formatDay(m.created_at);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(m);
      else groups.push({ day, items: [m] });
    }
    return groups;
  }, [messages]);

  function broadcastTyping() {
    if (!convId) return;
    supabase.channel(`conv:${convId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { userId: me.id, username: me.username },
    });
  }

  async function handleSend(content?: string, imageUrl?: string) {
    const body = (content ?? text).trim();
    if (!convId) return;
    if (!body && !imageUrl) return;
    setSending(true);
    try {
      const { error } = await db.from("messages").insert({
        conversation_id: convId,
        user_id: me.id,
        content: body || null,
        image_url: imageUrl ?? null,
        type: imageUrl ? "image" : "text",
      });
      if (error) throw error;
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  }

  async function handleFile(file: File) {
    if (!convId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    setUploading(true);
    setImagePickerOpen(false);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "foto.jpg";
      const path = `${convId}/${crypto.randomUUID()}-${safeName}`;
      const up = await supabase.storage.from("chat-uploads").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

      if (!up.error) {
        const signed = await createSignedUrl(path);
        if (signed) {
          setResolvedImages((prev) => ({ ...prev, [`pending-${path}`]: signed }));
        }
        await handleSend("", toStoragePath(path));
        toast.success("Imagem enviada");
        return;
      }

      // Fallback: bucket ainda não configurado — salva imagem comprimida no banco
      const dataUrl = await fileToDataUrl(file);
      await handleSend("", dataUrl);
      toast.success("Imagem enviada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload da imagem");
    } finally {
      setUploading(false);
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void handleFile(f);
  }

  function openGallery() {
    setImagePickerOpen(false);
    galleryRef.current?.click();
  }

  function openCamera() {
    setImagePickerOpen(false);
    cameraRef.current?.click();
  }

  async function handleSignOut() {
    await signOut();
    onSignOut();
  }

  function getDisplayImageUrl(m: Message): string | null {
    if (resolvedImages[m.id]) return resolvedImages[m.id];
    if (m.image_url && (m.image_url.startsWith("data:image/") || !fromStoragePath(m.image_url))) {
      return m.image_url;
    }
    return null;
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background bunker-vignette">
      {/* Header */}
      <header className="relative flex items-center justify-between border-b border-border/60 bg-card/60 backdrop-blur px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-gold/50 bg-bunker/50 p-0.5">
            <BunkerLogo size="sm" className="h-full w-full" />
          </div>
          <div className="min-w-0">
            <h1 className="text-stencil text-sm text-gold truncate">BUNKER PARTICULAR</h1>
            <p className="text-[11px] text-muted-foreground truncate">
              Logado como <span className="text-foreground">{me.username}</span> · Canal seguro
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bunker-grid">
        {grouped.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-gold/40 p-1">
                <BunkerLogo size="lg" className="h-full w-full" />
              </div>
              <p className="mt-3 text-stencil text-xs text-muted-foreground">CANAL VAZIO</p>
              <p className="mt-1 text-sm text-foreground">Envie a primeira transmissão ❤️</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {grouped.map((group) => (
              <div key={group.day} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-stencil text-[10px] text-muted-foreground">{group.day}</span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
                {group.items.map((m) => {
                  const mine = m.user_id === me.id;
                  const author = m.user_id ? profiles[m.user_id]?.username ?? "?" : "?";
                  const displayUrl = getDisplayImageUrl(m);
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`group relative max-w-[85%] sm:max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
                          mine
                            ? "bg-gold/90 text-gold-foreground rounded-br-sm"
                            : "bg-card border border-border rounded-bl-sm"
                        }`}
                      >
                        {!mine && (
                          <div className="text-stencil text-[10px] opacity-80 mb-1">{author}</div>
                        )}
                        {m.image_url && (
                          displayUrl ? (
                            <a href={displayUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={displayUrl}
                                alt="Imagem enviada"
                                loading="lazy"
                                className="mb-1 max-h-72 rounded-md object-cover cursor-pointer"
                              />
                            </a>
                          ) : (
                            <div className="mb-1 flex h-32 items-center justify-center rounded-md bg-muted/40">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                          )
                        )}
                        {m.content && (
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {m.content}
                          </p>
                        )}
                        <div
                          className={`mt-1 text-[10px] tabular-nums ${
                            mine ? "text-gold-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          {formatTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {typingUser && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold" />
                </span>
                {typingUser} digitando...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Emoji picker */}
      {showEmojis && (
        <div className="border-t border-border/60 bg-card/80 px-3 py-2">
          <div className="mx-auto flex max-w-2xl flex-wrap gap-1.5">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setText((t) => t + e);
                  setShowEmojis(false);
                }}
                className="rounded-md px-2 py-1 text-xl hover:bg-gold/20 transition"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/60 bg-card/70 backdrop-blur px-3 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="mx-auto flex max-w-2xl items-end gap-2"
        >
          {/* Galeria — sem capture para abrir álbum de fotos */}
          <input
            ref={galleryRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="sr-only"
            onChange={onFileSelected}
          />
          {/* Câmera — capture força abertura da câmera no mobile */}
          <input
            ref={cameraRef}
            type="file"
            accept={IMAGE_ACCEPT}
            capture="environment"
            className="sr-only"
            onChange={onFileSelected}
          />

          <Popover open={imagePickerOpen} onOpenChange={setImagePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={uploading}
                aria-label="Anexar imagem"
                className="shrink-0"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-52 p-2">
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={openGallery}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-gold/15 transition"
                >
                  <Images className="h-4 w-4 text-gold" />
                  Galeria de fotos
                </button>
                <button
                  type="button"
                  onClick={openCamera}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-gold/15 transition"
                >
                  <Camera className="h-4 w-4 text-gold" />
                  Tirar foto
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowEmojis((s) => !s)}
            aria-label="Emojis"
            className="shrink-0"
          >
            <Smile className="h-4 w-4" />
          </Button>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              broadcastTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={1}
            placeholder="Transmitir mensagem..."
            className="min-h-[42px] max-h-32 resize-none bg-input/60"
          />
          <Button
            type="submit"
            disabled={sending || !text.trim()}
            className="shrink-0 bg-gold text-gold-foreground hover:bg-gold/90"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
