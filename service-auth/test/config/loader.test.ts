import { describe, expect, it } from 'bun:test';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3100';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const configPromise = import('../../src/config/loader');

describe('config loader', () => {
  it('loads config with required sections', async () => {
    const { configLoader } = await configPromise;
    const config = configLoader.getConfig();
    expect(config.app).toBeDefined();
    expect(config.auth).toBeDefined();
    expect(config.database).toBeDefined();
    expect(config.kafka).toBeDefined();
  });

  it('returns environment flags', async () => {
    const { configLoader } = await configPromise;
    const env = configLoader.getEnvironment();
    expect(typeof env).toBe('string');
    expect(
      configLoader.isDevelopment() || configLoader.isStaging() || configLoader.isProduction()
    ).toBe(true);
  });
});
