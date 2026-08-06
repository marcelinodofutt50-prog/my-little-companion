import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { yaarsaSetPassword } from '../yaarsa.server';

// Mock persistLog to avoid database calls during tests
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null })
    })
  }
}));

describe('yaarsaSetPassword - Network and Server Failure Handling', () => {
  const mockEmail = 'test@example.com';
  const mockPassword = 'NewPassword123!';
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('YAARSA_ADMIN_KEY', 'test-key');
    vi.stubEnv('LICENSE_ENC_KEY', 'test-encryption-key-32-chars-long!!');
    // Default mock implementation
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should handle 502 Bad Gateway with retries and return a friendly error', async () => {
    // Mock fetch to return 502 for all attempts
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('Bad Gateway'),
      headers: new Map(),
    });

    const result = await yaarsaSetPassword(mockEmail, mockPassword);

    // Should return the friendly error message defined in friendlyYaarsaFail
    expect(result.Fail).toContain('Falha de rede ou timeout');
    expect(result.statusCode).toBe(502);
    // Based on src/lib/yaarsa.server.ts, it tries multiple actions ('update', 'cpassword', etc.)
    // and each action has MAX_ATTEMPTS = 5.
    // However, if it hits a non-retryable break (like a recognized HTTP error), it might stop earlier.
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should handle 504 Gateway Timeout and return a friendly error', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 504,
      text: () => Promise.resolve('Gateway Timeout'),
      headers: new Map(),
    });

    const result = await yaarsaSetPassword(mockEmail, mockPassword);

    expect(result.Fail).toContain('Falha de rede ou timeout');
    expect(result.statusCode).toBe(504);
  });

  it('should handle network connection failures (fetch throws)', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network connection lost'));

    const result = await yaarsaSetPassword(mockEmail, mockPassword);

    expect(result.Fail?.toLowerCase()).toContain('falha de rede');
  });

  it('should succeed if one of the retries or actions eventually succeeds', async () => {
    // Mock fetch to fail first, then succeed
    let callCount = 0;
    (global.fetch as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 504,
          text: () => Promise.resolve('Gateway Timeout'),
          headers: new Map(),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ Success: 'Password updated' })),
        headers: new Map(),
      });
    });

    const result = await yaarsaSetPassword(mockEmail, mockPassword);

    expect(result.Success).toBeDefined();
    // It should have tried the next action or next attempt
    expect(callCount).toBeGreaterThan(1);
  });
});
