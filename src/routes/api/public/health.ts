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
          
          return new Response(JSON.stringify({
            status: health.database.status,
            timestamp: health.timestamp,
            details: health.database.message,
            tables: health.tables
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