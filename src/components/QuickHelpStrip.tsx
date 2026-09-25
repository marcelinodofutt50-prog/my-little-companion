import { useState } from "react";
import { Smartphone, Wifi, Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Topic = "login" | "network" | "device";

const CONTENT: Record<Topic, { title: string; body: string[] }> = {
  login: {
    title: "Não consegue logar?",
    body: [
      "Use o botão \"Reparar acesso\" no card da sua licença, logo abaixo. Ele confere e recria seu login no painel em segundos.",
      "Dica: use o botão Copiar em vez de digitar usuário e senha — um único dígito errado já impede o login.",
    ],
  },
  network: {
    title: "Apareceu \"network error\"?",
    body: [
      "No app da BTmob, \"network error\" é uma mensagem genérica. Nem sempre é internet ou servidor.",
      "Ao entrar: se o usuário ou a senha tiver um dígito errado, o app mostra network error em vez de \"senha incorreta\". Confira e, se precisar, use \"Reparar acesso\".",
      "Ao gerar o APK: confira se marcou todas as permissões (e as caixinhas do lado), se escolheu a imagem do aplicativo e se preencheu a etiqueta (tag). Faltando qualquer item, aparece network error.",
    ],
  },
  device: {
    title: "Funciona em qualquer celular?",
    body: [
      "Nem todo celular ou conexão é compatível com a BTmob. Alguns aparelhos, versões de Android ou redes simplesmente não suportam o uso.",
      "Quando isso acontece, não é um problema do nosso servidor. Teste em outro aparelho ou outra rede antes de abrir um chamado.",
    ],
  },
};

export function QuickHelpStrip() {
  const [topic, setTopic] = useState<Topic | null>(null);
  const cards: { id: Topic; icon: typeof Wrench; label: string; hint: string }[] = [
    { id: "login", icon: Wrench, label: "Não consegue logar?", hint: "Use o Reparar acesso" },
    { id: "network", icon: Wifi, label: "Network error?", hint: "Veja o que conferir" },
    { id: "device", icon: Smartphone, label: "Celular não funciona?", hint: "Compatibilidade" },
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              if (c.id === "login") {
                const el = document.querySelector("[data-repair-callout]");
                if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
              }
              setTopic(c.id);
            }}
            className="group enterprise-surface flex items-center gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: `${i * 90}ms`, animationFillMode: "both" }}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <c.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{c.label}</span>
              <span className="block font-mono text-[10px] uppercase text-muted-foreground">{c.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <Dialog open={!!topic} onOpenChange={(o) => !o && setTopic(null)}>
        <DialogContent>
          {topic && (
            <>
              <DialogHeader><DialogTitle>{CONTENT[topic].title}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm text-muted-foreground">
                {CONTENT[topic].body.map((p) => <p key={p}>{p}</p>)}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
