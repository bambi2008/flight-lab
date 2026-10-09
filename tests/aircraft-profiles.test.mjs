import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aircraftProfiles } from '../src/lib/aircraft.ts';
import { parseAircraftProfile, emptyAircraftProfile } from '../src/lib/aircraft-validation.ts';
import { openDatabase, adminId } from '../scripts/local/database.mjs';

test('published dossiers require complete sources and per-parameter evidence; partial drafts remain saveable', () => {
  for (const profile of aircraftProfiles)
    assert.equal(parseAircraftProfile(profile).id, profile.id);
  const draft = { ...emptyAircraftProfile(), id: 'new-aircraft', name: '待核对机型' };
  assert.equal(parseAircraftProfile(draft, false).name, '待核对机型');
  assert.throws(() => parseAircraftProfile(draft), /请填写|至少添加|有效来源/);
  for (const patch of [
    { specs: [] },
    { specs: [{ ...aircraftProfiles[0].specs[0], source: 'missing' }] },
    { specs: [{ ...aircraftProfiles[0].specs[0], note: '' }] },
    { specs: [{ ...aircraftProfiles[0].specs[0], evidence: 'verified by AI' }] },
  ])
    assert.throws(() => parseAircraftProfile({ ...aircraftProfiles[0], ...patch }));
  const target = {
    ...aircraftProfiles[0],
    specs: [{ ...aircraftProfiles[0].specs[0], evidence: '研制目标' }],
  };
  assert.equal(parseAircraftProfile(target).specs[0].evidence, '研制目标');
});

test('dossier validation rejects unsafe source links, broken dates and oversized payloads', () => {
  const profile = aircraftProfiles[0];
  for (const url of [
    'javascript:alert(1)',
    'http://www.nasa.gov/',
    'https://secret:password@www.nasa.gov/',
  ])
    assert.throws(() =>
      parseAircraftProfile({ ...profile, sources: [{ ...profile.sources[0], url }] }),
    );
  assert.throws(() => parseAircraftProfile({ ...profile, checkedAt: '2026-02-31' }), /日期/);
  assert.throws(() => parseAircraftProfile({ ...profile, id: '../outside' }), /网址/);
  assert.throws(() => parseAircraftProfile({ ...profile, summary: '中'.repeat(2001) }), /过长/);
  assert.equal(
    parseAircraftProfile({ ...profile, internal_notes: 'not a public field' }).internal_notes,
    undefined,
  );
});

test('editable dossiers enforce RLS, database publication checks, version conflicts and restart persistence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flightlab-dossiers-'));
  let db = await openDatabase(directory);
  const select = {
    table: 'aircraft_profiles',
    operation: 'select',
    fields: 'id,profile,status,display_order',
  };
  const write = { table: 'aircraft_profiles', operation: 'insert', fields: 'id', returning: true };
  try {
    assert.equal((await db.execute(select, 'anon')).data.length, aircraftProfiles.length);
    assert((await db.execute({ ...select, fields: 'revision' }, 'anon')).error);
    const fixture = { ...structuredClone(aircraftProfiles[0]), id: 'fixture-aircraft' };
    assert(
      (
        await db.execute(
          { ...write, values: { id: fixture.id, profile: fixture, status: 'draft' } },
          'anon',
        )
      ).error,
    );
    const visitor = '00000000-0000-4000-8000-000000000002';
    await db.pg.query('insert into auth.users(id) values($1)', [visitor]);
    assert(
      (
        await db.execute(
          { ...write, values: { id: fixture.id, profile: fixture, status: 'draft' } },
          'authenticated',
          visitor,
        )
      ).error,
    );
    const update = {
      table: 'aircraft_profiles',
      operation: 'update',
      fields: 'id,revision',
      returning: true,
      filters: [{ column: 'id', op: 'eq', value: 'x-59' }],
    };
    assert.equal(
      (await db.execute({ ...update, values: { status: 'draft' } }, 'authenticated', visitor)).data
        .length,
      0,
    );
    assert.equal(
      (
        await db.execute(
          { ...write, values: { id: fixture.id, profile: fixture, status: 'draft' } },
          'authenticated',
          adminId,
        )
      ).error,
      null,
    );
    assert.equal(
      (
        await db.execute(
          { ...select, filters: [{ column: 'id', op: 'eq', value: fixture.id }] },
          'anon',
        )
      ).data.length,
      0,
    );
    const broken = { ...fixture, specs: [{ ...fixture.specs[0], source: 'unknown-source' }] };
    const fixtureUpdate = { ...update, filters: [{ column: 'id', op: 'eq', value: fixture.id }] };
    assert.equal(
      (
        await db.execute(
          { ...fixtureUpdate, values: { profile: broken, status: 'published' } },
          'authenticated',
          adminId,
        )
      ).error.code,
      '23514',
    );
    assert.equal(
      (
        await db.execute(
          { ...fixtureUpdate, values: { profile: { ...fixture, stage: '' }, status: 'published' } },
          'authenticated',
          adminId,
        )
      ).error.code,
      '23514',
    );
    const fresh = {
      ...fixtureUpdate,
      filters: [...fixtureUpdate.filters, { column: 'revision', op: 'eq', value: 1 }],
    };
    const changed = { ...fixture, stage: '已核对的试飞阶段' };
    const saved = await db.execute(
      { ...fresh, values: { profile: changed, status: 'published' } },
      'authenticated',
      adminId,
    );
    assert.equal(saved.error, null);
    assert.equal(saved.data[0].revision, 2);
    const stale = await db.execute(
      { ...fresh, values: { profile: fixture } },
      'authenticated',
      adminId,
    );
    assert.equal(stale.error, null);
    assert.equal(stale.data.length, 0);
    const rename = await db.execute(
      {
        ...fixtureUpdate,
        values: { id: 'different-url', profile: { ...changed, id: 'different-url' } },
      },
      'authenticated',
      adminId,
    );
    assert(rename.error);
    assert.equal(
      (
        await db.execute(
          { ...select, filters: [{ column: 'id', op: 'eq', value: fixture.id }] },
          'anon',
        )
      ).data[0].profile.stage,
      changed.stage,
    );
    await db.pg.close();
    db = await openDatabase(directory);
    const restored = (
      await db.execute(
        { ...select, filters: [{ column: 'id', op: 'eq', value: fixture.id }] },
        'anon',
      )
    ).data[0];
    assert.equal(restored.profile.stage, changed.stage);
    assert.equal(restored.status, 'published');
    assert.equal(
      (await db.pg.query('select count(*)::int as count from aircraft_profiles')).rows[0].count,
      aircraftProfiles.length + 1,
    );
  } finally {
    await db.pg.close();
    await rm(directory, { recursive: true, force: true });
  }
});
