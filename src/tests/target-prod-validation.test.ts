import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { TARGET_URL, TARGET_SERVICE } from "./target-backend";

const PROD_URL = TARGET_URL;
const PROD_KEY = TARGET_SERVICE;
const supabase = createClient(PROD_URL, PROD_KEY);

describe('Shadow Protocol v37.2: FINAL PRODUCTION BANK VALIDATION', () => {

  it(`Confirming Target Project Identity: ${PROD_URL}`, () => {
    expect(PROD_URL).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co/);
  });

  it('avatars bucket exists and is public', async () => {
    const { data, error } = await supabase.storage.getBucket('avatars');
    expect(error).toBeNull();
    expect(data?.public).toBe(true);
  });

  it('profiles columns exist (trial_started_at)', async () => {
    // If the bank does not have it, this will fail.
    // The user needs to confirm if they have manually fixed it or if I should retry differently.
    const { error } = await supabase.from('profiles').select('trial_started_at').limit(1);
    expect(error).toBeNull();
  });

});
