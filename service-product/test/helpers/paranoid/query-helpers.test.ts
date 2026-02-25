import { describe, expect, it } from 'bun:test';
import { ParanoidQueryBuilder } from '../../../src/helpers/paranoid/query-helpers';

describe('ParanoidQueryBuilder', () => {
  const table = { deletedAt: 'deleted_at' } as unknown as { deletedAt: string };

  it('creates where clause for only deleted', () => {
    const clause = ParanoidQueryBuilder.createWhereClause(table, { onlyDeleted: true });
    expect(clause).toBeDefined();
  });

  it('combines custom and paranoid where clauses', () => {
    const clause = ParanoidQueryBuilder.combineWithCustomWhere(table, undefined, {
      onlyActive: true,
    });
    expect(clause).toBeDefined();
  });

  it('validates options to prevent conflicts', () => {
    let captured: unknown;
    try {
      ParanoidQueryBuilder.validateOptions({ includeDeleted: true, onlyActive: true });
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(Error);
  });

  it('creates where clause for active records by default', () => {
    const clause = ParanoidQueryBuilder.createWhereClause(table, {});
    expect(clause).toBeDefined();
  });

  it('returns undefined when includeDeleted is true', () => {
    const clause = ParanoidQueryBuilder.createWhereClause(table, { includeDeleted: true });
    expect(clause).toBeUndefined();
  });

  it('returns active, deleted, and all clauses', () => {
    const active = ParanoidQueryBuilder.active(table);
    const deleted = ParanoidQueryBuilder.deleted(table);
    const all = ParanoidQueryBuilder.all(table);
    expect(active).toBeDefined();
    expect(deleted).toBeDefined();
    expect(all).toBeUndefined();
  });

  it('creates count where clause using paranoid options', () => {
    const clause = ParanoidQueryBuilder.createCountWhere(table, { onlyActive: true });
    expect(clause).toBeDefined();
  });

  it('returns default options and merges user options', () => {
    const defaults = ParanoidQueryBuilder.getDefaultOptions();
    const merged = ParanoidQueryBuilder.mergeOptions({ includeDeleted: true });
    expect(defaults.onlyActive).toBe(true);
    expect(merged.includeDeleted).toBe(true);
  });
});
