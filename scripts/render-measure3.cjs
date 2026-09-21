// 渲染测量 v3 —— 找 magicv 自己的「第N页结束」分页标记，与最后一行文字的位置比较
const { requireChromium, launchOptions } = require('./lib/browser.cjs');
const { chromium } = requireChromium('render-measure3.cjs');
const file = process.argv[2];
const shot = process.argv[3] || 'measure3';
if (!file) { console.error('用法: node render-measure3.cjs <resume.json> [prefix] [--chrome <浏览器路径>]'); process.exit(1); }

(async () => {
  const browser = await chromium.launch(launchOptions({ headless: true }));
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

    // 1) 找所有「第N页结束 / 第N页」标记
    const marks = [];
    document.querySelectorAll('*').forEach((n) => {
      if (n.children.length > 0) return;
      const t = (n.textContent || '').trim();
      if (/第\s*\d+\s*页/.test(t) && t.length < 24) {
        const nr = n.getBoundingClientRect();
        // 标记文字是「贴着」分页线画的：上边缘比真实分页线高出一个字高，用 bottom 才准
        marks.push({ text: t, y: toA4(nr.top), bottom: toA4(nr.bottom), h: +nr.height.toFixed(1) });
      }
    });

    // 2) 简历正文里最后一个有文字的元素（排除面板 UI）
    //    ★ 必须排除分页标记本身：它横在正文下方，会被误当成「最后一行文字」，
    //      从而产生与内容无关的「恒定假溢出」（极简对照稿就栽在这里）
    let lastTxt = null;
    a4.querySelectorAll('*').forEach((n) => {
      if (n.children.length > 0) return;
      const t = (n.textContent || '').trim();
      if (t.length === 0) return;
      if (/第\s*\d+\s*页/.test(t) && t.length < 24) return; // ← 分页标记，不是正文
      const nr = n.getBoundingClientRect();
      if (nr.height < 1) return;
      const y = toA4(nr.bottom);
      if (!lastTxt || y > lastTxt.y) lastTxt = { text: t.slice(0, 40), y };
    });

    // 3) 页面底部候选（白色纸张底）
    return {
      scale: +scale.toFixed(4),
      a4Top: +a4rect.top.toFixed(1),
      a4OffsetH: a4.offsetHeight,
      marks,
      lastText: lastTxt,
      bodyH: Math.round(document.body.scrollHeight),
    };
  });

  console.log('量:', JSON.stringify(r, null, 1));
  if (r.err) { console.log('RESULT ERROR'); await browser.close(); process.exit(1); }
  if (r.lastText && r.marks.length) {
    const firstMark = r.marks.reduce((a, b) => (a.y < b.y ? a : b));
    const fits = r.lastText.y <= firstMark.y + 2;
    console.log(`\n最后一行文字底 y=${r.lastText.y}px ｜ 第一处分页标记「${firstMark.text}」y=${firstMark.y}px`);
    console.log(`→ ${fits ? '✅ 全部内容在第 1 页内' : `❌ 溢出标记线 ${Math.round(r.lastText.y - firstMark.y)}px`}`);
    process.stdout.write(`RESULT ${fits ? 'ONE_PAGE' : 'OVERFLOW'} lastText=${r.lastText.y} mark=${firstMark.y}\n`);
  } else {
    console.log('未找到标记或文本，无法判定');
    process.stdout.write('RESULT UNKNOWN\n');
  }
  try { await page.screenshot({ path: `${shot}.png`, timeout: 60000, animations: 'disabled' }); } catch (e) {}
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
