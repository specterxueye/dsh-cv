import { cpSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const syntheticProfile = JSON.parse(readFileSync(join(repoRoot, 'tests/fixtures/synthetic-profile.json'), 'utf8'));
const scratchRoot = join(repoRoot, '.test-runs');

export function sandbox(t) {
  mkdirSync(scratchRoot, { recursive: true });
  const dir = mkdtempSync(join(scratchRoot, 'case-'));
  const root = join(dir, 'package');
  mkdirSync(join(root, 'scripts'), { recursive: true });
  for (const file of ['build-resume.mjs', 'validate-resume.mjs', 'diff-resume.mjs', 'merge-blueprint.mjs', 'audit-facts.mjs', 'render-height.mjs']) {
    copyFileSync(join(repoRoot, 'scripts', file), join(root, 'scripts', file));
  }
  cpSync(join(repoRoot, 'scripts/lib'), join(root, 'scripts/lib'), { recursive: true });
  t.after(() => {
    const child = relative(scratchRoot, dir);
    assert.ok(child && !child.startsWith('..') && !child.includes(':'));
    rmSync(dir, { recursive: true, force: true });
  });
  const json = (name, data) => {
    const file = join(dir, name);
    writeFileSync(file, JSON.stringify(data, null, 2));
    return file;
  };
  const run = (script, args) => spawnSync(process.execPath, [join(root, 'scripts', script), ...args], {
    cwd: root,
    env: { ...process.env, TEMP: dir, TMP: dir, TMPDIR: dir, DSH_CV_PLAYWRIGHT_DIR: repoRoot },
    encoding: 'utf8', timeout: 45000,
  });
  const build = (profile = syntheticProfile, strategy = {}) => {
    const out = join(dir, 'resume.json');
    const result = run('build-resume.mjs', ['--profile', json('profile.json', profile), '--strategy', json('strategy.json', strategy), '--out', out, '--quiet']);
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
    return JSON.parse(readFileSync(out, 'utf8'));
  };
  return { dir, root, json, run, build };
}
