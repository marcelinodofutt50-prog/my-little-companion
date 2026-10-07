import { createFileRoute } from '@tanstack/react-router';
import { performHealthCheck } from '@/lib/health.functions';

export const Route = createFileRoute('/api/public/health')({
  server: {
    handlers: {
      GET: async () => {
        try {
          // performHealthCheck requires no input and uses supabaseAdmin internally
          const health = await performHealthCheck();
          
          const status = health.database.status === 'healthy' ? 200 : 503;
          
          const { ORDER_INTEGRITY_VERSION } = await import('@/lib/order-integrity.server');
          return new Response(JSON.stringify({
            status: health.database.status,
            timestamp: health.timestamp,
            details: health.database.message,
            tables: health.tables,
            // Versão publicada (para confirmar que a última correção está no ar).
            commit: (process.env['VERCEL_GIT_COMMIT_SHA'] ?? '').slice(0, 7) || null,
            checkout_version: ORDER_INTEGRITY_VERSION,
            repair_version: "reparo-v5-status-e-ip",
          }), {
            status,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store'
            }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({
            status: 'critical',
            error: error.message
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
      }
    }
  }
});