import { describe, expect, it } from 'bun:test';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3100';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const appPromise = import('../src/app');
const configPromise = import('../src/config/loader');

describe('app', () => {
  it('returns health status', async () => {
    const { default: app } = await appPromise;
    const res = await app.request('/health');
    const body = (await res.json()) as { success: boolean; data: { service: string } };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.service).toBe('auth-service');
  });

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

  it('returns gateway response', async () => {
    const { default: app } = await appPromise;
    const res = await app.request('/');
    const body = (await res.json()) as { message: string };
    expect(res.status).toBe(200);
    expect(body.message).toBe('Auth Service Gateway');
  });
});
