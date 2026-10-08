import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';
import { ingest } from '../supabase/functions/_shared/pipeline.mjs';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('请先在 .env.local 配置本项目的 Supabase URL 和服务端密钥。');
  process.exit(1);
}
const config = {
  key: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL,
  githubToken: process.env.GITHUB_TOKEN,
  batchSize: Number(process.env.INGEST_BATCH_SIZE) || 12,
  monthlyLimit: Number(process.env.DEEPSEEK_MONTHLY_LIMIT_USD) || 0,
  rates: {
    input: Number(process.env.DEEPSEEK_INPUT_USD_PER_MILLION) || 0.3,
    output: Number(process.env.DEEPSEEK_OUTPUT_USD_PER_MILLION) || 1.2,
  },
};
try {
  const result = await ingest({
    db: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    }),
    parser: new XMLParser({ ignoreAttributes: false, processEntities: false }),
    config,
  });
  console.log(JSON.stringify(result, null, 2));
} catch {
  console.error('采集未完成，请检查后台运行记录。');
  process.exitCode = 1;
}
