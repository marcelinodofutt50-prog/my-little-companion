import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { containsPrivateData } from "@/lib/privacy-patterns";

/**
 * Modo Streamer: borra automaticamente e-mails, IPs, telefones, chaves Pix,
 * senhas e qualquer elemento marcado com data-sensitive. Liga/desliga pelo
 * botão flutuante ou Ctrl+Shift+S. Fica salvo no navegador.
 */
const KEY = "shadow:streamer-mode";
const CLS = "streamer-blur";

function scan(root: ParentNode) {
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const el = n.parentElement;
    if (!el || el.closest("script, style, [data-streamer-safe]")) continue;
    if (n.nodeValue && containsPrivateData(n.nodeValue)) el.classList.add(CLS);
  }
  (root as Element).querySelectorAll?.("input, textarea").forEach((i) => {
    const el = i as HTMLInputElement;
    const flag = el.type === "password" || el.type === "email" || el.hasAttribute("data-sensitive") || /password|senha|token|pin|secret|cpf/i.test(`${el.name} ${el.id} ${el.autocomplete}`) || containsPrivateData(el.value || "");
    el.classList.toggle(CLS, flag);
  });
}

export function StreamerMode() {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setOn(localStorage.getItem(KEY) === "1"); } catch { /* */ }
    setReady(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setOn((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* */ }
    const html = document.documentElement;
    html.classList.toggle("streamer-mode", on);
    if (!on) {
      document.querySelectorAll(`.${CLS}`).forEach((e) => e.classList.remove(CLS));
      return;
    }
    scan(document.body);
    let raf = 0;
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => scan(document.body));
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["value", "type", "data-sensitive", "src"] });
    const onInput = () => scan(document.body);
    document.addEventListener("input", onInput, true);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
      document.removeEventListener("input", onInput, true);
      html.classList.remove("streamer-mode");
    };
  }, [on, ready]);

  return (
    <Button
      type="button"
      onClick={() => setOn((v) => !v)}
      title="Modo Streamer (Ctrl+Shift+S)"
      aria-label={on ? "Desativar modo streamer" : "Ativar modo streamer"}
      data-streamer-safe
      variant="outline"
      aria-pressed={on}
      className={`fixed bottom-4 left-4 z-[95] inline-flex items-center gap-2 rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-widest shadow-lg backdrop-blur transition ${on ? "border-primary bg-primary/15 text-primary" : "border-border bg-card/80 text-muted-foreground hover:text-foreground"}`}
    >
      {on ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      {on ? "Streamer ON" : "Streamer"}
    </Button>
  );
}
