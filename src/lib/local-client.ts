import type { SupabaseClient } from '@supabase/supabase-js';

type Result<T = unknown> = { data: T | null; error: { message: string; code?: string } | null };
type User = { id: string };
type Session = { user: User } | null;
type QuerySpec = {
  table: string;
  operation: string;
  fields: string;
  filters: { column: string; op: string; value: unknown }[];
  orders: { column: string; ascending: boolean }[];
  values?: unknown;
  returning?: boolean;
  limit?: number;
  single?: string;
};
async function request<T = unknown>(path: string, body?: unknown): Promise<Result<T>> {
  try {
    const response = await fetch(`/api/local/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return await response.json();
  } catch {
    return { data: null, error: { message: '本地服务未连接，请启动 npm run local:api。' } };
  }
}
class LocalQuery {
  private spec: QuerySpec;
  constructor(table: string) {
    this.spec = { table, operation: 'select', fields: '*', filters: [], orders: [] };
  }
  select(fields = '*') {
    this.spec.fields = fields;
    this.spec.returning = true;
    return this;
  }
  insert(values: unknown) {
    this.spec.operation = 'insert';
    this.spec.values = values;
    return this;
  }
  update(values: unknown) {
    this.spec.operation = 'update';
    this.spec.values = values;
    return this;
  }
  eq(column: string, value: unknown) {
    this.spec.filters.push({ column, op: 'eq', value });
    return this;
  }
  gte(column: string, value: unknown) {
    this.spec.filters.push({ column, op: 'gte', value });
    return this;
  }
  order(column: string, options: { ascending?: boolean } = {}) {
    this.spec.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }
  limit(value: number) {
    this.spec.limit = value;
    return this;
  }
  maybeSingle() {
    this.spec.single = 'maybe';
    return this;
  }
  then(resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) {
    return request('query', this.spec).then(resolve, reject);
  }
}
export function createLocalClient(): SupabaseClient {
  const listeners = new Set<(event: string, session: Session) => void>();
  // Implements only the client operations used by Flight Lab, never a general Supabase API.
  return {
    from: (table: string) => new LocalQuery(table),
    rpc: (name: string) => request('query', { rpc: name }),
    functions: {
      invoke: (name: string, options?: { body?: unknown }) =>
        name === 'ingest'
          ? request('ingest', options?.body ?? {})
          : Promise.resolve({ data: null, error: { message: '本地不支持此函数' } }),
    },
    auth: {
      getUser: () => request<{ user: User | null }>('auth'),
      onAuthStateChange: (listener: (event: string, session: Session) => void) => {
        listeners.add(listener);
        return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
      },
      signInWithPassword: async () => {
        const result = await request<{ user: User }>('login', {});
        if (!result.error && result.data)
          listeners.forEach((listener) => listener('SIGNED_IN', { user: result.data!.user }));
        return result;
      },
      signOut: async () => {
        const result = await request('logout', {});
        if (!result.error) listeners.forEach((listener) => listener('SIGNED_OUT', null));
        return result;
      },
    },
  } as unknown as SupabaseClient;
}
