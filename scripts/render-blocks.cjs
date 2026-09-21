// 版面逐块称重：找出 A4 里每块占多少高度，定位版面被谁吃掉
const { chromium } = require('playwright-core');
const file = process.argv[2];
const shot = process.argv[3] || 'blocks';
if (!file) { console.error('用法: node render-blocks.cjs <resume.json> [prefix]'); process.exit(1); }

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1300, height: 1700 } });
  const domLen = () => page.evaluate(() => document.documentElement.outerHTML.length).catch(() => -1);
  let ok = false;
  for (let a = 1; a <= 5 && !ok; a++) {
    try { await page.goto('https://magicv.art/app/dashboard/resumes', { waitUntil: 'domcontentloaded', timeout: 45000 }); await page.waitForTimeout(6000); if (await domLen() > 5000) ok = true; } catch (e) {}
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

  const r = await page.evaluate(() => {
    const a4 = document.querySelector('[class*="210mm"]');
    if (!a4) return { err: 'no a4' };
    const a4rect = a4.getBoundingClientRect();
    const scale = a4rect.height / a4.offsetHeight || 1;
    const toA4 = (y) => +((y - a4rect.top) / scale).toFixed(1);
    const H = (n) => +(((n.getBoundingClientRect().height) / scale)).toFixed(1);

    // 1) A4 的直接子块（版面骨架）
    const blocks = [];
    const walk = (n, depth) => {
      if (depth > 2) return;
      [...n.children].forEach((c) => {
        const h = H(c);
        if (h < 8) return;
        const t = (c.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 46);
        blocks.push({
          d: depth,
          tag: c.tagName.toLowerCase(),
          cls: (c.className || '').toString().slice(0, 34),
          y: toA4(c.getBoundingClientRect().top),
          h,
          t,
        });
        if (h > 90) walk(c, depth + 1);
      });
    };
    walk(a4, 0);

    // 2) 章节标题定位（用文字匹配）
    const titles = ['教育经历', '实习经历', '项目经历', '校园经历', '技能优势', '自我评价', '基本信息'];
    const found = {};
    a4.querySelectorAll('*').forEach((n) => {
      if (n.children.length > 0) return;
      const t = (n.textContent || '').trim();
      if (titles.includes(t) && found[t] === undefined) found[t] = toA4(n.getBoundingClientRect().top);
    });

    // 3) 重复渲染检测：同一段文字在 A4 里出现几次
    const body = (a4.innerText || '');
    const dup = {};
    ['团委宣传部', '数据智能创新应用实验室', 'dsh-cv', 'League Events Log', 'YOLOv5', '卓新科技'].forEach((k) => {
      dup[k] = body.split(k).length - 1;
    });

    return { scale: +scale.toFixed(4), a4OffsetH: a4.offsetHeight, a4OffsetW: a4.offsetWidth, total: H(a4), blocks, titles: found, dup };
  });

  if (r.err) { console.log('RESULT ERROR', r.err); await browser.close(); process.exit(1); }
  console.log(`A4 元素: 自然宽 ${r.a4OffsetW} × 高 ${r.a4OffsetH} ｜ scale ${r.scale} ｜ A4 内总高 ${r.total}px`);
  console.log(`分页线约 1079px（= 1123 - 2×padding）\n`);
  console.log('=== 章节标题 y 坐标 ===');
  Object.entries(r.titles).forEach(([k, v]) => console.log(`  ${k}  y=${v}`));
  console.log('\n=== 逐块高度 ===');
  r.blocks.forEach((b) => {
    console.log(`  ${'  '.repeat(b.d)}y=${String(b.y).padStart(7)}  h=${String(b.h).padStart(7)}  ${b.tag}.${b.cls}  「${b.t}」`);
  });
  console.log('\n=== 重复渲染检测（该词出现次数）===');
  Object.entries(r.dup).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  try { await page.screenshot({ path: `${shot}.png`, timeout: 60000, animations: 'disabled' }); } catch (e) {}
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
