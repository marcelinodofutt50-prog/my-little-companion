import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Canais oficiais da comunidade. */
export const SOCIAL_LINKS = {
  discord: "Callionis",
  telegram: "https://t.me/+P9mnL_5-_Sw0ZTcx",
};

function DiscordIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={props.className}>
      <path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18.2 18.2 0 0 0-5.6 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.8 19.8 0 0 0 6 3l1.3-2a12.8 12.8 0 0 1-2-1l.5-.4a14.1 14.1 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.7 19.7 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.7ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
    </svg>
  );
}

function TelegramIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={props.className}>
      <path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2l-11 6.9-4.7-1.5c-1-.3-1-1 .2-1.5L20.6 3c.9-.3 1.6.2 1.3 1.3Z" />
    </svg>
  );
}

export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Copiar usuário do Discord: Callionis"
        title="Discord: Callionis — copiar usuário"
        className="h-7 w-7 rounded-full border border-sidebar-border text-muted-foreground hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary"
        onClick={async () => {
          await navigator.clipboard.writeText(SOCIAL_LINKS.discord);
          toast.success("Discord copiado: Callionis");
        }}
      >
        <DiscordIcon className="h-3.5 w-3.5" />
      </Button>
      <Button asChild size="icon" variant="ghost" className="h-7 w-7 rounded-full border border-sidebar-border text-muted-foreground hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary">
        <a href={SOCIAL_LINKS.telegram} target="_blank" rel="noopener noreferrer" aria-label="Abrir Telegram" title="Telegram oficial">
          <TelegramIcon className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  );
}
