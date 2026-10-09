import { XMLParser } from 'fast-xml-parser';
import { fetchSource } from '../supabase/functions/_shared/sources.mjs';
const sources = [
  { name: 'Real Engineering', kind: 'youtube', locator: 'UCR1IuLEqb6UEA_zQ81kwXfg' },
  { name: 'NASA Aeronautics', kind: 'rss', locator: 'https://www.nasa.gov/aeronautics/feed/' },
  { name: 'NASA Quesst', kind: 'rss', locator: 'https://www.nasa.gov/blogs/quesst/feed/' },
  {
    name: 'Airbus Civil',
    kind: 'rss',
    locator: 'https://www.airbus.com/en/generate-rss-feeds?tid=15571&fid=29711',
  },
  {
    name: 'Airbus Defence',
    kind: 'rss',
    locator: 'https://www.airbus.com/en/generate-rss-feeds?tid=15576&fid=29721',
  },
  {
    name: 'Airbus Innovation',
    kind: 'rss',
    locator: 'https://www.airbus.com/en/generate-rss-feeds?tid=15591&fid=29736',
  },
  { name: 'Boeing', kind: 'rss', locator: 'https://investors.boeing.com/rss/pressrelease.aspx' },
  {
    name: 'Lockheed Martin',
    kind: 'rss',
    locator: 'https://investors.lockheedmartin.com/rss/news-releases.xml',
  },
  {
    name: 'U.S. Air Force',
    kind: 'rss',
    locator:
      'https://www.af.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=1&isdashboardselected=0&max=20',
  },
  {
    name: 'Joby',
    kind: 'rss',
    locator: 'https://ir.jobyaviation.com/news-events/press-releases/rss',
  },
  { name: 'GitHub Aerodynamics', kind: 'github', locator: 'aerodynamics' },
];
let failed = false;
for (const source of sources) {
  try {
    const items = await fetchSource(source, {
      parser: new XMLParser({ ignoreAttributes: false, processEntities: false }),
      youtubeKey: process.env.YOUTUBE_API_KEY,
      githubToken: process.env.GITHUB_TOKEN,
      onTransport: (value) => console.log(`${source.name}: ${value}`),
    });
    if (!items.length) throw new Error('返回为空');
    console.log(`${source.name}: OK (${items.length} 条) — ${items[0].original_title}`);
  } catch (error) {
    failed = true;
    console.error(`${source.name}: ${error.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
