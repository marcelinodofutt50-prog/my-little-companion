import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles, Wrench, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LicenseAiPanel() {
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { tokenRef.current = data.session?.access_token ?? null; });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { tokenRef.current = session?.access_token ?? null; });
    return () => sub.subscription.unsubscribe();
  }, []);

  const transport = useState(() => new DefaultChatTransport({
    api: "/api/chat/license-ai",
    headers: (): Record<string, string> => (tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
  }))[0];


  const { messages, sendMessage, status, error } = useChat({
    transport,
  });


  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    if (!tokenRef.current) {
      const { data } = await supabase.auth.getSession();
      tokenRef.current = data.session?.access_token ?? null;
    }
    if (!tokenRef.current) { toast_missing(); return; }
    setInput("");
    await sendMessage({ text });
  };
  const toast_missing = () => import("sonner").then(({ toast }) => toast.error("Faça login novamente — sessão expirada"));


  const presets = [
    { label: "Diagnosticar sistema", prompt: "Rode systemHealth e scanIssues. Depois liste problemas críticos e sugira correções." },
    { label: "Licenças vencendo em 7 dias", prompt: "Use listLicenses com expiring_days=7 e me mostre em tabela." },
    { label: "Erros recentes do servidor", prompt: "Use recentLogs com only_errors=true e resuma o padrão dos erros." },
  ];

  return (
    <div className="rounded border border-border/40 bg-background/40 backdrop-blur-sm">
      <div className="flex items-center gap-3 border-b border-border/40 p-4">
        <div className="rounded bg-gradient-to-br from-neon/20 to-violet/20 p-2">
          <Sparkles className="h-4 w-4 text-neon" />
        </div>
        <div className="flex-1">
          <h3 className="font-mono text-sm uppercase tracking-wider">Shadow Ops IA</h3>
          <p className="font-mono text-[10px] text-muted-foreground">
            Agente autônomo — inspeciona, diagnostica e corrige licenças/servidor em tempo real
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border/40 p-3">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => send(p.prompt)}
            disabled={busy}
            className="rounded border border-border/40 bg-background/60 px-3 py-1.5 font-mono text-[10px] uppercase text-muted-foreground transition-colors hover:border-neon/40 hover:text-neon disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="max-h-[520px] min-h-[320px] space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="rounded border border-dashed border-border/40 p-6 text-center font-mono text-xs text-muted-foreground">
            Pergunte algo ao agente. Ele conhece o fluxo de licenças + Mercado Pago + regra do dia 20.
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={
              m.role === "user"
                ? "max-w-[80%] rounded-lg bg-neon/10 border border-neon/30 px-3 py-2 text-sm"
                : "max-w-[90%] rounded-lg bg-background/60 border border-border/40 px-3 py-2 text-sm space-y-2"
            }>
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <div key={i} className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{part.text}</ReactMarkdown>
                    </div>
                  );
                }
                if (part.type.startsWith("tool-")) {
                  const p = part as any;
                  return (
                    <div key={i} className="rounded border border-cyan/30 bg-cyan/5 p-2 font-mono text-[10px]">
                      <div className="flex items-center gap-2 text-cyan">
                        <Wrench className="h-3 w-3" />
                        <span className="uppercase">{p.type.replace("tool-", "")}</span>
                        <span className="text-muted-foreground">{p.state}</span>
                      </div>
                      {p.output && (
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] text-muted-foreground">
                          {JSON.stringify(p.output, null, 2).slice(0, 2000)}
                        </pre>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> processando...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-[10px] text-destructive">
            <AlertTriangle className="h-3 w-3" /> {error.message}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex gap-2 border-t border-border/40 p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte ao agente (ex: 'estende licença X em 30 dias')..."
          disabled={busy}
          className="flex-1 font-mono text-xs"
        />
        <Button type="submit" disabled={busy || !input.trim()} size="sm" className="bg-neon/20 text-neon border border-neon/40 hover:bg-neon/30">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
