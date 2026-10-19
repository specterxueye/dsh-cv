import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox, syntheticProfile } from './helpers.mjs';

test('an old approved boolean cannot authorize a different baseline', t => {
  const s = sandbox(t), base = { basic: { title: '旧稿' } }, next = { basic: { title: '新稿' } };
  const result = s.run('diff-resume.mjs', ['--base', s.json('base.json', base), '--new', s.json('next.json', next), '--expect', s.json('request.json', { approved: true, approvedAt: '2026-10-18T00:00:00Z', touchedFields: ['basic.title'], baseSha256: '0'.repeat(64) })]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /基稿|原稿|绑定|schemaVersion/);
});

test('baseline binding is checked even when no visible fields changed', t => {
  const s = sandbox(t), data = { basic: { title: '稿件' } }, base = s.json('base.json', data);
  const hash = createHash('sha256').update(readFileSync(base)).digest('hex');
  const request = { schemaVersion: 2, mode: 'edit', approved: true, approvedAt: '2026-10-18T00:00:00Z', touchedFields: [], baseSha256: hash, planSha256: '0'.repeat(64) };
  const r = s.run('diff-resume.mjs', ['--base', base, '--new', s.json('next.json', data), '--expect', s.json('request.json', request)]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /方案|planSha256/);
});

test('first creation prepares an unapproved plan and validates only after explicit recorded approval', t => {
  const s = sandbox(t), plan = s.json('plan.json', { mode: 'create', changes: ['创建已确认项目'], touchedFields: [] }), profile = s.json('profile.json', { basic: { name: '合成人物' } }), strategy = s.json('strategy.json', { jobTitle: '合成岗位' }), request = s.json('placeholder.json', {});
  const out = request.replace('placeholder.json', 'request.json');
  const prepared = s.run('approval.mjs', ['prepare', '--plan', plan, '--out', out, '--profile', profile, '--strategy', strategy]);
  assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr);
  const record = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(record.approved, false);
  const args = ['check', '--request', out, '--profile', profile, '--strategy', strategy];
  assert.equal(s.run('approval.mjs', args).status, 1);
  record.approved = true; record.approvedAt = '2026-10-19T00:00:00Z';
  writeFileSync(out, JSON.stringify(record));
  assert.equal(s.run('approval.mjs', args).status, 0);
  writeFileSync(strategy, JSON.stringify({ jobTitle: '不同岗位' }));
  const stale = s.run('approval.mjs', args);
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /策略绑定/);
});

test('first resume creation completes approval, generation, structure and source checks without a blueprint', t => {
  const s = sandbox(t), plan = s.json('plan.json', { mode: 'create', changes: ['仅采用已确认的合成经历'], touchedFields: [] });
  const profile = s.json('person.json', syntheticProfile), strategy = s.json('job.json', { policy: { audience: 'campus', maxPages: 1 } }), request = plan.replace('plan.json', 'request.json'), out = plan.replace('plan.json', 'resume.json');
  assert.equal(s.run('approval.mjs', ['prepare', '--plan', plan, '--out', request, '--profile', profile, '--strategy', strategy]).status, 0);
  const record = JSON.parse(readFileSync(request)); record.approved = true; record.approvedAt = new Date().toISOString();
  writeFileSync(request, JSON.stringify(record));
  for (const [script, args] of [
    ['approval.mjs', ['check', '--request', request, '--profile', profile, '--strategy', strategy]],
    ['build-resume.mjs', ['--profile', profile, '--strategy', strategy, '--out', out]],
    ['validate-resume.mjs', [out, '--strict']],
    ['audit-facts.mjs', [out, '--profile', profile]],
  ]) {
    const result = s.run(script, args);
    assert.equal(result.status, 0, `${script}: ${result.stdout}${result.stderr}`);
  }
});
