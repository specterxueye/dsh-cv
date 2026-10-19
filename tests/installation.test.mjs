import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, repoRoot, syntheticProfile } from './helpers.mjs';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

test('default build output follows the selected profile directory outside the package', t => {
  const s = sandbox(t), profile = s.json('person.json', syntheticProfile), strategy = s.json('job.json', { fileName: '合成默认输出' });
  const result = s.run('build-resume.mjs', ['--profile', profile, '--strategy', strategy]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(existsSync(join(s.dir, 'output', '合成默认输出.json')), result.stdout);
  assert.equal(existsSync(join(s.root, 'output')), false);
});

test('package declares a native config-only DSH bundle and an explicit tested prerelease', () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(typeof pkg.dsh?.bundle?.patch, 'string');
  assert.ok(existsSync(join(repoRoot, pkg.dsh.bundle.patch)));
  assert.match(pkg.engines?.dsh || '', /0\.2\.0-rc\.1/);
});

test('publication uses a resource allowlist without local scripts or user directories', () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0);
  assert.ok(pkg.files.includes('scripts/build-resume.mjs'));
  for (const file of pkg.files) assert.doesNotMatch(file, /^(users|test|output|\.test-runs)\b|scripts\/\*|^scripts\/?$/);
});

test('legacy same-name skill conflict fails before installation and preserves its owner', { skip: process.platform !== 'win32' }, t => {
  const s = sandbox(t), home = join(s.dir, 'legacy-home'), conflict = join(home, 'skills', 'resume-writing');
  mkdirSync(conflict, { recursive: true });
  writeFileSync(join(conflict, 'owner.txt'), 'foreign synthetic skill');
  const r = spawnSync('pwsh', ['-NoProfile', '-File', join(repoRoot, 'scripts/install.ps1'), '-Profile', 'synthetic'], { cwd: s.dir, env: { ...process.env, DSH_HOME: home, DSH_CV_ROOT: join(s.dir, 'stale-root') }, encoding: 'utf8' });
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /同名技能/);
  assert.equal(readFileSync(join(conflict, 'owner.txt'), 'utf8'), 'foreign synthetic skill');
});
