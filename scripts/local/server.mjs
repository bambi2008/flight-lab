import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { adminId, openDatabase } from './database.mjs';
import { ingest } from '../../supabase/functions/_shared/pipeline.mjs';
import { checkStoredSource } from '../../supabase/functions/_shared/source-check.mjs';

const projectDir = new URL('../../', import.meta.url);
async function config() {
  let file = {};
  try {
    file = parseEnv(await readFile(new URL('.env.local', projectDir), 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const env = { ...process.env, ...file };
  return {
    key: env.DEEPSEEK_API_KEY || '',
    model: env.DEEPSEEK_MODEL || 'deepseek-flash',
    githubToken: env.GITHUB_TOKEN,
    youtubeKey: env.YOUTUBE_API_KEY,
    rsshubBase: env.RSSHUB_BASE_URL,
    batchSize: Number(env.INGEST_BATCH_SIZE) || 12,
    monthlyLimit: Number(env.DEEPSEEK_MONTHLY_LIMIT_USD) || 0,
    rates: {
      input: Number(env.DEEPSEEK_INPUT_USD_PER_MILLION) || 0.3,
      output: Number(env.DEEPSEEK_OUTPUT_USD_PER_MILLION) || 1.2,
    },
  };
}

export function createLocalServer(database, loadConfig = config) {
  const sessions = new Map();
  let running = null;
  async function collect() {
    if (running) return { skipped: true, reason: '已有采集任务在运行' };
    running = (async () =>
      ingest({
        db: database.client,
        parser: new XMLParser({ ignoreAttributes: false, processEntities: false }),
        config: await loadConfig(),
      }))();
    try {
      return await running;
    } finally {
      running = null;
    }
  }
  const server = createServer(async (req, res) => {
    const port = server.address()?.port;
    const hosts = new Set([
      `127.0.0.1:${port}`,
      `localhost:${port}`,
      '127.0.0.1:5173',
      'localhost:5173',
    ]);
    const origin = req.headers.origin;
    const json = (data, status = 200, headers = {}) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...headers,
      });
      res.end(JSON.stringify(data));
    };
    // Loopback binding + explicit Host and Origin checks prevent cross-site requests and DNS rebinding.
    if (
      !hosts.has(req.headers.host) ||
      (origin && ![...hosts].some((h) => origin === `http://${h}`))
    )
      return json({ error: '仅允许本机访问' }, 403);
    const token = /(?:^|;\s*)flightlab_local=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie ?? '',
    )?.[1];
    const expiry = token && sessions.get(token);
    const authorized = !!expiry && expiry > Date.now();
    if (token && !authorized) sessions.delete(token);
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    try {
      if (req.method === 'GET' && path === '/api/local/auth')
        return json({ data: { user: authorized ? { id: adminId } : null }, error: null });
      if (req.method === 'GET' && path === '/api/local/status')
        return json({
          local: true,
          model_configured: !!(await loadConfig()).key,
          scheduled: !!timer,
        });
      if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      let length = 0,
        text = '';
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 65536) return json({ error: '请求过大' }, 413);
        text += chunk;
      }
      const body = text ? JSON.parse(text) : {};
      if (path === '/api/local/login') {
        if (!origin) return json({ error: '请从本地编辑台进入' }, 403);
        for (const [key, expires] of sessions) if (expires <= Date.now()) sessions.delete(key);
        if (sessions.size >= 50) return json({ error: '会话过多' }, 429);
        const key = randomBytes(32).toString('hex');
        sessions.set(key, Date.now() + 12 * 3600000);
        return json({ data: { user: { id: adminId } }, error: null }, 200, {
          'Set-Cookie': `flightlab_local=${key}; HttpOnly; SameSite=Strict; Path=/api/local; Max-Age=43200`,
        });
      }
      if (path === '/api/local/logout') {
        if (token) sessions.delete(token);
        return json({ error: null }, 200, {
          'Set-Cookie': 'flightlab_local=; HttpOnly; SameSite=Strict; Path=/api/local; Max-Age=0',
        });
      }
      if (path === '/api/local/query') {
        if (!authorized && (body.rpc || body.operation !== 'select'))
          return json({ error: { message: '需要管理员权限' }, data: null }, 401);
        const result = await database.execute(
          body,
          authorized ? 'authenticated' : 'anon',
          authorized ? adminId : '',
        );
        return json(result, result.error ? 400 : 200);
      }
      if (!authorized) return json({ error: { message: '需要管理员权限' } }, 401);
      if (path === '/api/local/ingest') {
        if (body.action === 'check_source')
          return json({
            data: await checkStoredSource({
              db: database.client,
              parser: new XMLParser({ ignoreAttributes: false, processEntities: false }),
              sourceId: body.source_id,
              githubToken: (await loadConfig()).githubToken,
              youtubeKey: (await loadConfig()).youtubeKey,
              rsshubBase: (await loadConfig()).rsshubBase,
            }),
            error: null,
          });
        if (body.action) return json({ data: null, error: { message: '不支持的操作' } }, 400);
        return json({ data: await collect(), error: null });
      }
      return json({ error: 'Not found' }, 404);
    } catch {
      return json({ data: null, error: { message: '本地请求未完成，请查看运行记录。' } }, 400);
    }
  });
  let timer = null;
  const schedule = () => {
    if (!timer)
      timer = setInterval(
        () => collect().catch(() => console.error('定时采集失败，请查看编辑台运行记录。')),
        10 * 60_000,
      );
    timer?.unref();
  };
  const stopSchedule = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  return {
    server,
    collect,
    schedule,
    stopSchedule,
    idle: () => running?.catch(() => {}) ?? Promise.resolve(),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dataDir = new URL('.local-data/', projectDir);
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const lock = new URL('service.lock', dataDir);
  try {
    const previous = Number(await readFile(lock, 'utf8'));
    try {
      process.kill(previous, 0);
      console.error('本地服务已经在运行。');
      process.exit(1);
    } catch (e) {
      if (e.code !== 'ESRCH') throw e;
      await unlink(lock);
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const file = await open(lock, 'wx', 0o600);
  await file.writeFile(String(process.pid));
  await file.close();
  let database;
  try {
    database = await openDatabase(fileURLToPath(new URL('postgres/', dataDir)));
    const app = createLocalServer(database);
    await new Promise((resolve, reject) => {
      app.server.once('error', reject);
      app.server.listen(5174, '127.0.0.1', resolve);
    });
    app.schedule();
    console.log(
      'Flight Lab 本地 API：http://127.0.0.1:5174 · 每 10 分钟检查来源 · 数据保存在 SSD 项目目录',
    );
    async function close() {
      app.stopSchedule();
      await new Promise((resolve) => {
        app.server.close(resolve);
        app.server.closeIdleConnections();
      });
      await app.idle();
      await database.pg.close();
      await unlink(lock);
      process.exit(0);
    }
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
  } catch (error) {
    await database?.pg.close();
    await unlink(lock);
    throw error;
  }
}
