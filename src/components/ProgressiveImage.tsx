import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
}

export function ProgressiveImage({ src, alt, className, ...props }: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Reset states if src changes
  useEffect(() => {
    setIsLoaded(false);
    setError(false);
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden bg-muted/20", className)}>
      {!isLoaded && !error && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-primary/5 to-muted/20" />
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/10 text-muted-foreground/40 text-[10px] font-mono uppercase tracking-widest">
          Failed to load image
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={cn(
          "h-full w-full transition-all duration-700",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > 1) {
            setIsLoaded(true);
          }
        }}
        onError={() => setError(true)}
        {...props}
      />
    </div>
  );
}
