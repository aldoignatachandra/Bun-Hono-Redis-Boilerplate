import { describe, expect, it } from 'bun:test';
import { userSessions, users } from '../../src/db/schema';

describe('db schema', () => {
  it('exports users and userSessions tables', () => {
    expect(users).toBeDefined();
    expect(userSessions).toBeDefined();
  });
});
