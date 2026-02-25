import { describe, expect, it } from 'bun:test';
import { roleEnum } from '../../../src/helpers/schema/enums';

describe('roleEnum', () => {
  it('exposes role values', () => {
    expect(roleEnum.enumValues).toContain('ADMIN');
    expect(roleEnum.enumValues).toContain('USER');
  });
});
