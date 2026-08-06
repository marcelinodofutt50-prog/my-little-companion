import { describe, it, expect, vi } from 'vitest';
import { krakenInputSchema, krakenCommand } from '../kraken.functions';

// Mock requireSupabaseAuth to avoid auth issues in unit tests
vi.mock('@/integrations/supabase/auth-middleware', () => ({
  requireSupabaseAuth: (fn: any) => fn
}));

describe('Kraken Control Functions', () => {
  describe('krakenInputSchema', () => {
    it('should validate a valid command', () => {
      const validData = { command: 'reboot-node' };
      const result = krakenInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate a command with params', () => {
      const validData = { 
        command: 'sync-keys', 
        params: { node_id: '0xFA-88', force: true } 
      };
      const result = krakenInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.params?.node_id).toBe('0xFA-88');
      }
    });

    it('should fail if command is missing', () => {
      const invalidData = { params: {} };
      const result = krakenInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('krakenCommand handler', () => {
    it('should process a valid command and return success response', async () => {
      // Accessing the handler directly for unit testing
      // Note: server functions have a .handler property in TanStack Start
      const result = await krakenCommand.handler({
        data: { command: 'test-command' },
        request: new Request('http://localhost:8080/api/kraken'),
        context: {} as any
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('test-command');
      expect(result.timestamp).toBeDefined();
    });
  });
});

