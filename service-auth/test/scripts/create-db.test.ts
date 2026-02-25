import { describe, expect, it, mock } from 'bun:test';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3100';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

type SqlFunction = ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>) & {
  unsafe: (query: string) => Promise<void>;
  end: () => Promise<void>;
};

const queryMock = mock(async (..._args: unknown[]) => [] as unknown[]);
const unsafeMock = mock(async (_query: string) => undefined);
const endMock = mock(async () => undefined);

const sql = queryMock as unknown as SqlFunction;
sql.unsafe = unsafeMock;
sql.end = endMock;

const postgresFactory = mock((_url: string, _options: unknown) => sql);

mock.module('postgres', () => ({
  default: postgresFactory,
}));

const modulePromise = import('../../src/scripts/create-db');

describe('create-db script', () => {
  it('creates database when missing', async () => {
    process.env.DB_URL = 'postgresql://user:pass@localhost:5432/testdb';
    queryMock.mockResolvedValueOnce([]);
    const { createDatabase } = await modulePromise;
    await createDatabase();
    expect(unsafeMock).toHaveBeenCalled();
  });

  it('exits when DB_URL is missing', async () => {
    const originalExit = process.exit;
    const exitMock = mock((_code?: number) => {
      throw new Error('exit');
    });
    process.exit = exitMock as unknown as typeof process.exit;
    delete process.env.DB_URL;
    const { createDatabase } = await modulePromise;
    let captured: unknown;
    try {
      await createDatabase();
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(Error);
    process.exit = originalExit;
  });
});
