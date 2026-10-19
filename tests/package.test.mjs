import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot, sandbox } from './helpers.mjs';

test('packed artifact excludes accidental private files even inside public resource directories', t => {
  const s = sandbox(t), pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  for (const file of pkg.files) {
    assert.ok(!file.endsWith('/'), `整目录不允许进入发布清单：${file}`);
    const target = join(s.root, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(repoRoot, file), target);
  }
  for (const file of ['package.json', 'README.md', 'LICENSE', 'scripts/check-package.mjs']) {
    mkdirSync(dirname(join(s.root, file)), { recursive: true });
    copyFileSync(join(repoRoot, file), join(s.root, file));
  }
  for (const file of ['users/private.json', 'output/private.json', 'profile/private.json', 'data/private.md', 'preset/skills/private.md', 'scripts/_personal.mjs', '.env']) {
    mkdirSync(dirname(join(s.root, file)), { recursive: true });
    writeFileSync(join(s.root, file), 'SYNTHETIC_PRIVATE_CANARY');
  }
  const result = spawnSync(process.execPath, [join(s.root, 'scripts/check-package.mjs')], {
    cwd: s.root, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, TEMP: s.dir, TMP: s.dir, TMPDIR: s.dir, npm_config_cache: join(s.dir, 'npm-cache') },
  });
  assert.equal(result.status, 0, result.stdout + result.stderr + (result.error?.message || ''));
  assert.match(result.stdout, /PACKAGE_OK/);
  assert.doesNotMatch(result.stdout, /SYNTHETIC_PRIVATE_CANARY/);
});
