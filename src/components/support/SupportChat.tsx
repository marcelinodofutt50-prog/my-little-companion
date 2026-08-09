import { useEffect, useRef, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { 
  listMessages, 
  sendMessage, 
  markThreadReadByCustomer 
} from "@/lib/support.functions";
import { normalizeSupportMessages, SupportMessage } from "@/lib/support-message";
import { 
  Send, 
  Paperclip, 
  Loader2, 
  Check, 
  CheckCheck, 
  AlertCircle, 
  Clock, 
  RotateCw, 
  Sparkles,
  User,
  ShieldCheck,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { playNotifyDing } from "@/lib/notify-sound";

type PendingMsg = {
  clientId: string;
  body: string | null;
  attachmentPath?: string;
  attachmentType?: string;
  status: "sending" | "failed";
  error?: string;
  created_at: string;
};

interface SupportChatProps {
  threadId: string;
  userId: string;
  isAdmin?: boolean;
  onNewMessage?: () => void;
}

export function SupportChat({ threadId, userId, isAdmin = false, onNewMessage }: SupportChatProps) {
  const [msgs, setMsgs] = useState<SupportMessage[]>([]);
  const [pending, setPending] = useState<PendingMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [uploading, setUploading] = useState(false);
  
  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendMessage);
  const markReadFn = useServerFn(markThreadReadByCustomer);
  
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  
  const loadMessages = async (before?: string) => {
    try {
      const r: any = await listFn({ data: { threadId, limit: 30, before } });
      const newMsgs = r.messages as SupportMessage[];
      if (before) {
        setMsgs(prev => [...newMsgs, ...prev]);
      } else {
        setMsgs(newMsgs);
      }
      setHasMore(!!r.hasMore);
    } catch (e: any) {
      toast.error("Erro ao carregar mensagens");
    } finally {
      setLoading(false);
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadMessages();
    
    const ch = supabase.channel(`thread-${threadId}`)
      .on("postgres_changes", 
        { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const next = payload.new as any;
          setMsgs(prev => {
            if (prev.some(m => m.id === next.id)) return prev;
            if (next.sender_id !== userId) {
              playNotifyDing();
              if (onNewMessage) onNewMessage();
            }
            return [...prev, next];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [threadId, userId]);

  useEffect(() => {
    if (!loadingOlder) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [msgs.length, pending.length]);

  const handleSend = async (attachmentPath?: string, attachmentType?: string) => {
    const text = body.trim();
    if (!text && !attachmentPath) return;
    
    const clientId = `local-${Date.now()}`;
    const newPending: PendingMsg = {
      clientId,
      body: text || null,
      attachmentPath,
      attachmentType,
      status: "sending",
      created_at: new Date().toISOString()
    };
    
    setPending(prev => [...prev, newPending]);
    setBody("");
    
    try {
      const res: any = await sendFn({ data: { threadId, body: text || undefined, attachmentPath, attachmentType } });
      setMsgs(prev => [...prev, res]);
      setPending(prev => prev.filter(p => p.clientId !== clientId));
    } catch (e: any) {
      setPending(prev => prev.map(p => p.clientId === clientId ? { ...p, status: "failed", error: e.message } : p));
      toast.error(e.message || "Falha ao enviar");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/40 backdrop-blur-sm border border-border/40 rounded-lg overflow-hidden">
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {hasMore && (
          <Button variant="ghost" size="sm" className="w-full text-[10px] uppercase font-mono" onClick={() => { setLoadingOlder(true); loadMessages(msgs[0]?.created_at); }}>
            {loadingOlder ? <Loader2 className="animate-spin h-3 w-3" /> : "Carregar histórico"}
          </Button>
        )}
        
        {msgs.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
              m.is_system ? "bg-cyan/10 border border-cyan/40 text-cyan mx-auto text-center" :
              m.sender_id === userId ? "bg-primary text-primary-foreground" : "bg-muted/50 border border-border/40"
            }`}>
              <div className="flex items-center gap-2 mb-1 opacity-60 text-[10px] font-mono uppercase">
                {m.is_system ? <Bot className="h-3 w-3" /> : m.is_admin ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                <span>{m.is_system ? "Sistema" : m.is_admin ? "Suporte" : "Você"}</span>
                <span>•</span>
                <span>{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
              {m.attachment_url && (
                <div className="mt-2 rounded-lg overflow-hidden border border-border/20">
                  {m.attachment_type?.startsWith("image/") ? (
                    <img src={m.attachment_url} alt="anexo" className="max-h-60 w-full object-contain bg-black/20" />
                  ) : (
                    <a href={m.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-muted/30 hover:bg-muted/50 text-xs">
                      <Paperclip className="h-3 w-3" /> Baixar anexo
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {pending.map(p => (
          <div key={p.clientId} className="flex justify-end opacity-70">
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 bg-primary/60 text-primary-foreground ${p.status === "failed" ? "border-2 border-destructive" : ""}`}>
              <div className="flex items-center gap-2 mb-1 text-[10px] font-mono uppercase">
                <User className="h-3 w-3" />
                <span>Enviando...</span>
                <Clock className="h-3 w-3 animate-pulse" />
              </div>
              <p className="text-sm">{p.body}</p>
              {p.status === "failed" && (
                <Button variant="destructive" size="sm" className="mt-2 h-6 text-[10px]" onClick={() => handleSend(p.attachmentPath, p.attachmentType)}>
                  Tentar novamente
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <form className="p-4 border-t border-border/40 bg-background/20" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
        <div className="flex items-center gap-2">
          <input type="file" ref={fileRef} hidden onChange={async (e) => {
             const file = e.target.files?.[0];
             if (!file) return;
             setUploading(true);
             try {
               const path = `${userId}/${threadId}/${Date.now()}-${file.name}`;
               const { error } = await supabase.storage.from("support-media").upload(path, file);
               if (error) throw error;
               await handleSend(path, file.type);
             } catch (err: any) {
               toast.error(err.message);
             } finally { setUploading(false); }
          }} />
          <Button type="button" variant="ghost" size="icon" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Input 
            value={body} 
            onChange={(e) => setBody(e.target.value)} 
            placeholder="Escreva sua mensagem..." 
            className="flex-1 bg-background/40"
          />
          <Button type="submit" size="icon" disabled={!body.trim() && !uploading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
