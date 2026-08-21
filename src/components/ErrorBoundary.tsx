import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export function isChunkLoadError(error: Error | null | undefined): boolean {
  if (!error) return false;
  const text = `${error.name} ${error.message}`.toLowerCase();
  return (
    text.includes("importing a module script failed") ||
    text.includes("failed to fetch dynamically imported module") ||
    text.includes("error loading dynamically imported module") ||
    text.includes("chunkloaderror") ||
    text.includes("unable to preload css")
  );
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.name || "Global"}]:`, error, errorInfo);

    // Deploy novo no ar => os arquivos da versão antiga somem e o import falha.
    // Nesse caso recarregar resolve; fazemos isso uma única vez por sessão.
    if (isChunkLoadError(error) && typeof window !== "undefined") {
      const key = "shadow:boundary-chunk-reload";
      if (!window.sessionStorage.getItem(key)) {
        window.sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const chunkError = isChunkLoadError(this.state.error);

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-destructive/5 border border-destructive/20 rounded-lg my-4 space-y-4">
          <div className="p-3 bg-destructive/10 rounded-full text-destructive">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-destructive uppercase tracking-tighter font-mono">
              {chunkError ? "Nova versão disponível" : "Falha Crítica no Módulo"}
            </h3>
            <p className="text-sm text-muted-foreground font-mono max-w-md mx-auto">
              {chunkError ? (
                <>O site foi atualizado enquanto esta aba estava aberta. Recarregue a página para carregar a versão mais recente.</>
              ) : (
                <>
                  Ocorreu um erro inesperado no componente <span className="text-foreground">{`[${this.props.name || "Desconhecido"}]`}</span>.
                  O log técnico foi capturado para análise.
                </>
              )}
            </p>
          </div>
          {this.state.error && !chunkError && (
            <div className="p-3 bg-black/40 text-[10px] text-left font-mono overflow-auto max-h-40 w-full rounded border border-destructive/20 text-destructive/80">
              <span className="font-bold uppercase tracking-widest">[DEBUG_INFO]:</span>
              <pre className="mt-1 whitespace-pre-wrap">{`${this.state.error.name}: ${this.state.error.message}`}</pre>
              {this.state.error.stack && (
                <pre className="mt-2 text-[9px] opacity-60">{`${this.state.error.stack.split('\n').slice(0, 3).join('\n')}`}</pre>
              )}
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              if (chunkError && typeof window !== "undefined") {
                window.sessionStorage.removeItem("shadow:boundary-chunk-reload");
                window.location.reload();
                return;
              }
              this.setState({ hasError: false, error: null });
            }}
            className="font-mono text-[10px] uppercase tracking-widest border-destructive/30 hover:bg-destructive/10"
          >
            <RefreshCw className="h-3 w-3 mr-2" /> {chunkError ? "Recarregar página" : "Tentar Recuperação"}
          </Button>
        </div>
      );
    }


    return this.props.children;
  }
}
