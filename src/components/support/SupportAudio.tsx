import { useEffect, useRef, useState } from "react";
import { AudioLines, Loader2, Mic, Send, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const RECORDING_LIMIT_MS = 120_000;
const RECORDING_FORMATS = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];

type Capture = { stream: MediaStream; recorder?: MediaRecorder; timeout?: number };
function releaseCapture(capture: Capture) {
  window.clearTimeout(capture.timeout);
  capture.stream.getTracks().forEach((track) => track.stop());
  if (capture.recorder?.state === "recording") capture.recorder.stop();
}

export function SupportVoiceRecorder({ disabled, onSend }: {
  disabled: boolean;
  onSend: (file: File) => Promise<boolean>;
}) {
  const capture = useRef<Capture | null>(null);
  const mounted = useRef(false);
  const opening = useRef(false);
  const submitting = useRef(false);
  const [phase, setPhase] = useState<"idle" | "opening" | "recording" | "stopping">("idle");
  const [draft, setDraft] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const current = capture.current;
      capture.current = null;
      if (current) releaseCapture(current);
    };
  }, []);

  useEffect(() => {
    if (!draft) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(draft);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft]);

  async function start() {
    if (opening.current || capture.current || disabled || draft) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador não grava áudio aqui. Use o botão de anexar para enviar um arquivo.");
      return;
    }
    opening.current = true;
    setError(null);
    setPhase("opening");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const current: Capture = { stream };
      capture.current = current;
      const mimeType = RECORDING_FORMATS.find((format) => MediaRecorder.isTypeSupported(format));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      current.recorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = ({ data }) => {
        if (data.size > 0) chunks.push(data);
      };
      recorder.onstop = () => {
        releaseCapture(current);
        if (capture.current !== current || !mounted.current) return;
        capture.current = null;
        setPhase("idle");
        if (chunks.length === 0) {
          setError("Nenhum áudio foi gravado. Tente novamente.");
          return;
        }
        const sourceType = (recorder.mimeType || chunks[0].type).split(";")[0];
        const type = sourceType === "video/webm" ? "audio/webm" : sourceType === "video/mp4" ? "audio/mp4" : sourceType;
        const ext = type === "audio/mp4" ? "m4a" : type === "audio/ogg" ? "ogg" : "webm";
        setDraft(new File(chunks, "voz-" + crypto.randomUUID() + "." + ext, { type: type || "audio/webm" }));
      };
      recorder.onerror = () => {
        if (capture.current !== current) return;
        capture.current = null;
        releaseCapture(current);
        setPhase("idle");
        setError("Não foi possível gravar o áudio. Tente novamente ou anexe um arquivo.");
      };
      recorder.start();
      current.timeout = window.setTimeout(() => {
        if (recorder.state === "recording") {
          setPhase("stopping");
          recorder.stop();
        }
      }, RECORDING_LIMIT_MS);
      setPhase("recording");
    } catch {
      if (capture.current) releaseCapture(capture.current);
      capture.current = null;
      if (!mounted.current) return;
      setPhase("idle");
      setError("Não foi possível acessar o microfone. Confira a permissão ou anexe um arquivo.");
    } finally {
      opening.current = false;
    }
  }

  async function send() {
    if (!draft || disabled || submitting.current) return;
    submitting.current = true;
    try {
      const queued = await onSend(draft);
      if (mounted.current && queued) setDraft(null);
    } catch {
      if (mounted.current) setError("Não foi possível enviar o áudio. A gravação foi mantida.");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div className="relative shrink-0">
      <div className="flex items-center gap-2">
        <Button type="button" size="icon" variant="ghost"
          aria-label={phase === "recording" ? "Parar gravação" : "Gravar áudio"}
          title={phase === "recording" ? "Parar gravação" : "Gravar áudio"}
          disabled={phase === "opening" || phase === "stopping" || (phase === "idle" && (disabled || Boolean(draft)))}
          onClick={() => {
            if (phase === "recording" && capture.current?.recorder?.state === "recording") {
              setPhase("stopping");
              capture.current.recorder.stop();
            } else {
              void start();
            }
          }}>
          {phase === "recording" ? <Square aria-hidden="true" className="h-4 w-4 fill-current text-destructive" /> :
            phase === "opening" || phase === "stopping" ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> :
            <Mic aria-hidden="true" className="h-4 w-4" />}
        </Button>
        {phase === "recording" && <span role="status" className="absolute bottom-full z-10 mb-2 w-max rounded-md border bg-card px-2 py-1 text-xs text-destructive">Gravando · até 2 min</span>}
      </div>
      {draft && previewUrl && (
        <div data-sensitive className="absolute bottom-full z-10 mb-2 w-52 max-w-[60vw] space-y-2 rounded-lg border border-border bg-card p-2 shadow-md">
          <audio controls src={previewUrl} aria-label="Prévia da gravação" className="block h-9 w-full min-w-0" />
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" disabled={disabled} onClick={() => void send()}><Send aria-hidden="true" /> Enviar áudio</Button>
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setDraft(null)}><X aria-hidden="true" /> Descartar</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="absolute bottom-full z-10 mb-2 w-52 max-w-[60vw] rounded-md border bg-card p-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function SupportAudioMessage({ url }: { url: string }) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);

  return (
    <div data-sensitive className="mt-2 w-72 max-w-full space-y-2 rounded-xl border border-border bg-card p-2.5 text-card-foreground">
      <p className="flex items-center gap-2 text-xs font-semibold"><AudioLines aria-hidden="true" className="h-4 w-4 text-primary" /> Mensagem de voz</p>
      {brokenUrl === url ? (
        <p className="text-xs text-muted-foreground">Não foi possível reproduzir. <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Abrir arquivo</a></p>
      ) : (
        <audio key={url} src={url} controls preload="none" aria-label="Reproduzir mensagem de voz" className="block h-10 w-full min-w-0" onError={() => setBrokenUrl(url)} />
      )}
    </div>
  );
}
