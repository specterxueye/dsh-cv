import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { sandbox, repoRoot } from './helpers.mjs';
import browserEnv from '../scripts/lib/browser.cjs';

// Run the real CLI/evaluation code against an offline browser document. Only
// navigation/upload are replaced; text geometry comes from Chromium's layout.
async function runMeasurement(t, content, { marker = true, uploadError = false, wrongIdentity = false } = {}) {
  const s = sandbox(t);
  const input = s.json('resume.json', { basic: { name: '合成人物' }, projects: [{ name: '合成项目', description: '<p>合成正文</p>' }], customData: {} });
  const browser = await browserEnv.loadPlaywright().chromium.launch(browserEnv.launchOptions({ headless: true, env: { ...process.env, TEMP: s.dir, TMP: s.dir, TMPDIR: s.dir } }));
  const page = await browser.newPage();
  await page.setContent(`<style>body{margin:0}.paper{position:relative;width:794px;height:1600px;font:16px/20px sans-serif}p{margin:0}.mark{position:absolute;top:1000px;height:20px;line-height:20px}.identity{position:absolute;top:0}</style><div class="paper w-[210mm]"><div class="identity">${wrongIdentity ? '错误人物' : '合成人物'} 合成项目 合成正文</div>${content}${marker ? '<span class="mark">第1页结束</span>' : ''}</div><!--${'padding'.repeat(2000)}-->`);
  const logs = [];
  let code = 0;
  const fileLocator = { setInputFiles: async () => { if (uploadError) throw new Error('synthetic upload failed'); }, waitFor: async () => {} };
  const facade = new Proxy(page, { get(target, key) {
    if (['goto', 'reload', 'waitForTimeout', 'screenshot'].includes(key)) return async () => {};
    if (key === 'getByText') return () => ({ first: () => ({ click: async () => {} }), click: async () => {} });
    if (key === 'waitForFunction') return (fn, arg) => target.waitForFunction(fn, arg, { timeout: 300 });
    if (key === 'locator') return (selector) => selector.startsWith('input') ? fileLocator : target.locator(selector);
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const script = join(repoRoot, 'scripts/render-measure3.cjs'), localRequire = createRequire(script);
  const context = {
    require: name => name === './lib/browser.cjs' ? { requireChromium: () => ({ chromium: { launch: async () => ({ newPage: async () => facade, close: async () => {} }) } }), launchOptions: () => ({}) } : localRequire(name),
    console: { log: (...v) => logs.push(v.join(' ')), error: (...v) => logs.push(v.join(' ')), warn: (...v) => logs.push(v.join(' ')) },
    process: { argv: [process.execPath, script, input, join(s.dir, 'shot')], stdout: { write: v => logs.push(v) }, env: process.env, exit: value => { code = value; throw new Error('test process exit'); }, get exitCode() { return code; }, set exitCode(value) { code = value; } },
    __dirname: join(repoRoot, 'scripts'), __filename: script, setTimeout, clearTimeout,
  };
  try {
    await vm.runInNewContext(readFileSync(script, 'utf8'), context, { filename: script });
    return { code, output: logs.join('\n') };
  } finally { await browser.close(); }
}

test('mixed bold and regular text is measured through its final rendered line', async t => {
  const r = await runMeasurement(t, `<p style="position:absolute;top:980px;width:100px"><strong>前缀</strong>${'后续普通正文'.repeat(30)}</p>`);
  assert.equal(r.code, 1, r.output);
  assert.match(r.output, /RESULT OVERFLOW/);
});

test('a missing page boundary is UNKNOWN and fails with exit 2', async t => {
  const r = await runMeasurement(t, '<p style="position:absolute;top:60px">正文</p>', { marker: false });
  assert.equal(r.code, 2, r.output);
  assert.match(r.output, /RESULT UNKNOWN/);
});

test('plain overflow fails with exit 1', async t => {
  const r = await runMeasurement(t, '<p style="position:absolute;top:1100px">超页正文</p>');
  assert.equal(r.code, 1, r.output);
});

test('content between marker top and actual bottom fits', async t => {
  const r = await runMeasurement(t, '<p style="position:absolute;top:990px">临界正文</p>');
  assert.equal(r.code, 0, r.output);
  assert.match(r.output, /RESULT ONE_PAGE/);
});

test('visible graphics beyond the boundary also fail', async t => {
  const r = await runMeasurement(t, '<svg style="position:absolute;top:1100px" width="30" height="30"><rect width="30" height="30"/></svg>');
  assert.equal(r.code, 1, r.output);
});

test('hidden text below the page does not cause overflow', async t => {
  const r = await runMeasurement(t, '<p style="display:none;position:absolute;top:1200px">隐藏正文</p><p style="position:absolute;top:60px">正文</p>');
  assert.equal(r.code, 0, r.output);
});

test('failed upload cannot be ignored', async t => {
  const r = await runMeasurement(t, '<p style="position:absolute;top:60px">正文</p>', { uploadError: true });
  assert.equal(r.code, 2, r.output);
  assert.match(r.output, /synthetic upload failed/);
});

test('a rendered old document cannot substitute for the imported document', async t => {
  const r = await runMeasurement(t, '<p style="position:absolute;top:60px">正文</p>', { wrongIdentity: true });
  assert.equal(r.code, 2, r.output);
  assert.match(r.output, /身份|内容核对|identity/i);
});
