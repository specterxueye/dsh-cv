import { existsSync, lstatSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const automatic = ['package.json', 'README.md', 'LICENSE'];
  if (!Array.isArray(pkg.files) || !pkg.files.length) throw new Error('package.files 必须是逐文件允许清单');
  for (const file of pkg.files) {
    if (typeof file !== 'string' || isAbsolute(file) || /[\\*?!\[\]{}:]/.test(file) || file.split('/').some(x => !x || x === '.' || x === '..')) throw new Error(`非法发布路径：${file}`);
    if (!lstatSync(join(root, file)).isFile()) throw new Error(`发布清单只允许普通文件：${file}`);
  }
  const expected = new Set([...automatic, ...pkg.files]);
  if (expected.size !== pkg.files.length + automatic.filter(x => !pkg.files.includes(x)).length) throw new Error('发布清单含重复路径');
  const scratch = join(root, '.test-runs', 'pack-check');
  mkdirSync(scratch, { recursive: true });
  const npmCli = process.env.npm_execpath;
  if (!npmCli || !existsSync(npmCli)) throw new Error('请使用 npm run check:package，以所用 npm CLI 执行打包检查');
  const result = spawnSync(process.execPath, [npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, npm_config_cache: join(scratch, 'cache'), TEMP: scratch, TMP: scratch, TMPDIR: scratch },
  });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || `npm pack 退出 ${result.status}`);
  const report = JSON.parse(result.stdout);
  const entries = Array.isArray(report) ? report : Object.values(report);
  if (entries.length !== 1 || !Array.isArray(entries[0].files) || !entries[0].files.length) throw new Error('npm pack 未返回单个非空包');
  const packed = new Set(entries[0].files.map(x => x.path));
  const unexpected = [...packed].filter(x => !expected.has(x));
  const missing = [...expected].filter(x => !packed.has(x));
  if (unexpected.length || missing.length) throw new Error(`发布包与清单不一致，额外：${unexpected.join(', ') || '无'}；缺失：${missing.join(', ') || '无'}`);
  console.log(`PACKAGE_OK ${pkg.name}@${pkg.version}: ${packed.size} files, ${entries[0].unpackedSize} bytes; exact allowlist`);
} catch (error) {
  console.error(`PACKAGE_ERROR ${error.message}`);
  process.exitCode = 1;
}
