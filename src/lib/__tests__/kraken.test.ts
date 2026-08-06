import { describe, it, expect, vi } from 'vitest';
import { krakenInputSchema } from '../kraken.functions';

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

    it('should fail if command is not a string', () => {
      const invalidData = { command: 123 };
      const result = krakenInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail if params is not an object', () => {
      const invalidData = { command: 'test', params: 'not-an-object' };
      const result = krakenInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
