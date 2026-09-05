const { chromium } = require('playwright-core');
const path = require('path');

/**
 * e2e-render.cjs — magicv.art 真实渲染验证（一页装下验收）
 * 用法: node e2e-render.cjs <resume.json> [shotPrefix]
 * 流程: dashboard → 导入简历 → workbench 渲染（重试环）→ 测量 A4 画布高度 → 截图 → 判定
 * 一页标准: A4 = 794 × 1123 px（@96dpi）；实测 1099-1103px 历史验收通过
 */

const file = process.argv[2];
const shotPrefix = process.argv[3] || 'verify';
if (!file) { console.error('用法: node e2e-render.cjs <resume.json> [shotPrefix]'); process.exit(1); }

const A4_WIDTH = 794, A4_HEIGHT = 1123;

(async () => {
  // 注意：持久 profile 目录已损坏（dashboard domLen<5000），改用普通 context（导入→渲染同进程内完成，无需持久存储）
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1300, height: 1700 } });
  const domLen = () => page.evaluate(() => document.documentElement.outerHTML.length).catch(() => -1);

  // 1) dashboard（重试）
  let ok = false;
  for (let a = 1; a <= 5 && !ok; a++) {
    try {
      await page.goto('https://magicv.art/app/dashboard/resumes', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(6000);
      if (await domLen() > 5000) { ok = true; break; }
    } catch (e) {}
  }
  if (!ok) { console.log('FAILED dashboard'); await browser.close(); process.exit(1); }

  // 2) 导入
  await page.getByText('导入简历', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(file).catch(e => console.log('setfile', String(e).slice(0, 80)));
  await page.waitForTimeout(9000);
  console.log('URL:', page.url());

  // 3) workbench 渲染（重试环：domLen>8000 为成功信号）
  let good = false;
  for (let r = 1; r <= 5 && !good; r++) {
    const len = await domLen();
    console.log('render round', r, 'domLen=', len);
    if (len > 8000) { good = true; break; }
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(7000);
  }
  if (!good) { console.log('FAILED workbench'); await browser.close(); process.exit(1); }

  await page.waitForTimeout(3000);
  try { await page.evaluate(() => document.fonts ? document.fonts.ready : Promise.resolve()); } catch (e) {}

  // 4) 测量：找 A4 画布候选（宽≈794 或含 '页/paper/page/resume' 特征的容器）
  const metrics = await page.evaluate(([AW, AH]) => {
    const out = { candidates: [], bodyText: '', bodyH: 0 };
    out.bodyH = document.body ? Math.round(document.body.scrollHeight) : 0;
    out.bodyText = (document.body.innerText || '').slice(0, 400).replace(/\n+/g, ' | ');
    const els = Array.from(document.querySelectorAll('div,section,article,main,canvas,svg'));
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width > 600 && r.width < 900 && r.height > 500) {
        const cls = (el.className || '').toString().slice(0, 60);
        const id = el.id || '';
        out.candidates.push({
          w: Math.round(r.width), h: Math.round(r.height),
          cls: cls, id,
          text: (el.innerText || '').length,
        });
      }
    }
    out.candidates.sort((a, b) => Math.abs(b.w - AW) - Math.abs(a.w - AW) || b.h - a.h);
    return out;
  }, [A4_WIDTH, A4_HEIGHT]);

  console.log('bodyH=', metrics.bodyH, 'px');
  console.log('bodyText=', metrics.bodyText.slice(0, 200));
  console.log('candidates=' + metrics.candidates.length);
  for (const c of metrics.candidates.slice(0, 8)) {
    console.log(`  cand w=${c.w} h=${c.h} cls="${c.cls}" id="${c.id}" textLen=${c.text}`);
  }

  // 判定（A4 比例标准）：画布本体 = className 含 210mm 的 A4 元素，用 offset 尺寸（不受 transform 影响），一页高 = 宽 × 297/210
  const a4El = await page.$('[class*="210mm"]').catch(() => null);
  let canvasH = metrics.bodyH, canvasW = A4_WIDTH, a4H = A4_HEIGHT;
  if (a4El) {
    const r = await a4El.evaluate(el => ({ w: el.offsetWidth, h: el.offsetHeight, scroll: el.scrollHeight }));
    canvasW = r.w; canvasH = Math.max(r.h, r.scroll);
    a4H = r.w * 297 / 210;
    console.log(`(A4 el offsetW=${Math.round(r.w)} offsetH=${Math.round(r.h)} scrollH=${Math.round(r.scroll)})`);
  } else {
    const mm = metrics.candidates.find(c => c.cls.includes('210mm'));
    if (mm) { canvasW = mm.w; canvasH = mm.h; a4H = canvasW * 297 / 210; }
  }
  const pages = (canvasH / a4H).toFixed(2);
  const verdict = canvasH <= a4H + 2 ? 'ONE_PAGE' : 'OVERFLOW';
  console.log(`\n画布高=${Math.round(canvasH)}px 宽=${Math.round(canvasW)}px → A4 一页=${Math.round(a4H)}px → ${pages} 页（${verdict}${canvasH > a4H ? ` 超出 ${Math.round(canvasH - a4H)}px` : ''}）`);

  // 5) 截图（viewport 截图，防 fullPage 卡死——历史教训）
  try { await page.screenshot({ path: `${shotPrefix}-${verdict}.png`, timeout: 60000, animations: 'disabled' }); console.log('SHOT:', `${shotPrefix}-${verdict}.png`); }
  catch (e) { console.log('shot fail', String(e).slice(0, 80)); }

  await browser.close();
  process.stdout.write(`RESULT ${verdict} ${canvasH}\n`);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
