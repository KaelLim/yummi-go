/**
 * drust REST client.
 *
 * Exposes thin typed wrappers over the drust HTTP API:
 *   - rpc      POST /rpc/{name}       (flat params body)
 *   - insert   POST /records/{coll}   ({data:...} body, returns {id, record})
 *   - update   PATCH /records/{coll}/{id}
 *   - delete   DELETE /records/{coll}/{id}
 *   - list     GET /records/{coll}?...
 *
 * Plus a helper rpcRows() that converts the column-major RpcResult into
 * an array of typed objects.
 */
import { ENV } from '@/lib/env';

export interface DrustError {
  message: string;
  status: number;
}

export interface RpcResult<T = unknown> {
  column_names: string[];
  rows: T[][];
  row_count: number;
  truncated: boolean;
}

export class DrustClient {
  constructor(
    private base: string = ENV.DRUST_BASE,
    private token: string = ENV.DRUST_ANON_TOKEN,
    private fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  private async fetch<T>(path: string, init?: RequestInit): Promise<T | null> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw { message: text, status: res.status } as DrustError;
    }
    if (res.status === 204) return null;
    return res.json() as Promise<T>;
  }

  /** Call an RPC. Body is flat params object: { username: 'x' } */
  rpc<T = unknown>(
    name: string,
    params: Record<string, unknown> = {},
  ): Promise<RpcResult<T>> {
    return this.fetch<RpcResult<T>>(`/rpc/${name}`, {
      method: 'POST',
      body: JSON.stringify(params),
    }) as Promise<RpcResult<T>>;
  }

  /** Insert a record. Returns { id, record }. */
  insert<T = unknown>(
    collection: string,
    data: Record<string, unknown>,
  ): Promise<{ id: number; record: T }> {
    return this.fetch(`/records/${collection}`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    }) as Promise<{ id: number; record: T }>;
  }

  /** Update a record. Returns { record }. */
  update<T = unknown>(
    collection: string,
    id: number,
    data: Record<string, unknown>,
  ): Promise<{ record: T }> {
    return this.fetch(`/records/${collection}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data }),
    }) as Promise<{ record: T }>;
  }

  /**
   * Get a single record by primary key. The path-based form is the only
   * filter shape drust currently supports — query-string filters
   * (`?id=eq.X`, `?filter[id]=X`, etc.) are silently ignored and the list
   * endpoint returns up to 20 records regardless. Use this for any
   * single-row lookup; for foreign-key lookups (e.g. "profile by user_id")
   * route through an anon RPC instead.
   */
  async get<T = unknown>(collection: string, id: number): Promise<T | null> {
    const raw = (await this.fetch<{ record: T }>(`/records/${collection}/${id}`)) as
      | { record: T }
      | null;
    return raw?.record ?? null;
  }

  /** Delete a record. */
  async delete(collection: string, id: number): Promise<void> {
    await this.fetch<null>(`/records/${collection}/${id}`, { method: 'DELETE' });
  }

  /** List records.
   *
   * The query-string is intentionally dropped on the wire. drust's
   * anon/user tokens started rejecting raw `?sort=` and `?filter=`
   * query params (2026-06-25 RAW_FILTER_DENIED policy) — and even
   * before that, `limit` / `sort` / `filter` were silently ignored.
   * The signature still accepts the legacy `query` arg so existing
   * call sites compile without churn, but we no longer forward it.
   * Callers that need real filtering or sorting must route through
   * a stored RPC (see api/content.ts for examples).
   */
  list<T = unknown>(
    collection: string,
    _query: Record<string, string> = {},
  ): Promise<{ records: T[]; total_count?: number }> {
    return this.fetch<{ records: T[] }>(
      `/records/${collection}`,
    ) as Promise<{ records: T[]; total_count?: number }>;
  }

  /** Helper: convert RPC RpcResult.rows[][] into array of typed objects. */
  rpcRows<T = unknown>(result: RpcResult): T[] {
    return result.rows.map((row) =>
      Object.fromEntries(result.column_names.map((c, i) => [c, row[i]])),
    ) as T[];
  }
}

export const drust = new DrustClient();
