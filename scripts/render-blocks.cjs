// 版面逐块称重：共享导入身份核对；仅作诊断，不给出页数结论。
const { requireChromium, launchOptions } = require('./lib/browser.cjs');
const { renderArgs, importResume } = require('./lib/online-render.cjs');

(async () => {
  let browser;
  try {
    const options = renderArgs(process.argv.slice(2), 'blocks');
    const { chromium } = requireChromium('render-blocks.cjs');
    browser = await chromium.launch(launchOptions({ headless: true }));
    const page = await browser.newPage({ viewport: { width: 1300, height: 1700 } });
    await importResume(page, options);
    const result = await page.evaluate(() => {
      const paper = document.querySelector('[class*="210mm"]');
      const rect = paper.getBoundingClientRect(), scale = rect.width / paper.offsetWidth;
      if (!Number.isFinite(scale) || scale <= 0) throw new Error('纸张缩放无法确认');
      const blocks = [];
      const walk = (parent, depth) => {
        if (depth > 2) return;
        for (const child of parent.children) {
          const r = child.getBoundingClientRect();
          if (r.height < 1 || r.width < 1) continue;
          blocks.push({ depth, tag: child.tagName.toLowerCase(), y: +((r.top - rect.top) / scale).toFixed(1), height: +(r.height / scale).toFixed(1), text: child.innerText?.trim().slice(0, 60) || '' });
          if (r.height / scale > 90) walk(child, depth + 1);
        }
      };
      walk(paper, 0);
      return { scale, width: paper.offsetWidth, blocks };
    });
    console.log(JSON.stringify(result, null, 2));
    await page.screenshot({ path: `${options.shot}.png`, timeout: 60000, animations: 'disabled' });
    console.log('RESULT DIAGNOSTIC（诊断完成；不代表分页或 PDF 验收通过）');
  } catch (error) { console.error('ERR', error.message); process.exitCode = 2; }
  finally { if (browser) await browser.close(); }
})();
