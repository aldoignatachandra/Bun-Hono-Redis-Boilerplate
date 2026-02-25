import { describe, expect, it, mock } from 'bun:test';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3100';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const endMock = mock(async () => undefined);
const postgresFactory = mock((_url: string, _options: unknown) => ({
  end: endMock,
}));

const drizzleMock = mock((_client: unknown) => ({}));
const migrateMock = mock(async (_db: unknown, _opts: unknown) => undefined);

mock.module('postgres', () => ({
  default: postgresFactory,
}));

mock.module('drizzle-orm/postgres-js', () => ({
  drizzle: drizzleMock,
}));

mock.module('drizzle-orm/postgres-js/migrator', () => ({
  migrate: migrateMock,
}));

const modulePromise = import('../../src/scripts/migrate');

describe('migrate script', () => {
  it('runs migrations with cleaned connection string', async () => {
    process.env.DB_URL = 'postgresql://user:pass@localhost:5432/testdb?schema=public';
    const { runMigrations } = await modulePromise;
    await runMigrations();
    const args = (postgresFactory as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [
      string,
    ];
    expect(args[0]).not.toContain('schema=');
    expect(migrateMock).toHaveBeenCalled();
    expect(endMock).toHaveBeenCalled();
  });

  it('exits on invalid DB_URL', async () => {
    const originalExit = process.exit;
    const exitMock = mock((_code?: number) => {
      throw new Error('exit');
    });
    process.exit = exitMock as unknown as typeof process.exit;
    process.env.DB_URL = 'not-a-url';
    const { runMigrations } = await modulePromise;
    let captured: unknown;
    try {
      await runMigrations();
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(Error);
    process.exit = originalExit;
  });
});
