import test from 'node:test';
import assert from 'node:assert/strict';
import { sandbox } from './helpers.mjs';
import browserEnv from '../scripts/lib/browser.cjs';
import { createMeasurementPage } from '../scripts/lib/measurement.mjs';

test('offline measurement renders script-shaped names as text', (t) => {
  const s = sandbox(t), data = s.build();
  data.basic.name = '<script>document.getElementById("sheet").style.height="9000px"</script>';
  const result = s.run('render-height.mjs', [s.json('untrusted.json', data)]);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const height = Number(result.stdout.match(/内容高 ≈ (\d+)px/)?.[1]);
  assert.ok(height > 0 && height < 2000, result.stdout + result.stderr);
});

test('offline measurement rejects attribute-shaped layout parameters', (t) => {
  const s = sandbox(t), data = s.build();
  data.globalSettings.baseFontSize = '13px"><script>document.getElementById("sheet").style.height="9000px"</script><p style="font-size:13';
  const result = s.run('render-height.mjs', [s.json('untrusted.json', data)]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /baseFontSize|有限数字/);
});

test('offline measurement preserves rich-text entities while copying no active nodes or resources', async (t) => {
  const s = sandbox(t), data = s.build();
  data.projects[0].description = '<p>A &amp; B &lt;T&gt;</p><ul><li><p>First<strong> bold</strong><br>next line<img src="https://example.invalid/probe" onerror="globalThis.syntheticProbe=true"><svg onload="globalThis.syntheticProbe=true"></svg><script>globalThis.syntheticProbe=true</script></p></li></ul>';
  const pw = browserEnv.loadPlaywright();
  assert.ok(pw, 'browser tests require playwright-core');
  const browser = await pw.chromium.launch(browserEnv.launchOptions({ headless: true, env: { ...process.env, TEMP: s.dir, TMP: s.dir, TMPDIR: s.dir } }));
  try {
    let requests = 0;
    const { page } = await createMeasurementPage({ newPage: async options => {
      const page = await browser.newPage(options);
      page.on('request', () => { requests++; });
      return page;
    } }, data);
    const state = await page.evaluate(() => ({ text: document.body.innerText, active: document.querySelectorAll('script,img,iframe,svg,object,link').length, executed: globalThis.syntheticProbe === true, rect: { width: document.getElementById('sheet').getBoundingClientRect().width, height: document.getElementById('sheet').getBoundingClientRect().height } }));
    assert.match(state.text, /A & B <T>/);
    assert.match(state.text, /First bold\nnext line/);
    assert.equal(state.active, 0);
    assert.equal(state.executed, false);
    assert.equal(requests, 0);
    assert.equal(state.rect.width, 794);
    assert.ok(state.rect.height > 0);
  } finally { await browser.close(); }
});
