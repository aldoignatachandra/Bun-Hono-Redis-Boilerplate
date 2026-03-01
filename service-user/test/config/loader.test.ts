import { describe, expect, it } from 'bun:test';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';
process.env.REDIS_DB = process.env.REDIS_DB ?? '0';
process.env.PORT = process.env.PORT ?? '3300';
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
    expect(config.redis).toBeDefined();
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
