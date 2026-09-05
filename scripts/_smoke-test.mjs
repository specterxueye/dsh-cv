#!/usr/bin/env node
/**
 * _smoke-test.mjs — 端到端冒烟测试（金标准成品 → 反推输入 → 生成 → 校验）
 * 用法: node scripts/_smoke-test.mjs <金标准简历.json>
 * 步骤:
 *   1. 读金标准简历（必须传参；可再传第二个参数指定用户目录，默认 scripts/.smoke）
 *   2. 反转成 profile.json（v2 契约）+ strategy.json
 *   3. 跑 build-resume.mjs 生成
 *   4. 跑 validate-resume.mjs 校验
 * 不修改任何源文件；产物写 scripts/.smoke/ 下。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const GOLD = process.argv[2];
if (!GOLD) { console.error('用法: node scripts/_smoke-test.mjs <金标准简历.json>'); process.exit(2); }
if (!existsSync(GOLD)) { console.error(`金标准文件不存在: ${GOLD}`); process.exit(2); }
const OUTDIR = join(ROOT, 'scripts', '.smoke');

// ---- HTML → 纯文本要点（反推时用，** 标记加粗）----
function htmlToBullets(html) {
  if (!html) return [];
  const s = String(html);
  const items = [...s.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => m[1]);
  return items.map(item => {
    let t = item
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '')
      .replace(/<strong[^>]*>/gi, '**')
      .replace(/<\/strong>/gi, '**')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return t;
  }).filter(Boolean);
}

const gold = JSON.parse(readFileSync(GOLD, 'utf8'));

// ---- profile（v2 契约）----
const profile = {
  basic: {
    name: gold.basic.name,
    title: gold.basic.title,
    employementStatus: gold.basic.employementStatus,
    email: gold.basic.email,
    phone: gold.basic.phone,
    location: gold.basic.location,
    birthDate: gold.basic.birthDate,
    nativePlace: (gold.basic.customFields || []).find(f => f.label === '籍贯')?.value || '',
    politics: (gold.basic.customFields || []).find(f => f.label === '政治面貌')?.value || '',
    layout: gold.basic.layout,
    photo: gold.basic.photo,
  },
  education: (gold.education || []).map(e => ({
    school: e.school, major: e.major, degree: e.degree,
    startDate: e.startDate, endDate: e.endDate, gpa: e.gpa,
    bullets: htmlToBullets(e.description),
  })),
  experience: (gold.experience || []).map(e => ({
    company: e.company, position: e.position, date: e.date,
    bullets: htmlToBullets(e.details),
  })),
  projects: (gold.projects || []).map(pr => {
    // 前导 <p> 拆为 headline
    const m = String(pr.description || '').match(/^<p[^>]*>([\s\S]*?)<\/p>/);
    return {
      name: pr.name, role: pr.role, date: pr.date,
      headline: m ? m[1].replace(/<[^>]+>/g, '').trim() : '',
      bullets: htmlToBullets(String(pr.description || '').replace(/^<p[^>]*>[\s\S]*?<\/p>\s*/, '')),
    };
  }),
  campus: (gold.campus || []).map(c => ({
    name: c.name, position: c.position, date: c.date,
    bullets: htmlToBullets(c.details),
  })),
  awards: (() => {
    const cd = gold.customData || {};
    for (const key of Object.keys(cd)) {
      const items = cd[key] || [];
      for (const it of items) {
        if (!it.title && it.description) return htmlToBullets(it.description);
      }
    }
    return [];
  })(),
  skills: htmlToBullets(gold.skillContent),
  selfEvaluation: htmlToBullets(gold.selfEvaluationContent),
};

// ---- strategy ----
const strategy = {
  jobTitle: 'AI 应用开发',
  keywords: ['AI', 'YOLOv5', 'Vue 3', 'ECharts', 'SQL Server', 'mAP@0.5'],
  customBlocks: [
    { key: 'campus', title: '校园经历', icon: '🎬' },
  ],
  settings: { themeColor: '#10b981' },
  note: 'smoke test',
};

mkdirSync(OUTDIR, { recursive: true });
const pp = join(OUTDIR, 'profile.json');
const sp = join(OUTDIR, 'strategy.json');
const op = join(OUTDIR, 'out.json');
writeFileSync(pp, JSON.stringify(profile, null, 2), 'utf8');
writeFileSync(sp, JSON.stringify(strategy, null, 2), 'utf8');

console.log('--- 1. 生成 ---');
execFileSync(process.execPath, [join(ROOT, 'scripts', 'build-resume.mjs'), '--profile', pp, '--strategy', sp, '--out', op], { stdio: 'inherit' });

console.log('\n--- 2. 校验 ---');
let code = 0;
try {
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'validate-resume.mjs'), op], { stdio: 'inherit' });
} catch (e) { code = e.status || 1; }

console.log(`\n冒烟测试 ${code === 0 ? '✅ 通过' : '❌ 未通过（见上）'}`);
process.exit(code);
