import { XMLParser } from 'fast-xml-parser';
import { fetchSource } from '../supabase/functions/_shared/sources.mjs';
const sources = [
  { name: 'Real Engineering', kind: 'youtube', locator: 'UCR1IuLEqb6UEA_zQ81kwXfg' },
  { name: 'NASA Aeronautics', kind: 'rss', locator: 'https://www.nasa.gov/aeronautics/feed/' },
  { name: 'GitHub Aerodynamics', kind: 'github', locator: 'aerodynamics' },
];
let failed = false;
for (const source of sources) {
  try {
    const items = await fetchSource(source, {
      parser: new XMLParser({ ignoreAttributes: false, processEntities: false }),
    });
    if (!items.length) throw new Error('返回为空');
    console.log(`${source.name}: OK (${items.length} 条) — ${items[0].original_title}`);
  } catch (error) {
    failed = true;
    console.error(`${source.name}: ${error.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
