import shadowMask from "@/assets/shadow-mask.png";

/** Anonymous-style mascot: masked gentleman in a top hat with a single glowing eye.
 *  Evokes the "your shadow everywhere" tagline — mysterious, elegant, thief-gentleman. */
export function ShadowLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`${className} relative inline-flex items-center justify-center`}>
      <div
        className="pointer-events-none absolute inset-0 rounded-full blur-md opacity-60"
        style={{ background: "radial-gradient(circle, oklch(0.78 0.16 85 / 0.35), transparent 65%)" }}
        aria-hidden
      />
      <img
        src={shadowMask}
        alt="Shadow — mascote"
        loading="lazy"
        width={128}
        height={128}
        className="relative h-full w-full object-contain drop-shadow-[0_0_8px_oklch(0.78_0.16_85/0.55)]"
      />
    </div>
  );
}

export function ShadowWordmark() {
  return (
    <div className="flex items-center gap-2">
      <ShadowLogo className="h-10 w-10" />
      <div className="leading-none">
        <div className="font-mono text-lg font-bold tracking-widest text-neon">SHADOW</div>
        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">your shadow everywhere</div>
      </div>
    </div>
  );
}
