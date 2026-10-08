import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { XMLParser } from 'npm:fast-xml-parser@5.11.2';
import { ingest } from '../_shared/pipeline.mjs';

const env = (key: string) => Deno.env.get(key) ?? '';
const allowedOrigins = new Set(
  [env('PUBLIC_SITE_URL'), 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean),
);
const adminDb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});
function sameSecret(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  if (request.method === 'OPTIONS')
    return new Response(null, {
      status: allowedOrigins.has(origin) ? 204 : 403,
      headers: {
        ...headers,
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let authorized = false;
  const cronSecret = env('INGEST_CRON_SECRET');
  const providedSecret = request.headers.get('x-cron-secret') ?? '';
  if (cronSecret && providedSecret && sameSecret(cronSecret, providedSecret)) authorized = true;
  if (!authorized) {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (token) {
      const { data, error } = await adminDb.auth.getUser(token);
      if (!error && data.user) {
        const { data: role } = await adminDb
          .from('admin_roles')
          .select('user_id')
          .eq('user_id', data.user.id)
          .maybeSingle();
        authorized = !!role;
      }
    }
  }
  if (!authorized) return json({ error: '需要管理员权限' }, 401);
  try {
    const result = await ingest({
      db: adminDb,
      parser: new XMLParser({ ignoreAttributes: false, processEntities: false }),
      config: {
        key: env('DEEPSEEK_API_KEY'),
        model: env('DEEPSEEK_MODEL') || 'deepseek-flash',
        githubToken: env('GITHUB_TOKEN'),
        batchSize: Number(env('INGEST_BATCH_SIZE')) || 12,
        monthlyLimit: Number(env('DEEPSEEK_MONTHLY_LIMIT_USD')) || 0,
        rates: {
          input: Number(env('DEEPSEEK_INPUT_USD_PER_MILLION')) || 0.3,
          output: Number(env('DEEPSEEK_OUTPUT_USD_PER_MILLION')) || 1.2,
        },
      },
    });
    return json(result);
  } catch {
    return json({ error: '采集任务未完成，请查看后台运行记录' }, 500);
  }
});
