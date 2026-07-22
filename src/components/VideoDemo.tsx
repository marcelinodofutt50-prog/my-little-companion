import { Play, Clock, Zap, Shield } from "lucide-react";
import { useState } from "react";

// TODO: substituir por ID real do YouTube quando o vídeo estiver publicado.
// Ex: "dQw4w9WgXcQ" — deixe vazio para exibir apenas o poster/placeholder.
const YOUTUBE_ID = "";

export function VideoDemo() {
  const [playing, setPlaying] = useState(false);

  return (
    <section className="border-t border-border py-20">
      <div className="grid gap-10 md:grid-cols-2 md:items-center">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan">
            // demonstração
          </div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            Veja a Shadow em <span className="italic text-cyan">ação</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Tour rápido de 90 segundos mostrando como comprar, ativar a licença e usar
            os módulos principais da v4.6. Sem edições fake, gravado direto no painel real.
          </p>
          <div className="mt-6 grid gap-3">
            <Feature icon={Clock} label="Compra → login em menos de 60 segundos" />
            <Feature icon={Zap} label="Bypass Play Protect ativo desde o primeiro boot" />
            <Feature icon={Shield} label="Credenciais criptografadas AES-256-GCM" />
          </div>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black shadow-2xl">
          {YOUTUBE_ID && playing ? (
            <iframe
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1&rel=0`}
              title="Shadow — Demonstração"
              allow="accelerated-sensors; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => YOUTUBE_ID && setPlaying(true)}
              className="group relative flex h-full w-full items-center justify-center"
              aria-label="Reproduzir demonstração"
            >
              {/* Poster gerado por CSS (grid + gradient) — placeholder até publicar o vídeo */}
              <div
                className="absolute inset-0 opacity-70"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 30%, hsl(var(--neon)/0.4), transparent 45%), radial-gradient(circle at 80% 70%, hsl(var(--violet)/0.35), transparent 45%), linear-gradient(135deg, #0a0a12 0%, #050508 100%)",
                }}
              />
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-neon bg-background/80 backdrop-blur transition-all group-hover:scale-110 glow-neon">
                  <Play className="ml-1 h-8 w-8 fill-neon text-neon" />
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-neon">
                  {YOUTUBE_ID ? "Assistir · 1min 30s" : "Vídeo em breve · 1min 30s"}
                </div>
              </div>
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-md border border-border bg-background/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon" />
                Live preview do painel
              </div>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Feature({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card/40 px-4 py-3">
      <Icon className="h-4 w-4 text-neon" />
      <span className="text-sm text-foreground/90">{label}</span>
    </div>
  );
}
