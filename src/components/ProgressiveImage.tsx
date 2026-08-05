import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ImageOff, ShieldAlert } from "lucide-react";

const GLOBAL_FALLBACK_URL = "/assets/shadow-dashboard-real.png";
const FALLBACK_LOGO_URL = "/assets/shadow-logo-v10.png";

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  fallbackText?: string;
}

export function ProgressiveImage({ src, alt, className, fallbackText, loading = "lazy", ...props }: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setError(true);
      return;
    }
    
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setIsLoaded(true);
      setError(false);
    };
    
    img.onerror = () => {
      setError(true);
      setIsLoaded(false);
      console.warn(`[ProgressiveImage] Failed to load: ${src}`);
    };
    
    if (img.complete) {
      if (img.naturalWidth > 0) {
        setIsLoaded(true);
        setError(false);
      } else {
        setError(true);
        setIsLoaded(false);
      }
    }
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden bg-muted/5", className)}>
      {!isLoaded && !error && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-primary/5 to-muted/20 z-0" />
      )}
      
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/10 text-muted-foreground/40 p-4 text-center z-20">
          <ImageOff className="h-6 w-6 mb-2 opacity-20" />
          <span className="text-[10px] font-mono uppercase tracking-widest leading-tight">
            {fallbackText || "Asset Missing"}
          </span>
          <span className="mt-1 text-[8px] opacity-30 font-mono">404_NOT_FOUND</span>
        </div>
      )}

      <img
        src={src}
        alt={alt}
        className={cn(
          "relative h-full w-full transition-all duration-700 z-10",
          isLoaded ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-105 blur-lg"
        )}
        onLoad={() => {
          setIsLoaded(true);
          setError(false);
        }}
        onError={() => {
          setError(true);
          setIsLoaded(false);
        }}
        {...props}
      />
    </div>
  );
}
