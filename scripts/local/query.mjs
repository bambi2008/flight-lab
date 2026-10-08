// Small query bridge shared by the local HTTP API and the existing ingestion pipeline.
// Values are always bound parameters; identifiers must match the actual application schema.
export class Query {
  constructor(execute, table) {
    this.execute = execute;
    this.spec = { table, operation: 'select', fields: '*', filters: [], orders: [] };
  }
  select(fields = '*') {
    this.spec.fields = fields;
    this.spec.returning = true;
    return this;
  }
  insert(values) {
    this.spec.operation = 'insert';
    this.spec.values = values;
    return this;
  }
  update(values) {
    this.spec.operation = 'update';
    this.spec.values = values;
    return this;
  }
  eq(column, value) {
    return this.filter(column, 'eq', value);
  }
  neq(column, value) {
    return this.filter(column, 'neq', value);
  }
  gte(column, value) {
    return this.filter(column, 'gte', value);
  }
  lt(column, value) {
    return this.filter(column, 'lt', value);
  }
  in(column, value) {
    return this.filter(column, 'in', value);
  }
  filter(column, op, value) {
    this.spec.filters.push({ column, op, value });
    return this;
  }
  or(value) {
    this.spec.or = value;
    return this;
  }
  order(column, options = {}) {
    this.spec.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }
  limit(value) {
    this.spec.limit = value;
    return this;
  }
  single() {
    this.spec.single = true;
    return this;
  }
  maybeSingle() {
    this.spec.single = 'maybe';
    return this;
  }
  then(resolve, reject) {
    return this.execute(this.spec).then(resolve, reject);
  }
}

export function localDbClient(execute) {
  return {
    from: (table) => new Query(execute, table),
    rpc: (name, args = {}) => execute({ rpc: name, args }),
  };
}

export async function executeSpec(pg, schema, spec, role, userId) {
  try {
    const params = [];
    const bind = (value) => {
      params.push(value);
      return `$${params.length}`;
    };
    let sql;
    if (spec.rpc) {
      const signatures = {
        acquire_ingest_lease: ['lease_owner'],
        release_ingest_lease: ['lease_owner'],
        enqueue_article: ['article_payload', 'input_text'],
        monthly_ai_estimate: [],
        weekly_ingest_summary: [],
      };
      const keys = signatures[spec.rpc];
      if (!keys) throw new Error('Unsupported function');
      sql = `select public.${spec.rpc}(${keys.map((k) => bind(spec.args?.[k])).join(',')}) as result`;
    } else {
      if (!schema.has(spec.table)) throw new Error('Unsupported table');
      const columns = schema.get(spec.table);
      const column = (name) => {
        if (!columns.has(name)) throw new Error('Unsupported column');
        return `"${name}"`;
      };
      const fields =
        spec.fields === '*' ? '*' : String(spec.fields).split(',').map(column).join(',');
      const condition = ({ column: name, op, value }) => {
        const c = column(name);
        if (op === 'is' && value === 'null') return `${c} is null`;
        if (op === 'in' && Array.isArray(value) && value.length && value.length <= 100)
          return `${c} in (${value.map(bind).join(',')})`;
        const operators = { eq: '=', neq: '<>', gte: '>=', lt: '<' };
        if (!operators[op]) throw new Error('Unsupported filter');
        return `${c} ${operators[op]} ${bind(value)}`;
      };
      const filters = (spec.filters ?? []).map(condition);
      if (spec.or) {
        const alternatives = String(spec.or)
          .split(',')
          .map((part) => {
            const match = /^([a-z_]+)\.(eq|lt|is)\.(.+)$/.exec(part);
            if (!match) throw new Error('Unsupported filter');
            return condition({ column: match[1], op: match[2], value: match[3] });
          });
        filters.push(`(${alternatives.join(' or ')})`);
      }
      const where = filters.length ? ` where ${filters.join(' and ')}` : '';
      const table = `public."${spec.table}"`;
      if (spec.operation === 'select') {
        const orders = (spec.orders ?? []).map(
          (o) => `${column(o.column)} ${o.ascending ? 'asc' : 'desc'} nulls last`,
        );
        const limit = Math.min(3000, Math.max(1, Number(spec.limit) || 300));
        sql = `select ${fields} from ${table}${where}${orders.length ? ` order by ${orders.join(',')}` : ''} limit ${bind(limit)}`;
      } else {
        if (!['insert', 'update'].includes(spec.operation))
          throw new Error('Unsupported operation');
        const entries = Object.entries(spec.values ?? {});
        if (!entries.length) throw new Error('Empty update');
        if (spec.operation === 'update') {
          if (!filters.length) throw new Error('Update requires a filter');
          sql = `update ${table} set ${entries.map(([k, v]) => `${column(k)}=${bind(v)}`).join(',')}${where}`;
        } else {
          sql = `insert into ${table}(${entries.map(([k]) => column(k)).join(',')}) values(${entries.map(([, v]) => bind(v)).join(',')})`;
        }
        if (spec.returning) sql += ` returning ${fields}`;
      }
    }
    const rows = await pg.transaction(async (tx) => {
      // SET LOCAL and set_config(..., true) are scoped to this transaction, including failures.
      if (!['anon', 'authenticated', 'service_role'].includes(role))
        throw new Error('Invalid role');
      await tx.exec(`set local role ${role}`);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [userId ?? '']);
      return (await tx.query(sql, params)).rows;
    });
    if (spec.rpc) return { data: rows[0]?.result, error: null };
    if (spec.single) {
      if (rows.length > 1 || (spec.single === true && rows.length !== 1))
        return { data: null, error: { code: 'PGRST116', message: 'Expected one row' } };
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  } catch (error) {
    return {
      data: null,
      error: { code: error.code ?? 'LOCAL_QUERY', message: '本地数据操作失败，请检查输入和权限。' },
    };
  }
}
