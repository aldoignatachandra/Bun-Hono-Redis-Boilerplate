import { describe, expect, it } from 'bun:test';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3100';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const modulePromise = import('../../src/db/connection');

describe('db connection', () => {
  it('exports connection helpers', async () => {
    const { client, drizzleDb, checkDatabaseHealth, closeDatabaseConnection } = await modulePromise;
    expect(client).toBeDefined();
    expect(drizzleDb).toBeDefined();
    expect(typeof checkDatabaseHealth).toBe('function');
    expect(typeof closeDatabaseConnection).toBe('function');
  });
});
