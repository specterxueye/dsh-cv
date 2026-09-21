#!/usr/bin/env node
/**
 * scripts/check.mjs — 仓库自检（零依赖，CI 与本地同一入口）
 *
 * 用法：node scripts/check.mjs
 * 覆盖：
 *   1) 脚本语法（scripts/** 全部 .mjs/.cjs 过 node --check）
 *   2) JSON 可解析（package.json / preset/manifest.json / profile/*.json）
 *   3) 技能完整性（每个 preset/skills/<目录>/SKILL.md 存在，frontmatter 的 name 与目录名一致，description 非空）
 *   4) 零硬编码路径（脚本内不得出现本机绝对路径：Program Files 字面量 / /Users/<用户>/ / /home/<用户>/）
 *   5) 文档相对链接可解析（README / docs / CHANGELOG / THIRD-PARTY）
 *   6) preset/manifest.json 的 files 清单与实际文件一致，且四个技能都在清单里
 *
 * 退出码：0 = 全绿；1 = 有失败项（可直接串进 CI）
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...segs) => join(root, ...segs);

let passed = 0;
let failed = 0;
const ok = (msg) => { console.log(`  \u2705 ${msg}`); passed += 1; };
const bad = (msg) => { console.log(`  \u274c ${msg}`); failed += 1; };
const section = (t) => console.log(`\n== ${t} ==`);

/** 手写递归（不用 readdirSync recursive，保持 Node 16 兼容） */
function walk(dir, filter, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

// ── 1. 脚本语法 ────────────────────────────────────────────────
section('脚本语法（node --check）');
const scripts = walk(p('scripts'), (f) => /\.(mjs|cjs|js)$/.test(f));
for (const f of scripts) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  const rel = relative(root, f);
  if (r.status === 0) ok(rel);
  else bad(`${rel} — ${(r.stderr || '').split('\n').slice(0, 3).join(' ')}`);
}

// ── 2. JSON 可解析 ────────────────────────────────────────────
section('JSON 可解析');
const jsonFiles = [
  p('package.json'),
  p('preset', 'manifest.json'),
  ...walk(p('profile'), (f) => f.endsWith('.json')),
];
for (const f of jsonFiles) {
  const rel = relative(root, f);
  try {
    JSON.parse(readFileSync(f, 'utf8'));
    ok(rel);
  } catch (e) {
    bad(`${rel} — ${e.message}`);
  }
}

// ── 3. 技能完整性 ─────────────────────────────────────────────
section('技能完整性');
const skillsRoot = p('preset', 'skills');
const skillDirs = existsSync(skillsRoot)
  ? readdirSync(skillsRoot).filter((n) => statSync(join(skillsRoot, n)).isDirectory())
  : [];
if (skillDirs.length === 0) bad('preset/skills 下没有技能目录');
const skillNames = [];
for (const dir of skillDirs) {
  const skillFile = join(skillsRoot, dir, 'SKILL.md');
  if (!existsSync(skillFile)) { bad(`${dir}/SKILL.md 缺失`); continue; }
  const text = readFileSync(skillFile, 'utf8');
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) { bad(`${dir}/SKILL.md 缺少 frontmatter`); continue; }
  const name = (fm[1].match(/^name:\s*(.+)$/m) || [])[1];
  const desc = (fm[1].match(/^description:\s*(.+)$/m) || [])[1];
  if (!name) { bad(`${dir}/SKILL.md frontmatter 缺 name`); continue; }
  if (name.trim() !== dir) { bad(`${dir}/SKILL.md 的 name="${name.trim()}" 与目录名不一致`); continue; }
  if (!desc || desc.trim().length < 10) { bad(`${dir}/SKILL.md description 过短或缺失`); continue; }
  skillNames.push(dir);
  ok(`skills/${dir}（name=${name.trim()}，description ${desc.trim().length} 字）`);
}

// ── 4. 零硬编码路径 ───────────────────────────────────────────
section('脚本内不得出现硬编码本机路径');
const codeFiles = walk(p('scripts'), (f) => /\.(mjs|cjs|js|ps1)$/.test(f));
const personalPath = /\/Users\/[A-Za-z0-9._-]+\/|\/home\/[A-Za-z0-9._-]+\//;
// 拼出来，避免本文件自身的规则行被自己命中
const PF_NEEDLE = ['Program', 'Files'].join(' ');
let pathViolations = 0;
for (const f of codeFiles) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const rel = `${relative(root, f)}:${i + 1}`;
    const isComment = line.trim().startsWith('*') || line.trim().startsWith('//') || line.trim().startsWith('#');
    if (line.includes(PF_NEEDLE) && !line.includes('process.env') && !isComment) {
      bad(`${rel} 出现 ${PF_NEEDLE} 字面量（应由 process.env 拼装或交给 lib/browser.cjs）`);
      pathViolations += 1;
    }
    if (personalPath.test(line) && !isComment) {
      bad(`${rel} 出现个人绝对路径：${line.trim().slice(0, 80)}`);
      pathViolations += 1;
    }
  });
}
if (pathViolations === 0) ok(`${codeFiles.length} 个脚本/脚本文件均无硬编码本机路径`);

// ── 5. 文档相对链接 ───────────────────────────────────────────
section('文档相对链接可解析');
const docFiles = [
  p('README.md'), p('CHANGELOG.md'), p('THIRD-PARTY-NOTICES.md'),
  ...walk(p('docs'), (f) => f.endsWith('.md')),
  ...walk(p('preset'), (f) => f.endsWith('.md')),
];
let linkTotal = 0;
let linkBad = 0;
for (const f of docFiles) {
  const text = readFileSync(f, 'utf8');
  const re = /\]\(([^)#\s]+)\)/g;
  let m;
  while ((m = re.exec(text))) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    linkTotal += 1;
    const abs = resolve(dirname(f), decodeURIComponent(target));
    if (!existsSync(abs)) { bad(`${relative(root, f)} → ${target}`); linkBad += 1; }
  }
}
if (linkBad === 0) ok(`${linkTotal} 条相对链接全部命中`);

// ── 6. manifest 一致性 ────────────────────────────────────────
section('preset/manifest.json 与实际文件一致');
const manifest = JSON.parse(readFileSync(p('preset', 'manifest.json'), 'utf8'));
let manBad = 0;
for (const rel of manifest.files || []) {
  if (!existsSync(p('preset', rel))) { bad(`manifest.files 列出的文件不存在：preset/${rel}`); manBad += 1; }
}
for (const dir of skillNames) {
  if (!(manifest.files || []).includes(`skills/${dir}/SKILL.md`)) { bad(`manifest.files 缺少 skills/${dir}/SKILL.md`); manBad += 1; }
}
if (manBad === 0) ok(`manifest.files ${(manifest.files || []).length} 项全部存在，${skillNames.length} 个技能均已登记（version ${manifest.version}）`);

// ── 汇总 ──────────────────────────────────────────────────────
console.log(`\n== 自检结果：${passed} 通过 / ${failed} 失败 ==`);
process.exit(failed === 0 ? 0 : 1);
