#!/usr/bin/env node
/**
 * diff-resume.mjs — 改动核对（确认门的执行侧牙齿）
 *
 * 作用：把「新稿 vs 蓝本」的真实差异逐条列出来，并（可选）核对它是否**全在用户批准的范围内**。
 *       确认门靠纪律约束"不得越权改动"，本脚本把它变成可执行判据：
 *       申请单里没写的路径 = 越权改动 → 退出码 1。
 *
 * 用法（仓库根执行）：
 *   node "scripts\diff-resume.mjs" --base "<蓝本.json>" --new "<新稿.json>" [--expect "<users\<用户名>\output\changerequest-<公司>-<岗位>.json>"]
 *
 * 申请单（changerequest-*.json）最小结构：
 *   { "approved": true, "approvedAt": "2026-09-17 13:20", "touchedFields": ["basic.title", "projects[0].description", "education[0].description"] }
 *   - touchedFields 支持数组下标与点号路径；父路径（如 projects[0]）视为覆盖其全部子字段。
 *   - approved 不为 true 时，本脚本直接拒绝核对（视为未批准）。
 */
import { readFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};
const basePath = flag('--base');
const newPath = flag('--new');
const expectPath = flag('--expect');
if (!basePath || !newPath) {
  console.error('用法: node scripts\\diff-resume.mjs --base <蓝本.json> --new <新稿.json> [--expect <changerequest.json>]');
  process.exit(2);
}

const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const base = J(basePath);
const next = J(newPath);

const norm = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : JSON.stringify(v ?? null));

// 逐字段收集路径 → 归一化值（跳过易变元数据与照片）
const SKIP = new Set(['id', 'createdAt', 'updatedAt', 'photo', 'photoFile', 'activeSection', 'draggingProjectId']);
const flat = (node, path, out) => {
  if (node === null || node === undefined) {
    out.set(path, '');
    return;
  }
  if (Array.isArray(node)) {
    if (node.length === 0) out.set(path, '[]');
    node.forEach((v, i) => flat(v, `${path}[${i}]`, out));
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (SKIP.has(k)) continue;
      flat(v, path ? `${path}.${k}` : k, out);
    }
    return;
  }
  out.set(path, norm(node));
};

const a = new Map();
const b = new Map();
flat(base, '', a);
flat(next, '', b);

const added = [];
const removed = [];
const changed = [];
for (const [k, v] of b) {
  if (!a.has(k)) added.push(k);
  else if (a.get(k) !== v) changed.push(k);
}
for (const k of a.keys()) if (!b.has(k)) removed.push(k);

const all = [...added, ...removed, ...changed].sort();
console.log('== diff-resume（改动核对）==');
console.log(`   蓝本: ${basePath}`);
console.log(`   新稿: ${newPath}`);
console.log(`   ➕ 新增字段 ${added.length} / ➖ 删除字段 ${removed.length} / ✏️ 修改字段 ${changed.length}`);

const label = (k) => (added.includes(k) ? '➕' : removed.includes(k) ? '➖' : '✏️');
const brief = (k) => {
  const before = (a.get(k) ?? '').toString();
  const after = (b.get(k) ?? '').toString();
  return `      蓝本: ${before.slice(0, 110) || '(空)'}\n      新稿: ${after.slice(0, 110) || '(空)'}`;
};
all.slice(0, 60).forEach((k) => {
  console.log(`  ${label(k)} ${k}`);
  console.log(brief(k));
});
if (all.length > 60) console.log(`  … 其余 ${all.length - 60} 条省略`);

if (!expectPath) {
  console.log('\n（未提供 --expect 申请单：仅列出差异，不做越权判定）');
  process.exit(0);
}

if (!existsSync(expectPath)) {
  console.error(`\n申请单不存在：${expectPath}`);
  process.exit(2);
}
const req = J(expectPath);
if (req.approved !== true) {
  console.log('\n结论：❌ 申请单 approved != true —— 用户尚未批准，不得核对通过。');
  process.exit(1);
}
const touched = Array.isArray(req.touchedFields) ? req.touchedFields : [];
const covered = (k) => touched.some((t) => k === t || k.startsWith(`${t}.`) || k.startsWith(`${t}[`));
const violations = all.filter((k) => !covered(k));

console.log(`\n   申请单: ${expectPath}`);
console.log(`   批准时间: ${req.approvedAt || '(未记录)'}｜批准字段 ${touched.length} 条`);
if (violations.length) {
  console.log('\n以下改动**不在用户批准范围内**（越权改动，必须撤销或回到用户处补充批准）：');
  violations.forEach((k, i) => {
    console.log(`  ${String(i + 1).padStart(2, '0')}. ${k}`);
    console.log(brief(k));
  });
  console.log('\n结论：❌ 存在越权改动。');
  process.exit(1);
}
console.log('\n结论：✅ 全部改动均在用户批准范围内。');
