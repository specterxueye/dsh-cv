const { readFileSync } = require('node:fs');

const normalize = text => String(text).replace(/\s+/g, '');
const plain = text => String(text).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(?:39|x27);/gi, "'");

function renderArgs(argv, defaultShot) {
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--chrome') { if (!argv[++i]) throw new Error('--chrome 缺少路径'); }
    else if (argv[i].startsWith('--chrome=')) continue;
    else if (argv[i].startsWith('--')) throw new Error(`未知参数 ${argv[i]}`);
    else positional.push(argv[i]);
  }
  if (!positional.length || positional.length > 2) throw new Error('用法: <resume.json> [截图前缀] [--chrome <浏览器路径>]');
  const data = JSON.parse(readFileSync(positional[0], 'utf8').replace(/^\uFEFF/, ''));
  const anchors = [normalize(data.basic?.name || '')];
  const sections = Object.fromEntries(['education', 'experience', 'projects'].map(key => [key, data[key] || []]));
  Object.assign(sections, data.customData || {});
  for (const [section, rows] of Object.entries(sections)) {
    if (data.menuSections?.find(s => s.id === section)?.enabled === false) continue;
    if (!Array.isArray(rows)) throw new Error(`${section} 必须为数组，请先完成结构校验`);
    for (const row of rows) {
      if (row.visible === false) continue;
      for (const key of ['name', 'school', 'company', 'title', 'subtitle', 'description']) {
        if (typeof row[key] === 'string' && plain(row[key]).trim()) anchors.push(normalize(plain(row[key])));
      }
    }
  }
  for (const [section, key] of [['skills', 'skillContent'], ['selfEvaluation', 'selfEvaluationContent']]) {
    if (data.menuSections?.find(s => s.id === section)?.enabled === false) continue;
    if (data[key]?.trim()) anchors.push(normalize(plain(data[key])));
  }
  for (const field of data.basic?.fieldOrder || []) {
    if (field.visible === false) continue;
    const key = typeof field === 'string' ? field : field.key;
    if (typeof data.basic[key] === 'string' && data.basic[key].trim()) anchors.push(normalize(plain(data.basic[key])));
  }
  for (const field of data.basic?.customFields || []) {
    if (field.visible !== false && typeof field.value === 'string' && field.value.trim()) anchors.push(normalize(plain(field.value)));
  }
  if (!anchors[0] || anchors.length < 2) throw new Error('导入身份核对至少需要姓名与一处可见正文，请先完成结构校验');
  return { file: positional[0], shot: positional[1] || defaultShot, anchors: [...new Set(anchors)] };
}

async function importResume(page, { file, anchors }) {
  await page.goto('https://magicv.art/app/dashboard/resumes', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.getByText('导入简历', { exact: true }).first().click({ timeout: 15000 });
  const upload = page.locator('input[type="file"][accept*="json"]');
  await upload.waitFor({ state: 'attached', timeout: 15000 });
  await upload.setInputFiles(file, { timeout: 15000 });
  await page.locator('[class*="210mm"]').waitFor({ state: 'visible', timeout: 45000 });
  try {
    await page.waitForFunction(expected => {
      const papers = [...document.querySelectorAll('[class*="210mm"]')].filter(p => p.getBoundingClientRect().width > 0);
      return papers.length === 1 && expected.every(anchor => papers[0].innerText.replace(/\s+/g, '').includes(anchor));
    }, anchors, { timeout: 45000 });
  } catch (error) { throw new Error(`导入内容核对失败，不能确认是目标稿件：${error.message}`); }
  await page.waitForFunction(() => !document.fonts || document.fonts.status === 'loaded', null, { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[class*="210mm"] img')].every(img => img.complete && img.naturalWidth > 0), null, { timeout: 15000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

module.exports = { renderArgs, importResume };
