import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, linkSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, syntheticProfile, approvedRequest } from './helpers.mjs';
import renderContract from '../scripts/lib/online-render.cjs';

test('synthetic generated resume passes strict validation', (t) => {
  const s = sandbox(t);
  const result = s.run('validate-resume.mjs', [s.json('valid.json', s.build()), '--strict']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('generated resume is accepted by the online import contract including customData', t => {
  const s = sandbox(t), data = s.build();
  const options = renderContract.renderArgs([s.json('import.json', data), '--chrome', 'synthetic-browser'], 'synthetic-shot');
  assert.equal(options.shot, 'synthetic-shot');
  assert.ok(options.anchors.includes(data.basic.name.replace(/\s+/g, '')));
  assert.ok(options.anchors.includes(data.projects[0].name.replace(/\s+/g, '')));
  for (const field of data.basic.customFields) assert.ok(options.anchors.includes(field.value.replace(/\s+/g, '')));
});

for (const [field, value] of Object.entries({ basic: null, globalSettings: null, education: {}, experience: null, projects: 'invalid', campus: 42 })) {
  test(`strict validation rejects invalid ${field} type`, (t) => {
    const s = sandbox(t), data = s.build();
    data[field] = value;
    const result = s.run('validate-resume.mjs', [s.json('invalid.json', data), '--strict']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /ERROR/);
    assert.doesNotMatch(result.stderr, /TypeError/);
  });
}

test('validation rejects null entries with a useful error', (t) => {
  const s = sandbox(t), data = s.build();
  data.projects = [null];
  const result = s.run('validate-resume.mjs', [s.json('invalid.json', data)]);
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /projects\[0\]/);
  assert.doesNotMatch(result.stderr, /TypeError/);
});

for (const [label, before, after] of [
  ['boolean type', { projects: [{ visible: false }] }, { projects: [{ visible: 'false' }] }],
  ['photo', { basic: { photo: 'data:image/png;base64,first' } }, { basic: { photo: 'data:image/png;base64,second' } }],
  ['empty object', {}, { extra: {} }],
  ['null versus empty string', { title: null }, { title: '' }],
]) {
  test(`authorization rejects unapproved ${label} change`, (t) => {
    const s = sandbox(t);
    const base = s.json('base.json', before);
    const result = s.run('diff-resume.mjs', ['--base', base, '--new', s.json('next.json', after), '--expect', s.json('approval.json', approvedRequest(base))]);
    assert.equal(result.status, 1, result.stdout + result.stderr);
  });
}

test('authorization accepts an approved child field and ignores regenerated metadata', (t) => {
  const s = sandbox(t);
  const base = s.json('base.json', { id: 'old', projects: [{ description: 'before' }] });
  const result = s.run('diff-resume.mjs', ['--base', base, '--new', s.json('next.json', { id: 'new', projects: [{ description: 'after' }] }), '--expect', s.json('approval.json', approvedRequest(base, ['projects[0].description']))]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('authorization keeps literal dotted keys separate from nested field paths', (t) => {
  const s = sandbox(t);
  const base = s.json('base.json', { basic: { name: 'before' }, 'basic.name': 'decoy' });
  const result = s.run('diff-resume.mjs', ['--base', base, '--new', s.json('next.json', { basic: { name: 'after' }, 'basic.name': 'decoy' }), '--expect', s.json('approval.json', approvedRequest(base))]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
});

for (const strategy of [
  { fileName: '../package' }, { fileName: '..\\package' }, { versionTitle: '../package.json' },
  { fileName: 'C:escape' }, { fileName: 'CON' }, { fileName: 'trailing.' },
]) {
  test(`default output rejects unsafe name ${JSON.stringify(strategy)}`, (t) => {
    const s = sandbox(t);
    const sentinel = join(s.root, 'package.json');
    writeFileSync(sentinel, '{"sentinel":true}');
    const result = s.run('build-resume.mjs', ['--profile', s.json('profile.json', syntheticProfile), '--strategy', s.json('strategy.json', strategy), '--quiet']);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.equal(readFileSync(sentinel, 'utf8'), '{"sentinel":true}');
  });
}

test('fallback output name is checked and normal Chinese names remain valid', (t) => {
  const s = sandbox(t), profile = structuredClone(syntheticProfile);
  profile.basic.name = '../package';
  const bad = s.run('build-resume.mjs', ['--profile', s.json('bad-profile.json', profile), '--strategy', s.json('strategy.json', {}), '--quiet']);
  assert.notEqual(bad.status, 0);
  const good = s.run('build-resume.mjs', ['--profile', s.json('profile.json', syntheticProfile), '--strategy', s.json('normal.json', { fileName: '合成候选人 C++ (测试)' }), '--quiet']);
  assert.equal(good.status, 0, good.stderr);
  assert.ok(existsSync(join(s.dir, 'output', '合成候选人 C++ (测试).json')));
});

test('output refuses silent overwrite and protects input even with force', (t) => {
  const s = sandbox(t), profile = s.json('profile.json', syntheticProfile), strategy = s.json('strategy.json', {});
  const out = join(s.dir, 'chosen.json');
  writeFileSync(out, 'keep existing result');
  const overwrite = s.run('build-resume.mjs', ['--profile', profile, '--strategy', strategy, '--out', out, '--quiet']);
  assert.notEqual(overwrite.status, 0);
  assert.equal(readFileSync(out, 'utf8'), 'keep existing result');
  const force = s.run('build-resume.mjs', ['--profile', profile, '--strategy', strategy, '--out', out, '--force', '--quiet']);
  assert.equal(force.status, 0, force.stderr);
  const before = readFileSync(profile, 'utf8');
  const input = s.run('build-resume.mjs', ['--profile', profile, '--strategy', strategy, '--out', profile, '--force', '--quiet']);
  assert.notEqual(input.status, 0);
  assert.equal(readFileSync(profile, 'utf8'), before);
});

test('default output refuses a linked root and leaves the outside sentinel unchanged', (t) => {
  const s = sandbox(t), outside = join(s.dir, 'outside');
  mkdirSync(outside);
  symlinkSync(outside, join(s.dir, 'output'), process.platform === 'win32' ? 'junction' : 'dir');
  writeFileSync(join(outside, 'chosen.json'), 'outside sentinel');
  const result = s.run('build-resume.mjs', ['--profile', s.json('profile.json', syntheticProfile), '--strategy', s.json('strategy.json', { fileName: 'chosen' }), '--quiet']);
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(join(outside, 'chosen.json'), 'utf8'), 'outside sentinel');
});

test('force cannot overwrite an input through a hard-link alias', (t) => {
  const s = sandbox(t), profile = s.json('profile.json', syntheticProfile), alias = join(s.dir, 'alias.json');
  linkSync(profile, alias);
  const before = readFileSync(profile, 'utf8');
  const result = s.run('build-resume.mjs', ['--profile', profile, '--strategy', s.json('strategy.json', {}), '--out', alias, '--force', '--quiet']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /输入|硬链接/);
  assert.equal(readFileSync(profile, 'utf8'), before);
});

test('forced output replacement does not mutate another hard-link owner', (t) => {
  const s = sandbox(t), outside = join(s.dir, 'outside.json'), out = join(s.dir, 'out.json');
  writeFileSync(outside, 'outside sentinel');
  linkSync(outside, out);
  const result = s.run('build-resume.mjs', ['--profile', s.json('profile.json', syntheticProfile), '--strategy', s.json('strategy.json', {}), '--out', out, '--force', '--quiet']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(outside, 'utf8'), 'outside sentinel');
});

test('campus override replaces the fallback content in both representations', (t) => {
  const s = sandbox(t);
  const data = s.build(syntheticProfile, { sectionOverrides: { campus: [{ name: 'Approved New Club', position: 'Member', date: '2023/01', bullets: ['Approved fictional task.'] }] } });
  assert.equal(data.campus[0].name, 'Approved New Club');
  assert.equal(Object.values(data.customData)[0][0].title, 'Approved New Club');
});

test('empty campus override clears the fallback content', (t) => {
  const s = sandbox(t), data = s.build(syntheticProfile, { sectionOverrides: { campus: [] } });
  assert.deepEqual(data.campus, []);
});

test('mixed complete HTML lists never discard the other bullet facts', (t) => {
  const s = sandbox(t), profile = structuredClone(syntheticProfile);
  profile.skills = ['Before fact.', '<ul><li><p>Middle fact.</p></li></ul>', 'After fact.'];
  const data = s.build(profile);
  for (const word of ['Before fact.', 'Middle fact.', 'After fact.']) assert.ok(data.skillContent.includes(word), data.skillContent);
  const checked = s.run('validate-resume.mjs', [s.json('checked.json', data), '--strict']);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
});

test('blueprint merge rejects custom menu semantic mismatch before writing', (t) => {
  const s = sandbox(t), content = s.build(), blueprint = structuredClone(content);
  blueprint.menuSections.find(m => m.id === 'custom-1').title = 'Unrelated Honors';
  const out = join(s.dir, 'merged.json');
  const result = s.run('merge-blueprint.mjs', ['--blueprint', s.json('blueprint.json', blueprint), '--content', s.json('content.json', content), '--out', out]);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.equal(existsSync(out), false);
});

test('compatible blueprint merge preserves its layout and complete new content', (t) => {
  const s = sandbox(t), content = s.build(), blueprint = structuredClone(content);
  blueprint.globalSettings.pagePadding = 20;
  blueprint.basic.photo = '';
  content.basic.photo = 'data:image/png;base64,synthetic';
  const out = join(s.dir, 'merged.json');
  const result = s.run('merge-blueprint.mjs', ['--blueprint', s.json('blueprint.json', blueprint), '--content', s.json('content.json', content), '--out', out]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const merged = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(merged.globalSettings.pagePadding, 20);
  assert.equal(merged.basic.photo, '');
  assert.deepEqual(merged.projects, content.projects);
});
