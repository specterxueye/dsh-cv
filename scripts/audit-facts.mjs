#!/usr/bin/env node
/**
 * audit-facts.mjs — 数字溯源审计（可执行的事实门槛）
 *
 * 作用：把一份简历 JSON 里出现的**每一个数字**，回到事实源（事实基线 + 事实溯源清单 + 附加语料）
 *       里逐条查找。查不到的必须“说明来源或删除”，不允许静默留在稿子里。
 *
 * 为什么：规则里写了“一切数字可溯源”，但过去只是提示词纪律；本脚本把它变成可执行判据。
 *         （教训来源：2026-09-12 “低估型口径错误”与 2026-08-23 的手写时分编造，都是数字先出问题。）
 *
 * 用法（仓库根执行，路径含空格必须加引号）：
 *   node "scripts\audit-facts.mjs" "<resume.json>" --profile "<users\<用户名>\<名字>-事实基线.json>" [--trace "<users\<用户名>\<名字>-事实溯源清单.json>"] [--corpus "<额外语料.md>"]...
 *
 * 判据：全部命中 → 退出码 0；存在未命中 → 退出码 1 并逐条列出（token / 所在字段 / 上下文片段）。
 *      未命中 ≠ 一定是编造：也可能是“语料没纳入”（如项目 README、课程报告）。此时二选一：
 *      ① 把该来源加进 --corpus（推荐，等于补溯源）② 从稿子里删掉这个数字。二者都不做就别交付。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const flagAll = (name) => {
  const out = [];
  argv.forEach((a, i) => {
    if (a === name && argv[i + 1]) out.push(argv[i + 1]);
  });
  return out;
};

const resumePath = positional[0];
if (!resumePath) {
  console.error('用法: node scripts\\audit-facts.mjs <resume.json> --profile <事实基线.json> [--trace <溯源清单.json>] [--corpus <extra.md>]...');
  process.exit(2);
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readText = (p) => readFileSync(p, 'utf8');

// ---------- 1. 汇总事实语料 ----------
//
// ★ 作废口径排除（2026-09-21 加）：
//   本脚本的判据是「该数字在语料里出现过就算命中」（去空白后的子串匹配），
//   于是一个**已作废**的数字只要还留在语料里，就永远能通过溯源——包括
//   “原 127 条实为 105 条”这类**更正句本身**也会让 127 条合法。这叫语料污染。
//   处理：任何含【作废】/ [RETRACTED] 标记的**行**不进语料。
//   纪律：口径作废时，把记录该口径的那一行加上【作废】前缀；更正说明若需保留数字，
//         也必须在同一行带【作废】标记。
const RETRACTED_RE = /【作废】|\[RETRACTED\]/;
const stripRetracted = (text) => {
  const lines = String(text).split(/\r?\n/);
  const kept = [];
  let dropped = 0;
  for (const line of lines) {
    if (RETRACTED_RE.test(line)) dropped += 1;
    else kept.push(line);
  }
  return { text: kept.join('\n'), dropped };
};

const corpusParts = [];
const corpusNames = [];
let retractedLines = 0;
const addCorpus = (path, label) => {
  if (!path) return;
  if (!existsSync(path)) {
    console.warn(`[warn] 语料不存在，已跳过：${path}`);
    return;
  }
  const { text, dropped } = stripRetracted(readText(path));
  retractedLines += dropped;
  corpusParts.push(text);
  corpusNames.push(`${label}: ${path}${dropped ? `（已排除 ${dropped} 行作废口径）` : ''}`);
};

const profilePath = flag('--profile');
addCorpus(profilePath, '事实基线');
addCorpus(flag('--trace'), '溯源清单');

// --user <users\用户名 目录>：自动纳入该用户的全部事实语料（推荐用法）
const userDir = flag('--user');
if (userDir) {
  if (!existsSync(userDir)) {
    console.warn(`[warn] --user 目录不存在：${userDir}`);
  } else {
    const entries = readdirSync(userDir);
    for (const name of entries) {
      const full = join(userDir, name);
      if (/-事实基线\.json$/.test(name)) addCorpus(full, '事实基线');
      else if (/-事实溯源清单\.json$/.test(name)) addCorpus(full, '溯源清单');
      else if (/-画像\.md$/.test(name)) addCorpus(full, '画像（含用户确认增补）');
      else if (/^优化清单-个案\.md$/.test(name)) addCorpus(full, '个案规则（数字锚点）');
      else if (/^项目素材库\.md$/.test(name)) addCorpus(full, '项目素材库');
    }
  }
}

for (const extra of flagAll('--corpus')) addCorpus(extra, '附加语料');

if (corpusParts.length === 0) {
  console.error('至少需要一个事实语料（--profile / --trace / --corpus）');
  process.exit(2);
}

// 归一化：去掉所有空白与常见分隔噪声，并把数字间的 . / - 统一成 -，
// 避免“2025.05” vs “2025-05”、“2026.06” vs “2026.06.26”这类写法差异误判
const normalize = (s) =>
  String(s)
    .replace(/\\u[0-9a-fA-F]{4}/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, '')
    .replace(/(\d)[./-](?=\d)/g, '$1-');
const corpus = normalize(corpusParts.join('\n'));

// ---------- 2. 抽取简历里的数字 ----------
const SKIP_KEYS = new Set(['photo', 'photoFile', 'avatar', 'id', 'createdAt', 'updatedAt', 'templateId', 'draggingProjectId', 'githubKey', 'fieldOrder', 'icons', 'photoConfig', 'menuSections', 'certificates', 'globalSettings']);
const isNoiseValue = (v) =>
  /^data:/.test(v) || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(v) || v.length > 4000 || /^[A-Za-z0-9+/=]{200,}$/.test(v);

const stripHtml = (s) =>
  String(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

const NUMBER_RE = /(?<![\w.])[\d][\d,]*(?:\.\d+)?(?:\s*[+%])?(?![\w])/g;
const findings = [];

const scanValue = (raw, path) => {
  const text = stripHtml(raw);
  if (!text) return;
  const matches = text.match(NUMBER_RE);
  if (!matches) return;
  for (const token of matches) {
    const t = token.replace(/\s+/g, '');
    const idx = text.indexOf(token);
    findings.push({
      token: t,
      path,
      context: text.slice(Math.max(0, idx - 40), idx + token.length + 40),
    });
  }
};

const walk = (node, path) => {
  if (node == null) return;
  if (typeof node === 'string') {
    if (isNoiseValue(node)) return;
    scanValue(node, path);
    return;
  }
  if (typeof node === 'number') {
    findings.push({ token: String(node), path, context: '(number 字段)' });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, `${path}[${i}]`));
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (SKIP_KEYS.has(k)) continue;
      walk(v, path ? `${path}.${k}` : k);
    }
  }
};

const resume = readJson(resumePath);
walk(resume, '');

// ---------- 3. 判定 ----------
const seen = new Map();
const hits = [];
const misses = [];
for (const f of findings) {
  const key = f.token;
  const hit = corpus.includes(normalize(key));
  const bucket = hit ? hits : misses;
  bucket.push(f);
  if (!seen.has(key)) seen.set(key, hit);
}

const uniqMiss = [];
const missSeen = new Set();
for (const m of misses) {
  if (missSeen.has(m.token)) continue;
  missSeen.add(m.token);
  uniqMiss.push(m);
}

console.log('== audit-facts（数字溯源审计）==');
console.log(`   简历   : ${resumePath}`);
corpusNames.forEach((n) => console.log(`   语料   : ${n}`));
if (retractedLines) {
  console.log(`   ⛔ 作废口径: 已排除 ${retractedLines} 行（带【作废】标记，不作为溯源依据）`);
}
console.log(`   数字出现: ${findings.length} 次 / 去重 ${seen.size} 个`);
console.log(`   ✅ 命中 : ${hits.length} 次 / 去重 ${[...seen.values()].filter(Boolean).length} 个`);
console.log(`   ⚠️ 未命中: ${uniqMiss.length} 个（去重后）`);

if (uniqMiss.length) {
  console.log('\n以下数字在事实语料里查不到——必须逐条处理：补来源（--corpus）或从稿子里删掉：');
  uniqMiss.forEach((m, i) => {
    console.log(`  ${String(i + 1).padStart(2, '0')}. 「${m.token}」 @ ${m.path || '(root)'}`);
    console.log(`      上下文: …${m.context}…`);
  });
  console.log('\n结论：❌ 存在未溯源数字，不得交付。');
  process.exit(1);
}

console.log('\n结论：✅ 全部数字均可在事实语料中找到出处。');
