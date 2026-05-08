import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrustClient, type RpcResult } from '../drust';

function mockResponse(body: unknown, status = 200): Response {
  const init: ResponseInit = { status };
  if (status === 204) {
    return new Response(null, init);
  }
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('DrustClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: DrustClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    client = new DrustClient('https://drust.example.com', 'TEST_TOKEN', fetchMock as unknown as typeof fetch);
  });

  describe('rpc', () => {
    it('sends POST /rpc/{name} with flat params body', async () => {
      const rpcResult: RpcResult = {
        column_names: ['id', 'username'],
        rows: [[1, 'alice']],
        row_count: 1,
        truncated: false,
      };
      fetchMock.mockResolvedValueOnce(mockResponse(rpcResult));

      const result = await client.rpc('login', { username: 'alice', password_hash: 'h' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://drust.example.com/rpc/login');
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ username: 'alice', password_hash: 'h' }));
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer TEST_TOKEN');
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
      expect(result).toEqual(rpcResult);
    });

    it('defaults to empty params object', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ column_names: [], rows: [], row_count: 0, truncated: false }),
      );
      await client.rpc('random_quiz');
      const [, init] = fetchMock.mock.calls[0];
      expect(init.body).toBe('{}');
    });
  });

  describe('insert', () => {
    it('sends POST /records/{coll} with {data:...} body', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ id: 7, record: { id: 7, username: 'bob' } }),
      );

      const out = await client.insert('users', { username: 'bob' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://drust.example.com/records/users');
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ data: { username: 'bob' } }));
      expect(out).toEqual({ id: 7, record: { id: 7, username: 'bob' } });
    });
  });

  describe('update', () => {
    it('sends PATCH /records/{coll}/{id}', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ record: { id: 5, mood: 'happy' } }),
      );

      const out = await client.update('pet_states', 5, { mood: 'happy' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://drust.example.com/records/pet_states/5');
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe(JSON.stringify({ data: { mood: 'happy' } }));
      expect(out).toEqual({ record: { id: 5, mood: 'happy' } });
    });
  });

  describe('delete', () => {
    it('returns void on 204', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(null, 204));
      const out = await client.delete('users', 3);
      expect(out).toBeUndefined();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://drust.example.com/records/users/3');
      expect(init.method).toBe('DELETE');
    });
  });

  describe('get', () => {
    it('GETs /records/{coll}/{id} and unwraps {record}', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ record: { id: 4, name: 'X' } }));
      const out = await client.get<{ id: number; name: string }>('restaurants', 4);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://drust.example.com/records/restaurants/4');
      expect(init?.method).toBeUndefined(); // GET default
      expect(out).toEqual({ id: 4, name: 'X' });
    });

    it('returns null when fetch resolves to null (e.g. 204)', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(null, 204));
      const out = await client.get('restaurants', 999);
      expect(out).toBeNull();
    });
  });

  describe('list', () => {
    it('builds query string correctly', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ records: [{ id: 1 }] }));
      const out = await client.list('check_ins', { user_id: 'eq.5', day_number: 'eq.3' });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe('https://drust.example.com/records/check_ins?user_id=eq.5&day_number=eq.3');
      expect(out).toEqual({ records: [{ id: 1 }] });
    });

    it('omits ? when no query', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ records: [] }));
      await client.list('users');
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe('https://drust.example.com/records/users');
    });
  });

  describe('rpcRows', () => {
    it('converts column_names + rows[][] to objects', () => {
      const result: RpcResult = {
        column_names: ['id', 'username', 'display_name'],
        rows: [
          [1, 'alice', 'Alice'],
          [2, 'bob', 'Bob'],
        ],
        row_count: 2,
        truncated: false,
      };
      const objs = client.rpcRows<{ id: number; username: string; display_name: string }>(result);
      expect(objs).toEqual([
        { id: 1, username: 'alice', display_name: 'Alice' },
        { id: 2, username: 'bob', display_name: 'Bob' },
      ]);
    });

    it('returns empty array when no rows', () => {
      const result: RpcResult = {
        column_names: ['id'],
        rows: [],
        row_count: 0,
        truncated: false,
      };
      expect(client.rpcRows(result)).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws DrustError on non-OK status', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('boom', { status: 500 }),
      );
      await expect(client.rpc('x')).rejects.toMatchObject({ status: 500, message: 'boom' });
    });

    it('throws DrustError on 404', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('not found', { status: 404 }),
      );
      await expect(client.list('users')).rejects.toMatchObject({ status: 404, message: 'not found' });
    });
  });
});
