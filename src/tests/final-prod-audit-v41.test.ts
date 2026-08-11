import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const PROD_URL = process.env.VITE_SUPABASE_URL || "https://yvvjaoqzhjqnchhwhwvy.supabase.co";
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(PROD_URL, PROD_KEY);

describe('Shadow Protocol v41.0: FINAL BUSINESS AUDIT', () => {

  it('✅ IDENTITY: Project is yvvjaoqzhjqnchhwhwvy', () => {
    expect(PROD_URL).toContain("yvvjaoqzhjqnchhwhwvy");
  });

  describe('🔧 MODULE: Identity & Storage', () => {
    it('avatars bucket is public', async () => {
      const { data, error } = await supabase.storage.getBucket('avatars');
      expect(error).toBeNull();
      expect(data?.public).toBe(true);
    });

    it('tutorials bucket exists', async () => {
      const { data, error } = await supabase.storage.getBucket('tutorials');
      expect(error).toBeNull();
    });
  });

  describe('🔧 MODULE: Schema Integrity (Profiles & Trials)', () => {
    it('profiles table has trial_started_at and trial_expires_at', async () => {
      const { data, error } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
      expect(error).toBeNull();
      if (data) {
        const cols = Object.keys(data);
        expect(cols).toContain('trial_started_at');
        expect(cols).toContain('trial_expires_at');
        expect(cols).toContain('metadata');
        expect(cols).toContain('vip_tier');
        expect(cols).toContain('reputation_score');
      }
    });

    it('community_messages table is accessible', async () => {
      const { error } = await supabase.from('community_messages').select('id').limit(1);
      // PGRST116 (0 rows) is fine, PGRST204/205/42P01 (Missing) is NOT.
      if (error) {
        expect(['PGRST116', 'PGRST108']).toContain(error.code);
      }
    });
  });

  describe('🔧 MODULE: Play Protect 7D Benefit', () => {
    it('play_protect_grants table exists', async () => {
      const { error } = await supabase.from('play_protect_grants').select('id').limit(1);
      if (error) {
        expect(['PGRST116', 'PGRST108']).toContain(error.code);
      }
    });

    it('has_active_play_protect RPC exists', async () => {
      // We check if we can call it (it should return false for a random UUID)
      const randomId = '00000000-0000-0000-0000-000000000000';
      const { data, error } = await supabase.rpc('has_active_play_protect', { _user_id: randomId });
      expect(error).toBeNull();
      expect(typeof data).toBe('boolean');
    });
  });

  describe('🔧 MODULE: Training & Progress', () => {
    it('tutorial_progress is accessible', async () => {
      const { error } = await supabase.from('tutorial_progress').select('id').limit(1);
      if (error) {
        expect(['PGRST116', 'PGRST108']).toContain(error.code);
      }
    });
  });

});
