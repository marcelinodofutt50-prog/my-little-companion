import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// We use the EXT_SUPABASE_ prefixed variables if they exist in process.env
const PROD_URL = process.env.EXT_SUPABASE_URL || "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
const PROD_KEY = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(PROD_URL, PROD_KEY);

describe('Shadow Protocol v37.1: EXTERNAL PRODUCTION BANK VALIDATION', () => {

  it(`Confirming Target Project Identity: ${PROD_URL}`, () => {
    expect(PROD_URL).toContain("dvnksmqbpbzwgwmbnjjy");
  });

  it('avatars bucket exists and is public', async () => {
    const { data, error } = await supabase.storage.getBucket('avatars');
    if (error) console.error('storage error:', error);
    expect(error).toBeNull();
    expect(data?.public).toBe(true);
  });

  it('profiles columns exist (trial_started_at)', async () => {
    const { error } = await supabase.from('profiles').select('trial_started_at, trial_expires_at').limit(1);
    if (error) console.error('profiles column error:', error);
    expect(error).toBeNull();
  });

  it('community_messages table exists in schema cache', async () => {
    const { error } = await supabase.from('community_messages').select('id').limit(1);
    if (error) console.error('community_messages error:', error);
    expect(error).toBeNull();
  });

});
