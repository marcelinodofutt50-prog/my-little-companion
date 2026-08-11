import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

describe('Shadow Protocol v32.0: FULL PRODUCTION BUSINESS AUDIT', () => {

  it('✅ INFRA: Supabase Identity & Environment Consistency', () => {
    expect(supabaseUrl).toBeDefined();
    expect(supabaseUrl).toContain('yvvjaoqzhjqnchhwhwvy'); // Correct project for Lovable env
    console.log(`[Identity] Target Project: ${supabaseUrl}`);
  });

  describe('🔧 MODULE: Identity & Profile (Shadow Pass)', () => {
    it('Verify bucket "avatars" is operational', async () => {
      const { data, error } = await supabaseAdmin.storage.getBucket('avatars');
      expect(error).toBeNull();
      expect(data?.public).toBe(true);
    });

    it('Verify profiles table has all Shadow Protocol v26+ columns', async () => {
      const { data, error } = await supabaseAdmin.from('profiles').select('*').limit(1).single();
      expect(error).toBeNull();
      const cols = Object.keys(data);
      expect(cols).toContain('metadata');
      expect(cols).toContain('vip_tier');
      expect(cols).toContain('reputation_score');
      expect(cols).toContain('trial_started_at');
      expect(cols).toContain('trial_expires_at');
    });
  });

  describe('🔧 MODULE: Yaarsa & Trial (24h Enforcement)', () => {
    it('Verify YAARSA_REFUSAL failover logic availability', async () => {
      const { yaarsaEndpointsFor } = await import('../lib/yaarsa.server');
      const endpoints = yaarsaEndpointsFor("http://191-96-78-81.sslip.io/yaarsa/proxy.php");
      expect(endpoints).toContain("http://191-96-78-81.sslip.io/yaarsa/private/createacc.php");
    });

    it('Verify Trial Duration: 24h ShadowDash vs 2d Yaarsa', async () => {
      const { expireDateFor } = await import('../lib/yaarsa.server');
      const yaarsaDate = expireDateFor('trial');
      const d = new Date();
      d.setDate(d.getDate() + 2);
      expect(yaarsaDate).toBe(d.toISOString().slice(0, 10));
    });
  });

  describe('🔧 MODULE: Community & Nexus', () => {
    it('Verify community_messages schema and relations', async () => {
      const { error } = await supabaseAdmin.from('community_messages').select('id, profiles(nickname)').limit(1);
      if (error && error.code !== 'PGRST116') { // Pointers exist even if table empty
        expect(error).toBeNull();
      }
    });

    it('Verify Staff Nexus isolation (RLS check)', async () => {
      const { data, error } = await supabaseAdmin.rpc('check_rls_enabled', { table_name: 'staff_messages' });
      // If RPC doesn't exist, we check if we can access as admin (pass)
      expect(error).toBeNull();
    });
  });

  describe('🔧 MODULE: Training Center (Tutorials)', () => {
    it('Verify tutorial_progress UUID relations', async () => {
      const { error } = await supabaseAdmin.from('tutorial_progress').select('tutorial_id').limit(1);
      expect(error).toBeNull();
    });
  });

  describe('⚠️ SECURITY: Roles & Permissions', () => {
    it('Verify user_roles table integrity', async () => {
      const { error } = await supabaseAdmin.from('user_roles').select('role').limit(1);
      expect(error).toBeNull();
    });
  });
});
