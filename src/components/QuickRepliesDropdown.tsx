import { useEffect, useRef, useState } from "react";
import { ChevronDown, MessageSquareText, Pencil, Plus, Trash2, X } from "lucide-react";

const STORAGE_KEY = "admin.chat.quickReplies.v1";

const DEFAULTS: { label: string; body: string }[] = [
  {
    label: "Boas-vindas",
    body: "Olá! Aqui é o suporte Shadow. Como posso te ajudar hoje?",
  },
  {
    label: "Aguardando pagamento",
    body: "Estamos aguardando a confirmação do PIX pelo Mercado Pago — assim que cair, a licença é liberada automaticamente (normalmente < 60s).",
  },
  {
    label: "Login entregue",
    body: "Prontinho! Seu login já está ativo no painel. Qualquer coisa, é só chamar aqui mesmo. 🔥",
  },
  {
    label: "Play Protect",
    body: "Envie o APK original em .apk (não .aab) que a gente processa e devolve com bypass em minutos.",
  },
  {
    label: "Reembolso 7d",
    body: "Você está dentro do prazo de garantia. Me confirma o motivo pra eu registrar e liberar o estorno via PIX?",
  },
  {
    label: "Fechar / resolvido",
    body: "Tudo certo então! Vou encerrar esse atendimento — se precisar de mais alguma coisa, é só mandar mensagem que abre um novo ticket. 👍",
  },
];

type Template = { label: string; body: string };

export function QuickRepliesDropdown({
  onPick,
}: {
  onPick: (body: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [templates, setTemplates] = useState<Template[]>(DEFAULTS);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Template[];
        if (Array.isArray(parsed) && parsed.length) setTemplates(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function persist(next: Template[]) {
    setTemplates(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Respostas rápidas (Ctrl+/)"
        className="flex items-center gap-1.5 rounded border border-cyan/40 bg-cyan/5 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan hover:bg-cyan/10"
      >
        <MessageSquareText className="h-3 w-3" />
        respostas
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-2 w-80 rounded-md border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-neon">
              // templates
            </span>
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="rounded p-1 text-muted-foreground hover:bg-background/50 hover:text-foreground"
              title={editing ? "Concluir" : "Editar"}
            >
              {editing ? <Check className="h-3.5 w-3.5 text-neon" /> : <Pencil className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {templates.map((t, i) => (
              <div
                key={`${t.label}-${i}`}
                className="group flex items-start gap-2 border-b border-border/30 px-3 py-2 last:border-b-0 hover:bg-background/40"
              >
                <button
                  type="button"
                  disabled={editing}
                  onClick={() => {
                    onPick(t.body);
                    setOpen(false);
                  }}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  {editing ? (
                    <>
                      <input
                        value={t.label}
                        onChange={(e) => {
                          const next = [...templates];
                          next[i] = { ...t, label: e.target.value };
                          persist(next);
                        }}
                        className="mb-1 w-full rounded border border-border/40 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] uppercase text-foreground"
                      />
                      <textarea
                        value={t.body}
                        onChange={(e) => {
                          const next = [...templates];
                          next[i] = { ...t, body: e.target.value };
                          persist(next);
                        }}
                        rows={2}
                        className="w-full rounded border border-border/40 bg-background/60 px-1.5 py-1 text-[11px] text-foreground"
                      />
                    </>
                  ) : (
                    <>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-cyan">
                        {t.label}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground group-hover:text-foreground">
                        {t.body}
                      </div>
                    </>
                  )}
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={() => persist(templates.filter((_, idx) => idx !== i))}
                    className="rounded p-1 text-destructive hover:bg-destructive/10"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
            {editing ? (
              <button
                type="button"
                onClick={() =>
                  persist([...templates, { label: "Novo template", body: "" }])
                }
                className="flex items-center gap-1 font-mono text-[10px] uppercase text-neon hover:underline"
              >
                <Plus className="h-3 w-3" /> adicionar
              </button>
            ) : (
              <span className="font-mono text-[9px] uppercase text-muted-foreground">
                clique para inserir · edite com o lápis
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditing(false);
              }}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
