import { useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";

// Synthesize a thunder clap with WebAudio (no external asset needed)
function playThunder() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const duration = 1.6;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // brown-ish noise with envelope
      const t = i / bufferSize;
      const env = Math.pow(1 - t, 2.2);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;

    const gain = ctx.createGain();
    gain.gain.value = 0.6;

    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    src.onended = () => ctx.close();
  } catch {
    /* ignore */
  }
}

export function KrakenTab({ onNavigate }: { onNavigate?: () => void }) {
  const [flash, setFlash] = useState(false);

  const trigger = useCallback(() => {
    setFlash(true);
    playThunder();
    if (onNavigate) onNavigate();
    setTimeout(() => setFlash(false), 900);
  }, [onNavigate]);


  return (
    <>
      <Link
        to="/servidor/kraken"
        onClick={trigger}
        className="relative font-mono text-[11px] uppercase tracking-[0.2em] outline-none"
      >
        <span
          className="bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent font-bold"
          style={{
            backgroundSize: "300% 100%",
            animation: "kraken-rgb 4s linear infinite",
          }}
        >
          Kraken
        </span>
        <style>{`
          @keyframes kraken-rgb {
            0% { background-position: 0% 50%; }
            100% { background-position: 300% 50%; }
          }
        `}</style>
      </Link>

      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.2, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, times: [0, 0.1, 0.25, 0.4, 1] }}
            className="pointer-events-none fixed inset-0 z-[100] bg-white mix-blend-screen"
          >
            <svg
              viewBox="0 0 200 400"
              className="absolute left-1/2 top-0 h-full -translate-x-1/2"
              fill="none"
            >
              <motion.path
                d="M110 0 L70 160 L120 170 L60 400"
                stroke="#e0f2ff"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="drop-shadow(0 0 12px #67e8f9) drop-shadow(0 0 24px #a855f7)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
