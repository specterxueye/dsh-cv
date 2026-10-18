#!/usr/bin/env node
/** 本地近似量高；不代表 MagicV 或 PDF 的最终分页验收。 */
import { readFileSync } from 'node:fs';
import browserEnv from './lib/browser.cjs';
import { createMeasurementPage } from './lib/measurement.mjs';

const file = process.argv[2];
if (!file) { console.error('usage: node render-height.mjs <resume.json> [--chrome <path>]'); process.exit(1); }
let browser;
try {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const pw = browserEnv.loadPlaywright();
  if (!pw) { console.error('playwright-core 不可用；安装依赖或设置 DSH_CV_PLAYWRIGHT_DIR'); process.exitCode = 2; }
  else {
    browser = await pw.chromium.launch(browserEnv.launchOptions({ headless: true }));
    const { page, settings: gs } = await createMeasurementPage(browser, json);
    const h = await page.evaluate(() => Math.round(document.getElementById('sheet').getBoundingClientRect().height));
    console.log(`内容高 ≈ ${h}px（A4 一页 1123px → ${(h / 1123).toFixed(2)} 页）${h <= 1123 ? '✅ 一页内' : '❌ 超页'}`);
    console.log(`参数: baseFontSize=${gs.baseFontSize} lineHeight=${gs.lineHeight} header=${gs.headerSize} sub=${gs.subheaderSize} spacing=${gs.sectionSpacing} pad=${gs.pagePadding}`);
    console.log('本地近似量高；MagicV 和 PDF 的实际分页仍须单独验收。');
  }
} catch (error) { console.error(`[测量失败] ${error.message}`); process.exitCode = 1; }
finally { if (browser) await browser.close(); }
