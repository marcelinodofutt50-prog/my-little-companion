import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ track: vi.fn(), repair: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const chain = { middleware: () => chain, handler: (fn: unknown) => fn };
    return chain;
  },
}));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('../tutorials.functions', () => ({ trackSchemaFailure: mocks.track }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.repair } }));
import { runSchemaHealthCheck } from '../health-check.functions';
type Handler = (input: { context: { userId: string; supabase: unknown } }) => Promise<Record<string, unknown>>;
const run = runSchemaHealthCheck as unknown as Handler;
function context(error: unknown) {
  return { userId: 'owner', supabase: { from: () => ({ select: () => ({ limit: async () => ({ error }) }) }) } };
}
beforeEach(() => { mocks.track.mockReset(); mocks.repair.mockReset(); });

describe('health check public error privacy', () => {
  it('omits database error text and codes from responses', async () => {
    const internal = { code: 'PGRST108', message: 'schema cache private_table secret_host' };
    const result = await run({ context: context(internal) });
    expect(result.status).toBe('unstable');
    expect(result).not.toHaveProperty('code');
    expect(JSON.stringify(result)).not.toContain('private_table');
    expect(mocks.track).toHaveBeenCalledWith(internal, expect.anything(), false, expect.anything(), 'owner');
  });
  it('does not expose exceptions when internal logging fails', async () => {
    mocks.track.mockRejectedValueOnce(new Error('private database hostname'));
    const result = await run({ context: context({ message: 'internal' }) });
    expect(result.status).toBe('critical');
    expect(JSON.stringify(result)).not.toContain('hostname');
  });
  it('returns healthy for a successful scoped read', async () => {
    expect((await run({ context: context(null) })).status).toBe('healthy');
    expect(mocks.repair).not.toHaveBeenCalled();
  });
});
