import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getStaffMessages,
  sendStaffMessage,
  deleteStaffMessage,
  listStaffDirectory,
} from "@/lib/staff-chat.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, MessageSquare, AlertCircle, Loader2, Trash2, Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CHANNELS = ["general", "suporte", "anuncios"];

export function StaffNexusChat({ className }: { className?: string }) {
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("general");
  const [dmName, setDmName] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const fetchMessages = useServerFn(getStaffMessages);
  const sendMsgFn = useServerFn(sendStaffMessage);
  const deleteMsgFn = useServerFn(deleteStaffMessage);
  const fetchDirectory = useServerFn(listStaffDirectory);

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-messages", channel],
    queryFn: () => fetchMessages({ data: { channel } }),
    refetchInterval: 4000,
    retry: false,
  });

  const { data: directory } = useQuery({
    queryKey: ["staff-directory"],
    queryFn: () => fetchDirectory(),
    retry: false,
    staleTime: 60_000,
  });

  const members = directory?.members ?? [];
  const isDm = channel.startsWith("dm:");

  const messages = data?.messages ?? [];
  const myRole = data?.myRole;


  const mutation = useMutation({
    mutationFn: (vars: { content: string; channel: string }) => sendMsgFn({ data: vars }),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["staff-messages", channel] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar mensagem"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteMsgFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-messages", channel] }),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao apagar"),
  });

  // Só rola para o fim quando chega mensagem nova E o leitor já estava no fim.
  const lastId = messages[messages.length - 1]?.id;
  const atBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [lastId, channel]);


  if (error) {
    const raw = (error as any)?.message ?? "Erro desconhecido";
    const denied = /acesso negado/i.test(raw);
    return (
      <Card className="border-destructive/20 bg-destructive/5 p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
        <h2 className="mb-2 text-lg font-bold">
          {denied ? "Acesso Restrito" : "Falha ao abrir o canal"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {denied
            ? "Esta área é exclusiva para a equipe Shadow (Admin / Suporte / Moderação)."
            : "O canal existe, mas o servidor recusou a leitura. Detalhe técnico abaixo."}
        </p>
        <p className="mt-3 break-words font-mono text-[10px] text-destructive/80">{raw}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 h-8 font-mono text-[10px] uppercase"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["staff-messages"] })}
        >
          Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <Button
              key={c}
              variant={channel === c ? "default" : "outline"}
              size="sm"
              className="h-7 font-mono text-[10px] uppercase"
              onClick={() => {
                setDmName(null);
                setChannel(c);
              }}
            >
              #{c}
            </Button>
          ))}
        </div>
        {myRole && (
          <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase text-primary">
            você: {myRole}
          </span>
        )}
      </div>

      {members.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/10 bg-card/30 p-2">
          <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            <Lock className="h-3 w-3" /> Privado
          </span>
          {members.map((m: any) => (
            <Button
              key={m.id}
              variant={channel === m.channel ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2 font-mono text-[10px]"
              onClick={() => {
                setDmName(m.name);
                setChannel(m.channel);
              }}
            >
              <Avatar className="h-4 w-4">
                <AvatarImage src={m.avatar ?? undefined} className="object-cover" />
                <AvatarFallback className="text-[7px] uppercase">
                  {(m.name || "?").substring(0, 2)}
                </AvatarFallback>
              </Avatar>
              {m.name}
              <span className="opacity-50">· {m.role}</span>
            </Button>
          ))}
        </div>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-primary/20 bg-card/30 backdrop-blur-sm">
        <CardContent
          className="min-h-[320px] flex-1 space-y-3 overflow-y-auto overscroll-contain scroll-smooth p-4 font-mono"
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >

          {isLoading ? (
            <div className="flex h-full items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground opacity-40">
              <MessageSquare className="mx-auto mb-4 h-12 w-12" />
              <p className="text-xs uppercase tracking-widest">
                Início da transmissão segura em #{channel}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className="group flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-foreground/5"
              >
                <Avatar className="h-8 w-8 shrink-0 border border-primary/20">
                  <AvatarImage src={msg.avatar ?? undefined} className="object-cover" />
                  <AvatarFallback className="bg-muted text-[10px] uppercase">
                    {(msg.author || "?").substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="max-w-[160px] truncate text-xs font-bold text-primary">
                      {msg.isMine ? "Você" : msg.author}
                    </span>
                    <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] uppercase text-primary">
                      {msg.sender_role}
                    </span>
                    <span className="text-[9px] text-muted-foreground opacity-60">
                      {formatDistanceToNow(new Date(msg.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                    {msg.content}
                  </p>
                </div>
                {(msg.isMine || myRole === "admin") && (
                  <button
                    type="button"
                    aria-label="Apagar mensagem"
                    className="opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
                    onClick={() => removeMutation.mutate(msg.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                )}
              </div>
            ))
          )}
        </CardContent>

        <div className="shrink-0 border-t border-primary/10 bg-background/40 p-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const content = message.trim();
              if (!content) return;
              mutation.mutate({ content, channel });
            }}
          >
            <Input
              placeholder={`Enviar mensagem segura para #${channel}...`}
              className="h-11 border-primary/20 bg-background/50"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={mutation.isPending}
            />
            <Button size="icon" className="h-11 w-11 shrink-0" disabled={mutation.isPending || !message.trim()}>
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <div className="mt-2 flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
            <div className="h-1 w-1 animate-pulse rounded-full bg-emerald-500" />
            Canal interno privado — visível apenas para a equipe.
          </div>
        </div>
      </Card>
    </div>
  );
}
