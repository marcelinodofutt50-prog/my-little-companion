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

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => setIsLoaded(true);
    img.onerror = () => setError(true);
    
    if (img.complete && img.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden bg-muted/20", className)}>
      {!isLoaded && !error && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-primary/5 to-muted/20 z-0" />
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/10 text-muted-foreground/40 text-[10px] font-mono uppercase tracking-widest z-0">
          Failed to load image
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={cn(
          "relative h-full w-full transition-opacity duration-500 z-10",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setIsLoaded(true)}
        onError={() => setError(true)}
        {...props}
      />
    </div>
  );
}
