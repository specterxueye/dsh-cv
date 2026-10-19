import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, syntheticProfile } from './helpers.mjs';

for (const kind of ['template', 'example']) {
  test(`${kind} cannot be generated or used as a fact source`, t => {
    const s = sandbox(t), profile = s.json('source.json', { ...syntheticProfile, _meta: { kind } });
    const built = s.run('build-resume.mjs', ['--profile', profile, '--strategy', s.json('strategy.json', {})]);
    assert.notEqual(built.status, 0, built.stdout + built.stderr);
    const audited = s.run('audit-facts.mjs', [s.json('draft.json', { description: '2023年' }), '--profile', profile]);
    assert.equal(audited.status, 2, audited.stdout + audited.stderr);
  });
}

for (const status of ['pending', 'retracted']) {
  test(`${status} values cannot enter a generated resume or source set`, t => {
    const s = sandbox(t), p = structuredClone(syntheticProfile);
    p.projects[0].bullets = [{ value: '协助测试98765次', status, source: '用户尚未确认' }];
    const profile = s.json('source.json', p);
    const built = s.run('build-resume.mjs', ['--profile', profile, '--strategy', s.json('strategy.json', {})]);
    assert.notEqual(built.status, 0, built.stdout + built.stderr);
    const audited = s.run('audit-facts.mjs', [s.json('draft.json', { description: '98765次' }), '--profile', profile]);
    assert.equal(audited.status, 1, audited.stdout + audited.stderr);
  });
}

test('a confirmed value uses user confirmation without upgrading role or material strength', t => {
  const s = sandbox(t), p = structuredClone(syntheticProfile);
  p.projects[0].bullets = [{ value: '协助测试25次', status: 'confirmed', source: { kind: 'user-confirmation', reference: '本次明确确认' }, evidenceStatus: 'unverified' }];
  const data = s.build(p);
  assert.match(data.projects[0].description, /协助测试/);
  assert.doesNotMatch(data.projects[0].description, /主导|独立|\[object Object\]|unverified|user-confirmation/);
  const result = s.run('audit-facts.mjs', [s.json('draft.json', { description: '协助测试25次' }), '--profile', s.json('source.json', p)]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('a confirmed wrapper without a source fails rather than silently asserting confirmation', t => {
  const s = sandbox(t), p = structuredClone(syntheticProfile);
  p.projects[0].bullets = [{ value: '处理25次', status: 'confirmed' }];
  const built = s.run('build-resume.mjs', ['--profile', s.json('source.json', p), '--strategy', s.json('strategy.json', {})]);
  assert.notEqual(built.status, 0, built.stdout + built.stderr);
  assert.match(built.stderr, /source|来源/);
});

test('public writing references cannot act as personal fact corpus', t => {
  const s = sandbox(t), publicDir = join(s.root, 'data', 'samples');
  mkdirSync(publicDir, { recursive: true });
  const reference = join(publicDir, 'example.md'); writeFileSync(reference, '示意数据：处理98765次');
  const result = s.run('audit-facts.mjs', [s.json('draft.json', { description: '98765次' }), '--corpus', reference]);
  assert.equal(result.status, 2, result.stdout + result.stderr);
});

test('unknown employment status stays empty and a professional two-page strategy is accepted', t => {
  const s = sandbox(t), data = s.build(syntheticProfile, { policy: { audience: 'professional', maxPages: 2 }, settings: { autoOnePage: false } });
  assert.equal(data.basic.employementStatus, '');
  assert.equal(data.globalSettings.autoOnePage, false);
  const r = s.run('validate-resume.mjs', [s.json('two-page.json', data), '--strict']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('a copied reference marker remains ineligible as personal source', t => {
  const s = sandbox(t), reference = join(s.dir, 'copied.md');
  writeFileSync(reference, '<!-- dsh-cv:reference -->\n表达示意：完成98765次');
  const r = s.run('audit-facts.mjs', [s.json('draft.json', { description: '98765次' }), '--corpus', reference]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
});

test('a nested example cannot hide inside an otherwise personal source', t => {
  const s = sandbox(t), source = s.json('source.json', { _meta: { kind: 'user-profile' }, notes: [{ _meta: { kind: 'example' }, description: '完成98765次' }] });
  const r = s.run('audit-facts.mjs', [s.json('draft.json', { description: '98765次' }), '--profile', source]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
});
