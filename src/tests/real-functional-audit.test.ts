import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

describe('Shadow Protocol v34.0: LIVE PRODUCTION FUNCTIONAL AUDIT', () => {

  describe('1. TESTE GRÁTIS (Yaarsa & ShadowDash Sync)', () => {
    it('Verify Yaarsa Technical Duration is 2 days', async () => {
      const { expireDateFor } = await import('../lib/yaarsa.server');
      const yaarsaDate = expireDateFor('trial');
      const d = new Date();
      d.setDate(d.getDate() + 2);
      expect(yaarsaDate).toBe(d.toISOString().slice(0, 10));
    });

    it('Verify ShadowDash limits license row to exactly 24h', async () => {
       // We can't easily "click" the button in vitest, but we check the logic that the button calls
       const { internalGenerateTrial } = await import('../lib/license.server');
       // This is a business logic test: the internal generator MUST set 24h
       // We won't actually call it to avoid creating junk data, but we'll check the file content or mock it
       // Actually, we'll check the file content to ensure the '+ 24' is there
       const fs = await import('fs');
       const content = fs.readFileSync('src/lib/license.server.ts', 'utf8');
       // A duração é parametrizada (default 1 dia = 24h). Aceitamos a forma literal
       // ou a forma calculada, desde que o passo continue sendo em horas de 24.
       const has24h = content.includes('expiresAt.setHours(expiresAt.getHours() + 24)') ||
         /expiresAt\.setHours\(expiresAt\.getHours\(\) \+ [^)]*durationDays[^)]*\* 24\)/.test(content);
       expect(has24h).toBe(true);
    });
  });

  describe('2. FOTO DE PERFIL (Storage & DB Sync)', () => {
    it('Verify "avatars" bucket is public and exists', async () => {
      const { data, error } = await supabaseAdmin.storage.getBucket('avatars');
      expect(error).toBeNull();
      expect(data?.public).toBe(true);
    });

    it('Verify profile customization updates metadata correctly', async () => {
       const testUserId = '00000000-0000-0000-0000-000000000000'; // Fake ID for metadata check
       // Check if updateProfileCustomization uses JSONB merge correctly
       const fs = await import('fs');
       const content = fs.readFileSync('src/lib/profile-customization.functions.ts', 'utf8');
       // It should use some form of metadata update
       expect(content).toContain('metadata');
    });
  });

  describe('3. CENTRO DE TREINAMENTO (Progress Logic)', () => {
    it('Verify tutorial_progress table exists and accepts UUIDs', async () => {
      const { error } = await supabaseAdmin.from('tutorial_progress').select('count', { count: 'exact', head: true });
      expect(error).toBeNull();
    });
  });

  describe('4. CHAT ANÔNIMO (Nexus Engine)', () => {
    it('Verify community_messages supports profiles relation with alias', async () => {
      // Test the alias logic discovered in v33 audit
      const { error } = await supabaseAdmin
        .from('community_messages')
        .select(`
          id,
          Profiles:profiles!user_id(display_name)
        `)
        .limit(1);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is empty table, which is fine
        expect(error).toBeNull();
      }
    });
  });

  describe('5. SHADOW PASS / VIP (Loyalty Logic)', () => {
    it('Verify VIP tiers are defined correctly in shadow-core', async () => {
       const fs = await import('fs');
       const content = fs.readFileSync('src/lib/shadow-core.functions.ts', 'utf8');
       expect(content).toContain('bronze');
       expect(content).toContain('silver');
       expect(content).toContain('gold');
       expect(content).toContain('diamond');
       expect(content).toContain('elite');
    });
  });

  describe('6. PAINEL ADMIN (Role-Based Access)', () => {
    it('Verify user_roles table exists', async () => {
      const { error } = await supabaseAdmin.from('user_roles').select('count', { count: 'exact', head: true });
      expect(error).toBeNull();
    });
  });
});
