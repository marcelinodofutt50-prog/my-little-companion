import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const PROD_URL = "https://dvnksmqbpbzwgwmbnjjy.supabase.co";
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(PROD_URL, PROD_KEY);

describe('Shadow Protocol v37.0: REAL PRODUCTION BANK VALIDATION (dvnksmqbpbzwgwmbnjjy)', () => {

  it('avatars bucket exists and is public', async () => {
    const { data, error } = await supabase.storage.getBucket('avatars');
    expect(error).toBeNull();
    expect(data?.public).toBe(true);
  });

  it('profiles.trial_started_at column exists', async () => {
    // We check for columns by selecting them. If PostgREST 400s or 404s, they don't exist.
    const { error } = await supabase.from('profiles').select('trial_started_at, trial_expires_at').limit(1);
    if (error) {
      console.error('profiles column error:', error);
    }
    expect(error).toBeNull();
  });

  it('community_messages table exists in schema cache', async () => {
    const { error } = await supabase.from('community_messages').select('id').limit(1);
    if (error) {
      console.error('community_messages error:', error);
    }
    expect(error).toBeNull();
  });

  it('tutorial_progress table exists in schema cache', async () => {
    const { error } = await supabase.from('tutorial_progress').select('id').limit(1);
    if (error) {
       console.error('tutorial_progress error:', error);
    }
    expect(error).toBeNull();
  });

});
