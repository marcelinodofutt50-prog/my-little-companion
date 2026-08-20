import { createFileRoute } from '@tanstack/react-router';
import { GraduationCap } from 'lucide-react';
import { StaffAcademyPanel } from '@/components/staff/StaffAcademyPanel';
import { BackToDashboard } from '@/components/BackToDashboard';

export const Route = createFileRoute('/_authenticated/staff-academy')({
  head: () => ({
    meta: [
      { title: 'Academia da Equipe — Treinamento interno Shadow' },
      {
        name: 'description',
        content:
          'Centro de treinamento interno da equipe Shadow: onboarding, atendimento, licenças e segurança para admin, suporte e moderação.',
      },
      { property: 'og:title', content: 'Academia da Equipe — Treinamento interno Shadow' },
      {
        property: 'og:description',
        content: 'Treinamento interno exclusivo para a equipe Shadow.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: StaffAcademyPage,
});

function StaffAcademyPage() {
  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-8">
      <header className="mb-6 space-y-3">
        <BackToDashboard />
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl font-black uppercase italic tracking-tighter">
            <GraduationCap className="h-8 w-8 text-primary" /> Academia da{' '}
            <span className="text-primary underline">Equipe</span>
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // Internal Staff Training — Admin / Suporte / Moderação
          </p>
        </div>
      </header>

      <StaffAcademyPanel />
    </div>
  );
}
