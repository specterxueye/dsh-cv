#!/usr/bin/env node
/**
 * render-height.mjs — 离屏真排版量高（一页预算）
 * 用法: node scripts/render-height.mjs <resume.json>
 * 原理：按魔法 classic 模板参数在 headless 页里逐段真排版量高，求和 = 画布内容总高。
 * 一页参照：A4 @96dpi = 1123px；与已验证一页的金标准成品同法对比（判定：新稿 ≤ 基准）。
 * 依赖：playwright-core（用 $env:PLAYWRIGHT_DIR 指向包含 node_modules 的目录，或 --engine 参数）
 * Chrome 路径：$env:CHROME_PATH 或默认从常见安装位置探测（可被 --chrome 覆盖）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node render-height.mjs <resume.json>'); process.exit(1); }
const json = JSON.parse(readFileSync(file, 'utf8'));
const gs = json.globalSettings || {};

// ---- 经典模板参数（与 magicv classic 实测一致）----
const baseFontSize = gs.baseFontSize ?? 13;
const lineHeight = gs.lineHeight ?? 1.42;
const headerSize = gs.headerSize ?? 32;
const subheaderSize = gs.subheaderSize ?? 16;
const paragraphSpacing = gs.paragraphSpacing ?? 3;
const sectionSpacing = gs.sectionSpacing ?? 10;
const pagePadding = gs.pagePadding ?? 34;

// 找一个能解析 playwright-core 的 require —— 先 cwd，再看 $env:PLAYWRIGHT_DIR
const tryRequire = async () => {
  const bases = [process.cwd(), process.env.PLAYWRIGHT_DIR].filter(Boolean);
  for (const base of bases) {
    try { return createRequire(resolve(base, 'package.json'))('playwright-core'); } catch (e) {}
  }
  return null;
};

const strip = (html) => String(html || '')
  .replace(/<strong[^>]*>/gi, '').replace(/<\/strong>/gi, '')
  .replace(/<[^>]+>/g, '').trim();

/** 组装测试 HTML（同 magicv 版式） */
function buildTestHtml() {
  const parts = [];
  let ph = 0; // 项目序号（无需）
  const pushSection = (title) => parts.push(`<div class="sec" style="height:${sectionSpacing}px"></div><p class="h" style="font-size:${headerSize}px;line-height:${lineHeight};margin:0 0 ${paragraphSpacing}px">${title}</p>`);
  const pushSub = (line) => parts.push(`<p class="h" style="font-size:${subheaderSize}px;line-height:${lineHeight};margin:0 0 ${paragraphSpacing}px">${line}</p>`);
  const pushP = (text) => parts.push(`<p style="margin:0 0 ${paragraphSpacing}px;font-size:${baseFontSize}px;line-height:${lineHeight}">${text}</p>`);

  // basic 两列（宽一半）：名称行 + 字段行
  const fields = (json.basic?.customFields || []);
  const nameLine = `${json.basic?.name || ''} · ${json.basic?.title || ''}`;
  parts.push(`<div style="display:flex"><div style="width:55%"><p class="h" style="font-size:${headerSize}px;line-height:${lineHeight};margin:0 0 2px">${json.basic?.name || ''}</p><p style="font-size:${baseFontSize}px;line-height:${lineHeight};margin:0">${json.basic?.title || ''}</p></div><div style="width:45%"><p style="font-size:${baseFontSize}px;line-height:${lineHeight};margin:0 0 ${paragraphSpacing}px">${fields.map(f => `${f.label}：${f.value}`).join('<br>')}</p></div></div>`);

  // education
  pushSection('教育经历');
  for (const e of json.education || []) {
    pushSub(`${e.school} · ${e.major} · ${e.degree} · ${e.gpa || ''} · ${e.startDate || ''}`);
    for (const li of (String(e.description || '').match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [])) pushP(strip(li));
  }
  // experience
  pushSection('实习经历');
  for (const e of json.experience || []) {
    pushSub(`${e.company} · ${e.position} · ${e.date || ''}`);
    for (const li of (String(e.details || '').match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [])) pushP(strip(li));
  }
  // projects
  pushSection('项目经历');
  for (const p of json.projects || []) {
    pushSub(`${p.name} · ${p.role} · ${p.date || ''}`);
    const html = String(p.description || '');
    const leadingP = html.match(/^<p[^>]*>([\s\S]*?)<\/p>/);
    if (leadingP) pushP(strip(leadingP[1]));
    for (const li of (html.match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [])) pushP(strip(li));
  }
  // custom blocks（校园/荣誉）
  const menus = json.menuSections || [];
  for (const m of menus) {
    if (!/^custom-/.test(m.id)) continue;
    const items = json.customData?.[m.id] || [];
    if (!items.length) continue;
    pushSection(m.title);
    for (const it of items) {
      pushSub([it.title, it.subtitle, it.dateRange].filter(Boolean).join(' · '));
      for (const li of (String(it.description || '').match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [])) pushP(strip(li));
    }
  }
  // skills
  if (json.skillContent) {
    pushSection('技能优势');
    for (const li of (String(json.skillContent).match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [])) pushP(strip(li));
  }
  // self eval
  if (json.selfEvaluationContent) {
    pushSection('自我评价');
    for (const li of (String(json.selfEvaluationContent).match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [])) pushP(strip(li));
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:"Alibaba PuHuiTi","Microsoft YaHei",sans-serif}.h{font-weight:bold}</style></head><body><div id="sheet" style="width:${794 - pagePadding * 2}px;padding:${pagePadding}px ${pagePadding}px 0">${parts.join('')}</div></body></html>`;
}

const pw = await tryRequire();
if (!pw) { console.error('playwright-core 不可用：请设置 $env:PLAYWRIGHT_DIR 到含 node_modules 的目录后重试'); process.exit(2); }
const { chromium } = pw;

const chromeCandidates = [
  process.env.CHROME_PATH,
  process.env['ProgramFiles'] ? `${process.env['ProgramFiles']}\\Google\\Chrome\\Application\\chrome.exe` : null,
  process.env['ProgramFiles(x86)'] ? `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe` : null,
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null,
].filter(Boolean).filter(p => existsSync(p));

const browser = await chromium.launch({ executablePath: chromeCandidates[0], headless: true });
const page = await browser.newPage();
await page.setContent(buildTestHtml(), { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(400);
const h = await page.evaluate(() => Math.round(document.getElementById('sheet').scrollHeight));
const onePage = 1123;
const ratio = (h / onePage).toFixed(2);
console.log(`内容高 ≈ ${h}px（A4 一页 1123px → ${ratio} 页）${h <= 1123 ? '✅ 一页内' : h <= 1180 ? '⚠️ 临界' : '❌ 超页'}`);
console.log(`参数: baseFontSize=${baseFontSize} lineHeight=${lineHeight} header=${headerSize} sub=${subheaderSize} spacing=${sectionSpacing} pad=${pagePadding}`);
await browser.close();
