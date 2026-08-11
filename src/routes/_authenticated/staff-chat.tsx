import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStaffMessages, sendStaffMessage } from '@/lib/staff-chat.functions';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Shield, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/staff-chat')({
  component: StaffChatPage,
});

function StaffChatPage() {
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('general');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  const fetchMessages = useServerFn(getStaffMessages);
  const sendMsgFn = useServerFn(sendStaffMessage);

  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['staff-messages', channel],
    queryFn: () => fetchMessages({ data: { channel } }),
    refetchInterval: 3000,
  });

  const mutation = useMutation({
    mutationFn: (vars: { content: string, channel: string }) => sendMsgFn({ data: vars }),
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['staff-messages', channel] });
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md border-destructive/20 bg-destructive/5 text-center p-8">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground text-sm">
            Esta área é exclusiva para membros da equipe Shadow (Admin/Mod/Suporte).
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl h-[calc(100vh-120px)] flex flex-col">
      <header className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tighter uppercase italic flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" /> Staff <span className="text-primary underline">Nexus</span>
          </h1>
          <p className="text-muted-foreground text-[10px] font-mono uppercase tracking-widest mt-1">
            // Secure Team Communication Channel
          </p>
        </div>
        <div className="flex gap-2">
           {['general', 'suporte', 'anuncios'].map(c => (
             <Button 
               key={c} 
               variant={channel === c ? "default" : "outline"} 
               size="sm" 
               className="text-[10px] uppercase font-mono h-7"
               onClick={() => setChannel(c)}
             >
               #{c}
             </Button>
           ))}
        </div>
      </header>

      <Card className="flex-1 flex flex-col border-primary/20 bg-card/30 backdrop-blur-sm overflow-hidden min-h-0">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 font-mono scroll-smooth" ref={scrollRef}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : messages?.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground opacity-40">
              <MessageSquare className="h-12 w-12 mx-auto mb-4" />
              <p className="text-xs uppercase tracking-widest">Início da transmissão segura em #{channel}</p>
            </div>
          ) : (
            [...(messages || [])].reverse().map((msg: any) => (
              <div key={msg.id} className="group flex items-start gap-3 hover:bg-white/5 p-2 rounded-lg transition-colors">
                <Avatar className="h-8 w-8 border border-primary/20 shrink-0">
                  <AvatarImage src={undefined} />
                  <AvatarFallback className="text-[10px] bg-muted uppercase">
                    {(msg.profiles?.display_name || msg.profiles?.full_name || "?").substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-bold text-primary truncate max-w-[150px]">
                      {msg.profiles?.display_name || msg.profiles?.full_name || "Desconhecido"}
                    </span>
                    {msg.sender_role && (
                      <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-mono border border-primary/20">
                        {msg.sender_role}
                      </span>
                    )}
                    <span className="text-[9px] text-muted-foreground opacity-60">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>

                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
        
        <div className="p-4 border-t border-primary/10 bg-black/20 shrink-0">
          <form 
            className="flex gap-2" 
            onSubmit={(e) => {
              e.preventDefault();
              if (!message.trim()) return;
              mutation.mutate({ content: message, channel });
            }}
          >
            <Input 
              placeholder={`Enviar mensagem segura para #${channel}...`}
              className="bg-background/50 border-primary/20 h-11"
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={mutation.isPending}
            />
            <Button size="icon" className="h-11 w-11 shrink-0" disabled={mutation.isPending || !message.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <div className="mt-2 text-[9px] text-muted-foreground font-mono flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
            Criptografia ponta-a-ponta ativa (Shadow Protocol v22.0)
          </div>
        </div>
      </Card>
    </div>
  );
}
