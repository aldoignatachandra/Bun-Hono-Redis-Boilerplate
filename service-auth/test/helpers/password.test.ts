import { describe, expect, it } from 'bun:test';
import { ZodError } from 'zod';
import { comparePassword, hashPassword } from '../../src/helpers/password';

describe('password helper', () => {
  it('hashes and compares passwords', async () => {
    const hash = await hashPassword('StrongPass1!');
    const isMatch = await comparePassword('StrongPass1!', hash);
    const isMismatch = await comparePassword('WrongPass1!', hash);
    expect(isMatch).toBe(true);
    expect(isMismatch).toBe(false);
  });

  it('rejects weak passwords', async () => {
    let captured: unknown;
    try {
      await hashPassword('weak');
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(ZodError);
  });
});
