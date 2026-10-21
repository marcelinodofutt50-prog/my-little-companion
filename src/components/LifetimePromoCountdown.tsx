import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Clock3 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useMoney } from '@/lib/currency';
import { LIFETIME_PROMO_PRICE_BRL, lifetimePromoClock, lifetimePromoRemainingMs } from '@/lib/lifetime-countdown';

export function LifetimePromoCountdown() {
  const [now, setNow] = useState<number | null>(null);
  const { lang } = useI18n();
  const { fmt } = useMoney();
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (now === null) return null;
  const remaining = lifetimePromoRemainingMs(now);
  if (remaining === 0) return null;
  return (
    <div className="border-b border-primary/20 bg-background text-primary" data-testid="lifetime-promo-countdown">
      <Link to="/planos" className="mx-auto flex min-h-8 max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-3 py-1 font-mono text-[10px] sm:text-[11px]">
        <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{lang === 'en' ? 'Lifetime' : 'Vitalício'} · {fmt(LIFETIME_PROMO_PRICE_BRL)}</span>
        <span className="text-muted-foreground">{lang === 'en' ? 'Ends in' : 'Acaba em'}</span>
        <span className="whitespace-nowrap tabular-nums text-foreground">{lifetimePromoClock(remaining)}</span>
      </Link>
    </div>
  );
}