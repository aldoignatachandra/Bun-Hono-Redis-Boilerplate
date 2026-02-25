import { describe, expect, it, mock } from 'bun:test';
import { ApiClientError, createApiClient } from '../../src/helpers/api-client';

describe('api-client', () => {
  it('handles successful get requests', async () => {
    const originalFetch = global.fetch;
    const fetchMock = mock(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: true, message: 'ok', data: { id: '1' } }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createApiClient({ baseUrl: 'http://localhost:3101' });
    const response = await client.get<{ id: string }>('/api/internal/users/oldest');
    expect(response.success).toBe(true);
    expect(response.data?.id).toBe('1');

    global.fetch = originalFetch;
  });

  it('throws ApiClientError on non-ok responses', async () => {
    const originalFetch = global.fetch;
    const fetchMock = mock(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({
        message: 'User not found',
        error: { code: 'USER_NOT_FOUND', details: [] },
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createApiClient({ baseUrl: 'http://localhost:3101' });
    let captured: unknown;
    try {
      await client.get('/api/internal/users/oldest');
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(ApiClientError);

    global.fetch = originalFetch;
  });

  it('handles successful post requests', async () => {
    const originalFetch = global.fetch;
    const fetchMock = mock(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: true, message: 'ok', data: { id: '2' } }),
      init,
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createApiClient({ baseUrl: 'http://localhost:3101' });
    const response = await client.post<{ id: string }>('/api/internal/users', { name: 'Test' });
    expect(response.success).toBe(true);
    expect(response.data?.id).toBe('2');

    global.fetch = originalFetch;
  });

  it('throws ApiClientError when response is not JSON', async () => {
    const originalFetch = global.fetch;
    const fetchMock = mock(async () => ({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => {
        throw new Error('Invalid JSON');
      },
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createApiClient({ baseUrl: 'http://localhost:3101' });
    let captured: unknown;
    try {
      await client.post('/api/internal/users', { name: 'Test' });
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(ApiClientError);

    global.fetch = originalFetch;
  });

  it('wraps network errors as ApiClientError', async () => {
    const originalFetch = global.fetch;
    const fetchMock = mock(async () => {
      throw new Error('Network down');
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createApiClient({ baseUrl: 'http://localhost:3101' });
    let captured: unknown;
    try {
      await client.get('/api/internal/users/oldest');
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(ApiClientError);

    global.fetch = originalFetch;
  });

  it('normalizes baseUrl and includes auth header', async () => {
    const originalFetch = global.fetch;
    const fetchMock = mock(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: true, message: 'ok' }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createApiClient({
      baseUrl: 'http://localhost:3101/',
      authToken: 'Basic abc',
    });
    await client.get('/api/internal/users/oldest');
    const call = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(call[0]).toBe('http://localhost:3101/api/internal/users/oldest');
    expect((call[1].headers as Record<string, string>).Authorization).toBe('Basic abc');

    global.fetch = originalFetch;
  });
});
