import test from 'node:test';
import assert from 'node:assert/strict';
import { aircraftNews, newsPublishedDate } from '../src/lib/aircraft-news.ts';
import { aircraftProfiles } from '../src/lib/aircraft.ts';

const item = (changes = {}) => ({
  id: 'news',
  original_title: 'X-59 flight test',
  title: '试飞进展',
  tags: [],
  status: 'published',
  published_at: '2026-10-08T18:05:00Z',
  original_url: 'https://www.nasa.gov/news/flight-test',
  ...changes,
});

test('Joby eVTOL news does not mix company-wide jet service or the J208 autonomous demonstrator', () => {
  const profile = aircraftProfiles.find((p) => p.id === 'joby-evtol');
  const articles = [
    item({
      id: 'evtol',
      original_title: 'Joby electric air taxi flight',
      original_url: 'https://ir.jobyaviation.com/evtol',
    }),
    item({
      id: 'tagged',
      original_title: 'Joby Launches eIPP Flights in Texas',
      tags: ['Joby eVTOL'],
      original_url: 'https://ir.jobyaviation.com/texas',
    }),
    item({
      id: 'j208',
      original_title: 'Joby Completes Fully Autonomous J208 Flight',
      tags: ['Joby', 'J208'],
      original_url: 'https://ir.jobyaviation.com/j208',
    }),
    item({
      id: 'jets',
      original_title: 'Blade jet service',
      tags: ['Joby'],
      original_url: 'https://ir.jobyaviation.com/jets',
    }),
    item({
      id: 'model-suffix',
      original_title: 'JAS4-10 research',
      original_url: 'https://ir.jobyaviation.com/other-model',
    }),
  ];
  assert.deepEqual(
    aircraftNews(profile, articles).map((article) => article.id),
    ['evtol', 'tagged'],
  );
});

test('aircraft news excludes unpublished items, nearby model numbers and incidental summary mentions', () => {
  const profile = { id: 'x-59' };
  const articles = [
    item(),
    item({ id: 'pending', status: 'pending', original_url: 'https://www.nasa.gov/pending' }),
    item({ id: 'rejected', status: 'rejected', original_url: 'https://www.nasa.gov/rejected' }),
    item({ id: 'other-model', original_title: 'X-590 and AX-59 systems' }),
    item({ id: 'incidental', original_title: 'Wind tunnel study', summary: 'Compared with X-59' }),
    item({ id: 'bad-date', published_at: 'invalid' }),
    item({ id: 'bad-url', original_url: 'javascript:alert(1)' }),
  ];
  assert.deepEqual(
    aircraftNews(profile, articles).map((a) => a.id),
    ['news'],
  );
  assert.equal(aircraftNews({ id: 'unknown' }, articles).length, 0);
});

test('civil and military aliases match without mixing adjacent types; news is newest first and deduplicated', () => {
  const articles = [
    item({
      id: 'civil-old',
      original_title: 'Airbus A350F first flight',
      published_at: '2026-09-29',
      original_url: 'https://www.airbus.com/first',
    }),
    item({
      id: 'civil-new',
      original_title: 'A350-F flight test update',
      original_url: 'https://www.airbus.com/second',
    }),
    item({
      id: 'civil-duplicate',
      original_title: 'A350-F flight test update',
      original_url: 'https://www.airbus.com/second#source',
    }),
    item({
      id: 'passenger',
      original_title: 'A350-900 testing',
      original_url: 'https://www.airbus.com/passenger',
    }),
    item({
      id: 'military',
      original_title: 'Boeing F/A–XX program',
      original_url: 'https://investors.boeing.com/next',
    }),
    item({
      id: 'other-fighter',
      original_title: 'F/A-18 update',
      original_url: 'https://investors.boeing.com/previous',
    }),
  ];
  assert.deepEqual(
    aircraftNews({ id: 'a350f' }, articles).map((a) => a.id),
    ['civil-new', 'civil-old'],
  );
  assert.deepEqual(
    aircraftNews({ id: 'fa-xx' }, articles).map((a) => a.id),
    ['military'],
  );
  assert.equal(articles[0].id, 'civil-old');
});

test('news dates distinguish known Shanghai timestamps from source dates without a timezone', () => {
  assert.equal(newsPublishedDate(item()), '2026.10.09 02:05');
  assert.equal(newsPublishedDate(item({ published_precision: 'date' })), '2026.10.08');
});

test('newly edited model names and aliases use literal matching without regular-expression expansion', () => {
  const profile = { id: 'new-model', name: 'S4 (E)', aliases: ['S4-E'] };
  const articles = [
    item({
      id: 'literal',
      original_title: 'S4 (E) testing',
      original_url: 'https://example.com/literal',
    }),
    item({ id: 'alias', original_title: 'S4-E flight', original_url: 'https://example.com/alias' }),
    item({
      id: 'different',
      original_title: 'S4 E testing',
      original_url: 'https://example.com/other',
    }),
    item({
      id: 'suffix',
      original_title: 'S4-E2 flight',
      original_url: 'https://example.com/suffix',
    }),
  ];
  assert.deepEqual(
    aircraftNews(profile, articles).map((a) => a.id),
    ['literal', 'alias'],
  );
});
