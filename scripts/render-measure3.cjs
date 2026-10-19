// MagicV 页面几何检查。0=ONE_PAGE；1=OVERFLOW；2=UNKNOWN/导入失败。
const { requireChromium, launchOptions } = require('./lib/browser.cjs');
const { renderArgs, importResume } = require('./lib/online-render.cjs');
const { measurePageGeometry } = require('./lib/pagination.cjs');

(async () => {
  let browser;
  try {
    const options = renderArgs(process.argv.slice(2), 'measure3');
    const { chromium } = requireChromium('render-measure3.cjs');
    browser = await chromium.launch(launchOptions({ headless: true }));
    const page = await browser.newPage({ viewport: { width: 1300, height: 1700 } });
    await importResume(page, options);
    const result = await page.evaluate(measurePageGeometry);
    console.log('量:', JSON.stringify(result, null, 1));
    await page.screenshot({ path: `${options.shot}.png`, timeout: 60000, animations: 'disabled' });
    console.log('范围：仅当前网页实际可见内容的几何检查，最终仍需核对导出 PDF 页数和内容。');
    process.stdout.write(`RESULT ${result.result}\n`);
    process.exitCode = result.result === 'ONE_PAGE' ? 0 : result.result === 'OVERFLOW' ? 1 : 2;
  } catch (error) {
    console.error('ERR', error.message);
    process.stdout.write('RESULT UNKNOWN\n');
    process.exitCode = 2;
  } finally { if (browser) await browser.close(); }
})();
