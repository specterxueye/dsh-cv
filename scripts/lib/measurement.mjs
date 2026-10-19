// 本地近似量高：只把文本复制进测量页，绝不挂载输入中的 HTML 节点或属性。
export async function createMeasurementPage(browser, resume) {
  const defaults = { baseFontSize: 13, lineHeight: 1.42, headerSize: 32, subheaderSize: 16, paragraphSpacing: 3, sectionSpacing: 10, pagePadding: 34 };
  const settings = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = resume.globalSettings?.[key] ?? fallback;
    const max = key === 'pagePadding' ? 396 : key === 'lineHeight' ? 10 : 500;
    const min = ['baseFontSize', 'lineHeight', 'headerSize', 'subheaderSize'].includes(key) ? 0.1 : 0;
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`globalSettings.${key} 必须为 ${min}–${max} 之间的有限数字`);
    settings[key] = value;
  }
  const page = await browser.newPage({ javaScriptEnabled: false, serviceWorkers: 'block' });
  await page.route('**/*', route => route.abort());
  await page.setContent('<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><style>body{margin:0;font-family:"Alibaba PuHuiTi","Microsoft YaHei",sans-serif}p{white-space:pre-wrap}</style><div id="sheet"></div>', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ resume: data, settings: gs }) => {
    const sheet = document.getElementById('sheet');
    sheet.style.width = `${794 - gs.pagePadding * 2}px`;
    sheet.style.padding = `${gs.pagePadding}px ${gs.pagePadding}px 0`;
    const text = value => String(value ?? '');
    const paragraph = (parent, value, size = gs.baseFontSize, bold = false) => {
      const node = document.createElement('p');
      node.textContent = text(value);
      Object.assign(node.style, { margin: `0 0 ${gs.paragraphSpacing}px`, fontSize: `${size}px`, lineHeight: String(gs.lineHeight), fontWeight: bold ? 'bold' : 'normal' });
      parent.append(node);
      return node;
    };
    const section = title => {
      const gap = document.createElement('div');
      gap.style.height = `${gs.sectionSpacing}px`;
      sheet.append(gap);
      paragraph(sheet, title, gs.headerSize, true);
    };
    const richLines = (html, leading = false) => {
      const template = document.createElement('template');
      template.innerHTML = text(html);
      template.content.querySelectorAll('script,style,iframe,object,embed,svg,math,link,meta').forEach(node => node.remove());
      template.content.querySelectorAll('br').forEach(node => node.replaceWith(document.createTextNode('\n')));
      if (leading && template.content.firstElementChild?.tagName === 'P') paragraph(sheet, template.content.firstElementChild.textContent.trim());
      for (const item of template.content.querySelectorAll('li')) paragraph(sheet, item.textContent.trim());
    };
    const basic = data.basic || {};
    const header = document.createElement('div'), left = document.createElement('div'), right = document.createElement('div');
    header.style.display = 'flex'; left.style.width = '55%'; right.style.width = '45%';
    paragraph(left, basic.name, gs.headerSize, true);
    paragraph(left, basic.title);
    paragraph(right, (basic.customFields || []).map(field => `${text(field.label)}：${text(field.value)}`).join('\n'));
    header.append(left, right); sheet.append(header);
    section('教育经历');
    for (const item of data.education || []) {
      paragraph(sheet, [item.school, item.major, item.degree, item.gpa, item.startDate].map(text).join(' · '), gs.subheaderSize, true);
      richLines(item.description);
    }
    section('实习经历');
    for (const item of data.experience || []) {
      paragraph(sheet, [item.company, item.position, item.date].map(text).join(' · '), gs.subheaderSize, true);
      richLines(item.details);
    }
    section('项目经历');
    for (const item of data.projects || []) {
      paragraph(sheet, [item.name, item.role, item.date].map(text).join(' · '), gs.subheaderSize, true);
      richLines(item.description, true);
    }
    for (const menu of data.menuSections || []) {
      if (!/^custom-/.test(menu.id) || menu.enabled === false) continue;
      const items = data.customData?.[menu.id] || [];
      if (!items.length) continue;
      section(menu.title);
      for (const item of items) {
        paragraph(sheet, [item.title, item.subtitle, item.dateRange].filter(Boolean).join(' · '), gs.subheaderSize, true);
        richLines(item.description);
      }
    }
    if (data.skillContent) { section('技能优势'); richLines(data.skillContent); }
    if (data.selfEvaluationContent) { section('自我评价'); richLines(data.selfEvaluationContent); }
  }, { resume, settings });
  await page.evaluate(() => document.fonts.ready);
  return { page, settings };
}
