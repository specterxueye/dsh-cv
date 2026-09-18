#!/usr/bin/env node
/**
 * merge-blueprint.mjs — 蓝本壳复用：以"已验证蓝本"为壳（globalSettings/fieldOrder/菜单/照片），
 * 用生成器产出的岗位内容替换内容区块（education/experience/projects/campus/skills/selfEvaluation）。
 * 用法:
 *   node scripts\merge-blueprint.mjs --blueprint <蓝本.json> --content <生成品.json> --out <输出.json> [--title <标题>]
 *
 * 为什么：蓝本=已在 magicv.art 真实渲染验收的成品（版式/参数/照片/菜单结构已验证）；
 * 内容层用生成器（结构/HTML/加粗/双写保证），避免从零生成时版式参数反复试错。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };

const bluePath = arg('--blueprint');
const contentPath = arg('--content');
const outPath = arg('--out');
if (!bluePath || !contentPath || !outPath) {
  console.error('用法: node merge-blueprint.mjs --blueprint <蓝本.json> --content <生成品.json> --out <输出.json> [--title <标题>]');
  process.exit(2);
}

const blue = JSON.parse(readFileSync(bluePath, 'utf8'));
const gen = JSON.parse(readFileSync(contentPath, 'utf8'));
const newTitle = arg('--title') || gen.title || blue.title;

const out = {
  // ---- 壳（来自已验证蓝本）----
  menuSections: blue.menuSections,
  globalSettings: blue.globalSettings,
  id: blue.id,
  createdAt: blue.createdAt,
  updatedAt: new Date().toISOString(),
  templateId: blue.templateId || 'classic',
  activeSection: blue.activeSection || 'projects',
  draggingProjectId: blue.draggingProjectId || '',
  certificates: [],
  // ---- 内容（来自生成器）----
  title: newTitle,
  basic: { ...gen.basic, fieldOrder: blue.basic?.fieldOrder || gen.basic?.fieldOrder, photo: blue.basic?.photo || gen.basic?.photo, layout: blue.basic?.layout || gen.basic?.layout },
  education: gen.education || [],
  experience: gen.experience || [],
  projects: gen.projects || [],
  campus: gen.campus || [],
  customData: gen.customData || {},
  skillContent: gen.skillContent || '',
  selfEvaluationContent: gen.selfEvaluationContent || '',
};

// 校验：菜单键 ⊆ customData（防孤儿键/缺失键）
const menuIds = new Set((out.menuSections || []).map(m => m.id));
const dataKeys = Object.keys(out.customData || {});
for (const k of dataKeys) if (!menuIds.has(k)) console.warn(`WARN: customData 孤儿键 ${k}（无对应菜单）`);
for (const m of (out.menuSections || [])) {
  if (!['basic', 'education', 'experience', 'projects', 'skills', 'selfEvaluation'].includes(m.id) && !dataKeys.includes(m.id)) {
    console.warn(`WARN: 菜单 ${m.id} 无对应 customData 数据`);
  }
}

writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`[合并完成] 蓝本壳 + 生成器内容 → ${outPath}`);
console.log(`  菜单: ${(out.menuSections || []).map(m => m.id).join(' → ')}`);
console.log(`  区块: education ${out.education.length} / experience ${out.experience.length} / projects ${out.projects.length} / campus ${out.campus.length}`);
console.log(`  壳参数: font=${out.globalSettings?.baseFontSize} lineHeight=${out.globalSettings?.lineHeight} autoOnePage=${out.globalSettings?.autoOnePage}`);
