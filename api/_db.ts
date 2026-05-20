import pg from 'pg';

const { Pool } = pg;

type QueryValue = string | number | boolean | null | undefined | Record<string, unknown> | unknown[];
type SqlClient = {
  (strings: TemplateStringsArray, ...values: QueryValue[]): Promise<any[]>;
  (query: string, values?: QueryValue[]): Promise<any[]>;
};

let pool: pg.Pool | null = null;

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL o POSTGRES_URL no configurada');
  return url;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: Number(process.env.POSTGRES_POOL_MAX || 10)
    });
  }
  return pool;
}

function buildParameterizedQuery(strings: TemplateStringsArray, values: QueryValue[]) {
  let text = strings[0] || '';
  for (let i = 0; i < values.length; i += 1) {
    text += `$${i + 1}${strings[i + 1] || ''}`;
  }
  return { text, values };
}

export function getDb(): SqlClient {
  const client = getPool();
  return (async (queryOrStrings: string | TemplateStringsArray, ...values: QueryValue[]) => {
    const isTemplate = Array.isArray(queryOrStrings) && 'raw' in queryOrStrings;
    const query = isTemplate
      ? buildParameterizedQuery(queryOrStrings as TemplateStringsArray, values)
      : { text: queryOrStrings as string, values: (values[0] as QueryValue[] | undefined) || [] };

    const result = await client.query(query.text, query.values as any[]);
    return result.rows;
  }) as SqlClient;
}

export async function closeDb() {
  if (!pool) return;
  await pool.end();
  pool = null;
}
