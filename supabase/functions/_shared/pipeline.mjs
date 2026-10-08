import { simhash, nearDuplicate, publicationStatus } from './content.mjs';
import { fetchSource } from './sources.mjs';
import { analyze } from './deepseek.mjs';

function must(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function ingest({ db, parser, config }) {
  const owner = crypto.randomUUID();
  const acquired = must(await db.rpc('acquire_ingest_lease', { lease_owner: owner }));
  if (!acquired) return { skipped: true, reason: '已有采集任务在运行' };
  const started = Date.now(),
    deadline = started + 100_000;
  const stats = {
    fetched: 0,
    inserted: 0,
    processed: 0,
    published: 0,
    pending: 0,
    rejected: 0,
    duplicates: 0,
    failed: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    estimated_usd: 0,
  };
  let runId;
  try {
    const run = must(
      await db.from('ingest_runs').insert({ status: 'running' }).select('id').single(),
    );
    runId = run.id;
    const sources = must(
      await db.from('sources').select('*').eq('enabled', true).neq('kind', 'manual'),
    );
    const existing = must(
      await db
        .from('articles')
        .select('original_title,title_simhash')
        .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())
        .limit(3000),
    );
    for (const source of sources) {
      if (Date.now() > deadline - 40_000) break;
      try {
        const items = await fetchSource(source, { parser, githubToken: config.githubToken });
        for (const item of items.slice(0, 20)) {
          stats.fetched++;
          const fingerprint = simhash(item.original_title);
          const found = must(
            await db
              .from('articles')
              .select('id')
              .eq('original_url', item.original_url)
              .maybeSingle(),
          );
          if (found || nearDuplicate(item.original_title, fingerprint, existing)) {
            stats.duplicates++;
            continue;
          }
          const { raw_text, ...fields } = item;
          const articleId = must(
            await db.rpc('enqueue_article', {
              article_payload: {
                ...fields,
                source_id: source.id,
                source_name: source.name,
                title_simhash: fingerprint,
              },
              input_text: raw_text,
            }),
          );
          if (!articleId) {
            stats.duplicates++;
            continue;
          }
          stats.inserted++;
          existing.push({ original_title: item.original_title, title_simhash: fingerprint });
        }
        must(
          await db
            .from('sources')
            .update({ last_fetched_at: new Date().toISOString(), last_error: null })
            .eq('id', source.id),
        );
      } catch (error) {
        stats.failed++;
        must(
          await db
            .from('sources')
            .update({ last_error: String(error.message).slice(0, 300) })
            .eq('id', source.id),
        );
      }
    }
    if (config.key) {
      const batch = Math.min(20, Math.max(1, Number(config.batchSize) || 12));
      const queue = must(
        await db
          .from('articles')
          .select('*')
          .in('process_state', ['queued', 'failed'])
          .lt('process_attempts', 3)
          .order('created_at')
          .limit(batch),
      );
      let monthCost = config.monthlyLimit ? Number(must(await db.rpc('monthly_ai_estimate'))) : 0;
      for (const item of queue) {
        if (Date.now() > deadline - 38_000) break;
        // This is an optional estimated spend stop, not a billing-provider hard limit.
        if (config.monthlyLimit && monthCost >= config.monthlyLimit) break;
        const input = must(
          await db
            .from('article_inputs')
            .select('raw_text')
            .eq('article_id', item.id)
            .maybeSingle(),
        );
        if (!input) continue;
        if (
          item.process_state === 'failed' &&
          item.last_attempt_at &&
          Date.now() - Date.parse(item.last_attempt_at) < 6 * 3600000
        )
          continue;
        must(
          await db
            .from('articles')
            .update({
              process_attempts: item.process_attempts + 1,
              last_attempt_at: new Date().toISOString(),
            })
            .eq('id', item.id),
        );
        try {
          const analysis = await analyze(
            { ...item, raw_text: input.raw_text },
            config,
            async (usage) => {
              must(
                await db.from('ai_usage').insert({ ...usage, article_id: item.id, run_id: runId }),
              );
              stats.prompt_tokens += usage.prompt_tokens;
              stats.completion_tokens += usage.completion_tokens;
              stats.estimated_usd += usage.estimated_usd;
              monthCost += usage.estimated_usd;
            },
          );
          const status = publicationStatus(analysis, input.raw_text.length);
          const { relevance, confidence, moderation, ...fields } = analysis;
          // An editor may change state while this task runs. Never overwrite their decision.
          const updated = must(
            await db
              .from('articles')
              .update({
                ...fields,
                status,
                process_state: 'complete',
                processed_at: new Date().toISOString(),
              })
              .eq('id', item.id)
              .in('process_state', ['queued', 'failed'])
              .select('id'),
          );
          if (updated.length) {
            stats.processed++;
            stats[status]++;
          }
        } catch (error) {
          stats.failed++;
          must(
            await db
              .from('articles')
              .update({
                process_state: 'failed',
                moderation_reason: String(error.message).slice(0, 300),
              })
              .eq('id', item.id)
              .in('process_state', ['queued', 'failed']),
          );
        }
      }
    }
    must(
      await db
        .from('ingest_runs')
        .update({
          ...stats,
          status: config.key ? 'complete' : 'awaiting_key',
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId),
    );
    return { ...stats, model_configured: !!config.key };
  } catch (error) {
    if (runId)
      await db
        .from('ingest_runs')
        .update({
          ...stats,
          status: 'failed',
          error: '采集任务中断，请检查数据库配置和来源状态',
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId);
    throw error;
  } finally {
    await db.rpc('release_ingest_lease', { lease_owner: owner });
  }
}
