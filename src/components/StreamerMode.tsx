import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Modo Streamer: borra automaticamente e-mails, IPs, telefones, chaves Pix,
 * senhas e qualquer elemento marcado com data-sensitive. Liga/desliga pelo
 * botão flutuante ou Ctrl+Shift+S. Fica salvo no navegador.
 */
const KEY = "shadow:streamer-mode";
const PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, // e-mail
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/, // IP
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, // CPF
  /\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/, // telefone
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // chaves/ids
];
const CLS = "streamer-blur";

function sensitive(text: string) {
  return PATTERNS.some((r) => r.test(text));
}

function scan(root: ParentNode) {
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const el = n.parentElement;
    if (el && !el.classList.contains(CLS) && n.nodeValue && sensitive(n.nodeValue)) el.classList.add(CLS);
  }
  (root as Element).querySelectorAll?.("input, textarea").forEach((i) => {
    const el = i as HTMLInputElement;
    const flag = el.type === "password" || el.type === "email" || sensitive(el.value || "");
    el.classList.toggle(CLS, flag);
  });
}

export function StreamerMode() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    try { setOn(localStorage.getItem(KEY) === "1"); } catch { /* */ }
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
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    const onInput = () => scan(document.body);
    document.addEventListener("input", onInput, true);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
      document.removeEventListener("input", onInput, true);
    };
  }, [on]);

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      title="Modo Streamer (Ctrl+Shift+S)"
      aria-pressed={on}
      className={`fixed bottom-4 left-4 z-[95] inline-flex items-center gap-2 rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-widest shadow-lg backdrop-blur transition ${on ? "border-primary bg-primary/15 text-primary" : "border-border bg-card/80 text-muted-foreground hover:text-foreground"}`}
    >
      {on ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      {on ? "Streamer ON" : "Streamer"}
    </button>
  );
}
