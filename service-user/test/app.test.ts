import { describe, expect, it, mock } from 'bun:test';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3300';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const baseUserRow = {
  id: 'u1',
  email: 'user@example.com',
  username: 'user',
  name: 'User',
  role: 'USER',
  password: 'hash',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const selectMock = mock((args?: Record<string, unknown>) => ({
  from: () => {
    const rows = args && 'count' in args ? [{ count: 1 }] : [baseUserRow];
    const chain = rows as unknown as {
      where: () => unknown;
      limit: () => unknown;
      offset: () => unknown;
      orderBy: () => unknown;
    };
    chain.where = () => chain;
    chain.limit = () => chain;
    chain.offset = () => chain;
    chain.orderBy = () => chain;
    return chain;
  },
}));

const insertMock = mock((_table: unknown) => ({
  values: (values: Record<string, unknown> | Array<Record<string, unknown>>) => ({
    returning: () =>
      Array.isArray(values)
        ? values.map((val, index) => ({ id: `id-${index}`, ...val }))
        : [{ id: 'id-1', ...values }],
  }),
}));

const updateMock = mock((_table: unknown) => ({
  set: (values: Record<string, unknown>) => ({
    where: () => ({
      returning: () => [{ ...baseUserRow, ...values }],
    }),
  }),
}));

const deleteMock = mock((_table: unknown) => ({
  where: mock(async () => undefined),
}));

const drizzleDb = {
  select: selectMock,
  insert: insertMock,
  update: updateMock,
  delete: deleteMock,
  query: {
    userSessions: {
      findFirst: mock(async () => ({ id: 's1' })),
    },
    users: {
      findFirst: mock(async () => null),
    },
  },
} as {
  select: typeof selectMock;
  insert: typeof insertMock;
  update: typeof updateMock;
  delete: typeof deleteMock;
  query: {
    userSessions: {
      findFirst: () => Promise<unknown>;
    };
    users: {
      findFirst: () => Promise<unknown>;
    };
  };
  transaction?: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
};
drizzleDb.transaction = async (cb: (tx: unknown) => Promise<unknown>) => cb(drizzleDb);

mock.module('../src/db/connection', () => ({
  checkDatabaseHealth: mock(async () => true),
  drizzleDb,
  client: {},
  closeDatabaseConnection: mock(async () => undefined),
}));

const appPromise = import('../src/app');
const configPromise = import('../src/config/loader');

describe('app', () => {
  it('returns admin health with system auth', async () => {
    const { configLoader } = await configPromise;
    const config = configLoader.getConfig();
    const username = config.security?.systemAuth?.username ?? 'SYSTEM_USER';
    const password = config.security?.systemAuth?.password ?? 'SYSTEM_PASS';
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const { default: app } = await appPromise;
    const res = await app.request('/admin/health', {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });
    expect(res.status).toBe(200);
  });

  it('returns health status when database is connected', async () => {
    const { default: app } = await appPromise;
    const res = await app.request('/health');
    const body = (await res.json()) as { success: boolean };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns unhealthy status when database is disconnected', async () => {
    const connection = await import('../src/db/connection');
    const dbHealth = connection.checkDatabaseHealth as unknown as {
      mock: { resolvedValues: unknown[] };
      mockResolvedValueOnce: (value: unknown) => void;
    };
    dbHealth.mockResolvedValueOnce(false);
    const { default: app } = await appPromise;
    const res = await app.request('/health');
    const body = (await res.json()) as { success: boolean };
    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
  });
});
