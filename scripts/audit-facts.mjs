#!/usr/bin/env node
/**
 * audit-facts.mjs — 数字来源命中检查（不证明语义真实性）
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
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, extname, dirname, relative, isAbsolute, sep, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertUserDocument, factMetadataKeys, hasSource } from './lib/facts.mjs';

const argv = process.argv.slice(2);
const usage = '用法: node scripts/audit-facts.mjs <resume.json|pitch.md|text.txt> --profile <事实基线.json> [--trace <溯源清单.json>] [--corpus <extra.md>]... [--user <用户目录>] [--format json|text|auto]';
const options = new Map(), positional = [];
const fail = (message) => { console.error(`ERROR: ${message}`); process.exit(2); };
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--help') { console.log(usage); process.exit(0); }
  if (!arg.startsWith('--')) { positional.push(arg); continue; }
  if (!['--profile', '--trace', '--corpus', '--user', '--format'].includes(arg)) fail(`未知参数 ${arg}`);
  if (!argv[i + 1] || argv[i + 1].startsWith('--')) fail(`${arg} 缺少值`);
  if (arg !== '--corpus' && options.has(arg)) fail(`${arg} 不能重复`);
  options.set(arg, [...(options.get(arg) || []), argv[++i]]);
}
const flag = (name) => options.get(name)?.[0];
const resumePath = positional[0];
if (positional.length !== 1) fail(usage);
const format = flag('--format') || 'auto';
if (!['auto', 'json', 'text'].includes(format)) fail('--format 仅支持 json、text、auto');
const readDocument = (path, mode = 'auto') => {
  try {
    const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
    return (mode === 'text' || (mode === 'auto' && /\.(md|txt)$/i.test(extname(path)))) ? text : JSON.parse(text);
  } catch (error) { fail(`无法读取或解析 ${path}: ${error.message}`); }
};

// ---------- 1. 汇总事实语料 ----------
//
// ★ 作废口径排除（2026-09-21 加）：
//   即使使用完整 token，已作废数字仍可能污染来源集合，
//   一个**已作废**的数字只要还留在语料里，就可能通过命中检查——包括
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
  try {
    const actual = realpathSync(path), root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    for (const resource of ['data', 'profile', 'preset']) {
      const child = relative(join(root, resource), actual);
      if (!child || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child))) fail('公共写作参考与模板不能作为本人事实来源');
    }
    const document = readDocument(path);
    assertUserDocument(document);
    if (typeof document === 'string' && /^(?:---[\s\S]*?\bkind:\s*(?:template|example)\b[\s\S]*?---|<!--\s*dsh-cv:reference\s*-->)/i.test(document)) fail('模板/示例不能作为事实语料');
    corpusParts.push(document);
  } catch (error) { fail(`无法采用语料 ${path}: ${error.message}`); }
  corpusNames.push(`${label}: ${path}`);
};

const profilePath = flag('--profile');
addCorpus(profilePath, '事实基线');
addCorpus(flag('--trace'), '溯源清单');

// --user <users\用户名 目录>：自动纳入该用户的全部事实语料（推荐用法）
const userDir = flag('--user');
if (userDir) {
  try {
    const entries = readdirSync(userDir, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name);
    for (const name of entries) {
      const full = join(userDir, name);
      if (/-事实基线\.json$/.test(name)) addCorpus(full, '事实基线');
      else if (/-事实溯源清单\.json$/.test(name)) addCorpus(full, '溯源清单');
      else if (/-画像\.md$/.test(name)) addCorpus(full, '画像（含用户确认增补）');
      else if (/^优化清单-个案\.md$/.test(name)) addCorpus(full, '个案规则（数字锚点）');
      else if (/^项目素材库\.md$/.test(name)) addCorpus(full, '项目素材库');
    }
  } catch (error) { fail(`无法读取 --user 目录 ${userDir}: ${error.message}`); }
}

for (const extra of options.get('--corpus') || []) addCorpus(extra, '附加语料');

if (corpusParts.length === 0) {
  console.error('至少需要一个事实语料（--profile / --trace / --corpus）');
  process.exit(2);
}

// ---------- 2. 抽取简历里的数字 ----------
const SKIP_KEYS = new Set(['photo', 'photoFile', 'avatar', 'id', 'createdAt', 'updatedAt', 'templateId', 'draggingProjectId', 'githubKey', 'fieldOrder', 'icons', 'photoConfig', 'menuSections', 'globalSettings']);
const isNoiseValue = (v) =>
  /^data:/i.test(v) || /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);

const stripHtml = (s) =>
  String(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
      const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return n <= 0x10ffff ? String.fromCodePoint(n) : ' ';
    })
    // 仅日期分隔符等价；普通小数的点不能被当成连字符。
    .replace(/\b((?:19|20)\d{2})[./-](0?[1-9]|1[0-2])(?:[./-](0?[1-9]|[12]\d|3[01]))?\b/g,
      (_, year, month, day) => `${year} ${Number(month)}${day ? ` ${Number(day)}` : ''}`)
    .replace(/\s+/g, ' ')
    .trim();

const NUMBER_RE = /(?<![A-Za-z0-9_.])[+-]?\d+(?:,\d{3})*(?:\.\d+)?(?:e[+-]?\d+)?(?:\s*[%+])?/gi;
const normalizeToken = token => token.replace(/[,\s]/g, '').toLowerCase();
let findings = [];

const scanValue = (raw, path) => {
  const text = stripHtml(raw);
  if (!text) return;
  for (const match of text.matchAll(NUMBER_RE)) {
    const token = match[0], idx = match.index;
    findings.push({
      token: normalizeToken(token),
      path,
      context: text.slice(Math.max(0, idx - 40), idx + token.length + 40),
    });
  }
};

const walk = (node, path) => {
  if (node == null) return;
  if (typeof node === 'string') {
    if (isNoiseValue(node)) return;
    const { text, dropped } = stripRetracted(node);
    if (readingSource) retractedLines += dropped;
    scanValue(readingSource ? text : node, path);
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
    if (readingSource) { try { assertUserDocument(node); } catch { return; } }
    if (readingSource && Object.hasOwn(node, 'status')) {
      if (node.status !== 'confirmed') return;
      if (!hasSource(node.source)) fail(`已确认来源项 ${path} 缺少 source`);
      if (Object.hasOwn(node, 'value')) { walk(node.value, path); return; }
    }
    for (const [k, v] of Object.entries(node)) {
      if (SKIP_KEYS.has(k) || factMetadataKeys.has(k)) continue;
      walk(v, path ? `${path}.${k}` : k);
    }
  }
};

let readingSource = true;
for (const part of corpusParts) walk(part, '');
const sourceTokens = new Set(findings.map(f => f.token));
readingSource = false;
findings = [];
const resume = readDocument(resumePath, format);
walk(resume, '');

// ---------- 3. 判定 ----------
const seen = new Map();
const hits = [];
const misses = [];
for (const f of findings) {
  const key = f.token;
  const hit = sourceTokens.has(key);
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
console.log('   范围：扫描正文、证书与讲稿数字；跳过照片、ID、布局等元数据。完整数字 token 匹配，不核验其对象、职责、单位或时间关系。');
console.log('   限制：来源命中不代表事实真实性；无数字的职责、来源本身及用户确认仍需人工核对。');

if (uniqMiss.length) {
  console.log('\n以下数字在事实语料里查不到——必须逐条处理：补来源（--corpus）或从稿子里删掉：');
  uniqMiss.forEach((m, i) => {
    console.log(`  ${String(i + 1).padStart(2, '0')}. 「${m.token}」 @ ${m.path || '(root)'}`);
    console.log(`      上下文: …${m.context}…`);
  });
  console.log('\n结论：❌ 存在未溯源数字，不得交付。');
  process.exit(1);
}

console.log('\n结论：✅ 所扫描的数字 token 均在提供的有效语料中出现。');
