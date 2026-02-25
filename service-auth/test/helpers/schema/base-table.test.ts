import { describe, expect, it } from 'bun:test';
import { varchar } from 'drizzle-orm/pg-core';
import { createParanoidTable } from '../../../src/helpers/schema/base-table';

describe('createParanoidTable', () => {
  it('creates a table with base columns', () => {
    const table = createParanoidTable('test_table', {
      name: varchar('name', { length: 10 }),
    });
    expect(table).toBeDefined();
    expect(typeof table).toBe('object');
  });
});
