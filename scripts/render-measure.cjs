// 渲染测量 v2 —— 测「页面内实际内容高度」，而不是被面板拉伸的容器高度
// 用法: node render-measure.cjs <resume.json> [shotPrefix]
const { chromium } = require('playwright-core');

const file = process.argv[2];
const shot = process.argv[3] || 'measure';
if (!file) { console.error('用法: node render-measure.cjs <resume.json> [prefix]'); process.exit(1); }
const A4_H = 1123; // 794 x 297/210

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1300, height: 1700 } });
  const domLen = () => page.evaluate(() => document.documentElement.outerHTML.length).catch(() => -1);

  let ok = false;
  for (let a = 1; a <= 5 && !ok; a++) {
    try {
      await page.goto('https://magicv.art/app/dashboard/resumes', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(6000);
      if (await domLen() > 5000) { ok = true; break; }
    } catch (e) {}
  }
  if (!ok) { console.log('FAILED dashboard'); await browser.close(); process.exit(1); }

  await page.getByText('导入简历', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(file).catch(() => {});
  await page.waitForTimeout(9000);

  let good = false;
  for (let r = 1; r <= 5 && !good; r++) {
    if (await domLen() > 8000) { good = true; break; }
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(7000);
  }
  if (!good) { console.log('FAILED workbench'); await browser.close(); process.exit(1); }
  await page.waitForTimeout(3000);
  try { await page.evaluate(() => document.fonts ? document.fonts.ready : Promise.resolve()); } catch (e) {}

  // ★ 关键改造：测内容高度，不测容器高度
  const m = await page.evaluate(() => {
    const el = document.querySelector('[class*="210mm"]');
    if (!el) return { err: 'no a4 element' };
    const r = el.getBoundingClientRect();
    const scale = r.height > 0 ? r.height / el.offsetHeight : 1;

    // 深度优先找「最后一个有尺寸的后代」，其 bottom 即内容底
    let lastBottom = r.top;
    const walk = (n) => {
      for (const c of n.children) {
        const cr = c.getBoundingClientRect();
        if (cr.height > 1 && cr.width > 1) {
          if (cr.bottom > lastBottom) lastBottom = cr.bottom;
          walk(c);
        }
      }
    };
    walk(el);

    // 也统计所有文本节点所在元素的 bottom（更保险）
    let textBottom = r.top;
    el.querySelectorAll('*').forEach((n) => {
      if (n.children.length === 0 && (n.textContent || '').trim().length > 0) {
        const nr = n.getBoundingClientRect();
        if (nr.bottom > textBottom) textBottom = nr.bottom;
      }
    });

    return {
      scale: +scale.toFixed(4),
      elOffsetH: el.offsetHeight,
      elRectH: +r.height.toFixed(1),
      contentH: +((Math.max(lastBottom, textBottom) - r.top) / scale).toFixed(1),
      paddingTop: getComputedStyle(el).paddingTop,
    };
  });

  console.log('量表:', JSON.stringify(m));
  if (m.err) { console.log('RESULT ERROR'); await browser.close(); process.exit(1); }
  const pages = (m.contentH / A4_H).toFixed(2);
  const verdict = m.contentH <= A4_H + 2 ? 'ONE_PAGE' : 'OVERFLOW';
  console.log(`内容高=${m.contentH}px（缩放 ${m.scale}）→ A4 一页=${A4_H}px → ${pages} 页 → ${verdict}` +
              (m.contentH > A4_H ? ` 超出 ${Math.round(m.contentH - A4_H)}px` : ` 余量 ${Math.round(A4_H - m.contentH)}px`));

  try { await page.screenshot({ path: `${shot}-${verdict}.png`, timeout: 60000, animations: 'disabled' }); console.log('SHOT:', `${shot}-${verdict}.png`); } catch (e) {}
  await browser.close();
  process.stdout.write(`RESULT ${verdict} ${m.contentH}\n`);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
