import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getServerNow } from "@/lib/server-time.functions";

/**
 * Retorna o timestamp atual (ms) corrigido pelo offset entre o relógio do
 * servidor e o do navegador. Atualiza a cada `tickMs` para manter countdowns
 * vivos e re-sincroniza periodicamente com o servidor.
 */
export function useServerNow(tickMs = 30_000): number {
  const fetchNow = useServerFn(getServerNow);
  const offsetRef = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const sync = async () => {
      try {
        const t0 = Date.now();
        const res = await fetchNow();
        if (!alive || !res?.now) return;
        const rtt = Date.now() - t0;
        const server = new Date(res.now).getTime() + rtt / 2;
        if (Number.isFinite(server)) {
          offsetRef.current = server - Date.now();
          setNow(Date.now() + offsetRef.current);
        }
      } catch {
        /* mantém o relógio local se o servidor não responder */
      }
    };
    void sync();
    const resync = setInterval(sync, 5 * 60_000);
    const tick = setInterval(() => setNow(Date.now() + offsetRef.current), tickMs);
    return () => {
      alive = false;
      clearInterval(resync);
      clearInterval(tick);
    };
  }, [fetchNow, tickMs]);

  return now;
}
