import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sandbox, repoRoot } from './helpers.mjs';

// Explicit opt-in integration command. It never uses the user's live DSH_HOME.
test('native DSH add, resource discovery, update and remove keep external data intact', async t => {
  const cli = process.env.DSH_TEST_CLI;
  assert.ok(cli && existsSync(cli), '设置 DSH_TEST_CLI 为已安装 dsh/lib/bin.js 的绝对路径');
  const s = sandbox(t), home = join(s.dir, 'isolated-home'), source = join(s.dir, "资源 O'Brien 中文"), data = join(s.dir, 'private-data');
  mkdirSync(source); mkdirSync(data); mkdirSync(join(s.dir, 'tmp'));
  writeFileSync(join(data, 'sentinel.txt'), 'synthetic private data');
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  writeFileSync(join(source, 'package.json'), JSON.stringify(pkg, null, 2));
  for (const resource of pkg.files) {
    if (!existsSync(join(repoRoot, resource))) continue;
    cpSync(join(repoRoot, resource), join(source, resource), { recursive: true });
  }
  const env = { ...process.env, DSH_HOME: home, XDG_CACHE_HOME: join(s.dir, 'cache'), npm_config_cache: join(s.dir, 'cache'), TEMP: join(s.dir, 'tmp'), TMP: join(s.dir, 'tmp'), TMPDIR: join(s.dir, 'tmp') };
  env.DSH_CV_ROOT = join(s.dir, 'stale-root');
  const run = (...args) => {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: s.dir, env, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stdout + result.stderr + (result.error?.message || ''));
    if (args.includes('--dump-config') && result.stderr) console.log('DSH dump diagnostic:', result.stderr.slice(0, 1600));
    return result.stdout;
  };
  const pnpmOptions = ['--store-dir', join(s.dir, 'store'), '--offline', '--ignore-scripts'];
  run('--profile', 'dsh-cv-test', '--from-default-profile', 'web', '--dump-config');
  run('plugin', '--profile', 'dsh-cv-test', 'add', source, ...pnpmOptions);
  const profile = join(home, 'profiles', 'dsh-cv-test'), installed = join(profile, 'node_modules', 'dsh-cv');
  const verifyInstalled = () => {
    assert.ok(existsSync(join(installed, 'cordis.patch.yml')));
    const config = run('--profile', 'dsh-cv-test', '--dump-config');
    assert.ok(config.includes('dsh-cv-skills'), `插件未进入组合，profile: ${readFileSync(join(profile, 'package.json'), 'utf8')}`);
    assert.match(config, /includeDefaultRoots: false/);
    const check = spawnSync(process.execPath, [join(repoRoot, 'tests/dsh-provider-check.mjs'), cli, installed, profile, home, s.dir], { cwd: s.dir, env, encoding: 'utf8', timeout: 45000 });
    assert.equal(check.status, 0, check.stdout + check.stderr + (check.error?.message || ''));
    assert.match(check.stdout, /SKILLS_OK/);
  };
  await verifyInstalled();

  const paths = spawnSync(process.execPath, [join(installed, 'scripts/paths.mjs'), '--data-dir', data], { cwd: s.dir, env, encoding: 'utf8' });
  assert.equal(paths.status, 0, paths.stderr);
  assert.equal(JSON.parse(paths.stdout).dataDir, data);
  const updated = { ...pkg, version: `${pkg.version.split('-')[0]}-rc.integration.1`, description: `${pkg.description} (synthetic update)` };
  const updateSource = join(s.dir, "更新 O'Brien 包");
  cpSync(source, updateSource, { recursive: true });
  writeFileSync(join(updateSource, 'package.json'), JSON.stringify(updated));
  run('plugin', '--profile', 'dsh-cv-test', 'add', updateSource, ...pnpmOptions);
  assert.equal(realpathSync(installed), realpathSync(updateSource));
  assert.match(JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')).description, /synthetic update/);
  run('plugin', '--profile', 'dsh-cv-test', 'remove', 'dsh-cv', ...pnpmOptions);
  const after = JSON.parse(readFileSync(join(profile, 'package.json'), 'utf8'));
  assert.equal(after.dependencies?.['dsh-cv'], undefined);
  assert.doesNotMatch(run('--profile', 'dsh-cv-test', '--dump-config'), /id: dsh-cv-skills/);
  run('plugin', '--profile', 'dsh-cv-test', 'add', source, ...pnpmOptions);
  assert.equal(JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')).version, pkg.version);
  run('plugin', '--profile', 'dsh-cv-test', 'remove', 'dsh-cv', ...pnpmOptions);
  // Install the actual npm artifact, not only a linked checkout. No personal
  // directories are copied; npm's exact package.files allowlist is enforced by
  // the separate packaging regression.
  assert.ok(process.env.npm_execpath && existsSync(process.env.npm_execpath), '使用 npm run test:dsh 运行归档安装测试');
  const packedDir = join(s.dir, 'archive');
  mkdirSync(packedDir);
  const packed = spawnSync(process.execPath, [process.env.npm_execpath, 'pack', repoRoot, '--pack-destination', packedDir, '--ignore-scripts', '--json'], { cwd: s.dir, env, encoding: 'utf8', timeout: 60000 });
  assert.equal(packed.status, 0, packed.stdout + packed.stderr + (packed.error?.message || ''));
  const packedReport = JSON.parse(packed.stdout);
  const artifact = (Array.isArray(packedReport) ? packedReport : Object.values(packedReport))[0];
  assert.ok(artifact?.filename && !artifact.filename.includes('/') && !artifact.filename.includes('\\'));
  run('plugin', '--profile', 'dsh-cv-test', 'add', join(packedDir, artifact.filename), ...pnpmOptions);
  assert.equal(JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')).version, pkg.version);
  await verifyInstalled();
  run('plugin', '--profile', 'dsh-cv-test', 'remove', 'dsh-cv', ...pnpmOptions);
  assert.equal(readFileSync(join(data, 'sentinel.txt'), 'utf8'), 'synthetic private data');
  console.log('NATIVE lifecycle: add / evaluated bundle paths / 4 actual skills / unrelated cwd / new-source update / remove / restore / packed tgz add + discovery + remove / data intact');
});
