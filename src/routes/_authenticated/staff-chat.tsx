import { createFileRoute } from '@tanstack/react-router';
import { Shield } from 'lucide-react';
import { StaffNexusChat } from '@/components/staff/StaffNexusChat';
import { BackToDashboard } from '@/components/BackToDashboard';

export const Route = createFileRoute('/_authenticated/staff-chat')({
  head: () => ({
    meta: [
      { title: 'Staff Nexus — Canal interno da equipe' },
      {
        name: 'description',
        content: 'Canal privado de comunicação da equipe Shadow: admin, suporte e moderação.',
      },
      { property: 'og:title', content: 'Staff Nexus — Canal interno da equipe' },
      {
        property: 'og:description',
        content: 'Canal privado de comunicação da equipe Shadow.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: StaffChatPage,
});

function StaffChatPage() {
  return (
    <div className="container mx-auto flex h-[calc(100vh-120px)] max-w-5xl flex-col p-4 md:p-8">
      <header className="mb-6 shrink-0 space-y-3">
        <BackToDashboard />
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl font-black uppercase italic tracking-tighter">
            <Shield className="h-8 w-8 text-primary" /> Staff{' '}
            <span className="text-primary underline">Nexus</span>
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // Secure Team Communication Channel
          </p>
        </div>
      </header>

      <StaffNexusChat className="flex-1" />
    </div>
  );
}
