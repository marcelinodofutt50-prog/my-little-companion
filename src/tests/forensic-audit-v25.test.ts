import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

describe('Shadow Protocol v25.0: Forensic Production Audit', () => {
  console.log(`[Forensic Audit] Connecting to: ${supabaseUrl}`);


  it('1. FOTO DE PERFIL: Verify bucket "avatars" exists and is public', async () => {
    const { data, error } = await supabaseAdmin.storage.getBucket('avatars');
    if (error) console.error("Bucket 'avatars' error:", error);
    expect(error).toBeNull();
    expect(data?.public).toBe(true);
  });

  it('2. CENTRO DE TREINAMENTO: Verify "tutorial_progress" accessibility', async () => {
    const { error } = await supabaseAdmin.from('tutorial_progress').select('*').limit(1);
    if (error) console.error("Table 'tutorial_progress' error:", error);
    expect(error).toBeNull();
  });

  it('3. CHAT ANÔNIMO: Verify "community_messages" exists and has relations', async () => {
    const { error } = await supabaseAdmin
      .from('community_messages')
      .select('id, profiles(display_name)')
      .limit(1);
    if (error) console.error("Table 'community_messages' error:", error);
    expect(error?.code).not.toBe('PGRST108');
    expect(error?.code).not.toBe('42P01');
  });

  it('4. YAARSA SYNC: Verify trial duration logic (Yaarsa 2d vs Shadow 1d)', async () => {
    const { expireDateFor } = await import('../lib/yaarsa.server');
    const yaarsaDate = expireDateFor('trial');
    
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const expectedYaarsa = d.toISOString().slice(0, 10);
    
    expect(yaarsaDate).toBe(expectedYaarsa);
    console.log(`[Audit] Yaarsa Technical Duration: 2 Days (${yaarsaDate})`);
  });

  it('5. TRIAL SHADOWDASH: Verify profile columns for 24h enforcement', async () => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('trial_started_at, trial_expires_at')
      .limit(1)
      .single();
    
    expect(error).toBeNull();
    expect(data).toHaveProperty('trial_started_at');
    expect(data).toHaveProperty('trial_expires_at');
  });
});
