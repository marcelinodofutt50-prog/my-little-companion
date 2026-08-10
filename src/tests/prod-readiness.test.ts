import { test, expect } from 'vitest';

test('Production Readiness Audit', async () => {
  // 1. Audit Environment Variables
  const requiredEnv = [
    'SUPABASE_URL', 
    'SUPABASE_SERVICE_ROLE_KEY', 
    'SUPABASE_PUBLISHABLE_KEY'
  ];
  
  for (const env of requiredEnv) {
    expect(process.env[env], `Ambiente Vercel: Variável ${env} ausente`).toBeDefined();
    expect(process.env[env]?.length, `Ambiente Vercel: Variável ${env} está vazia`).toBeGreaterThan(0);
  }

  // 2. Audit Site URL Consistency
  const siteUrl = process.env.VITE_SITE_URL || 'https://www.shadowdashstore.com';
  expect(siteUrl, 'VITE_SITE_URL deve apontar para o domínio oficial').toContain('shadowdashstore.com');

  // 3. Audit Admin Tunnel capability
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    expect(supabaseAdmin, 'Admin Tunnel (supabaseAdmin) deve ser instanciável').toBeDefined();
  } catch (e) {
    throw new Error('Falha ao instanciar Admin Tunnel para bypass de PostgREST');
  }
});
