#!/usr/bin/env node
/**
 * validate-resume.mjs — magicv.art 简历 JSON 校验器（T3 / dsh-cv）
 *
 * 用法: node scripts/validate-resume.mjs <resume.json> [--strict]
 *   --strict: 把 WARN 升级为失败（退出码 1）
 *
 * 退出码: 0 = 通过（仅 WARN/INFO）；1 = 存在 ERROR（或 --strict 下存在 WARN）
 *
 * 检查项（对齐 data/rules/04-magicv-schema.md 金标准）:
 *  1. JSON 可解析；顶层 + basic + globalSettings 必填字段齐全
 *  2. menuSections[].id 合法（basic/education/experience/projects/skills/
 *     selfEvaluation/custom-N），custom-N 唯一，启用菜单在 customData 有对应键
 *  3. customData 无孤儿键（每个 key 都有启用菜单）
 *  4. 全部 HTML 字段非空、<ul><li><p> 结构、标签配对、无裸文本、li 内文字必须
 *     由 <p> 包裹（magicv 特定渲染要求）
 *  5. 数据条目 id 非空（UUID 期望值——黄金成品本体使用可读 id，故仅 WARN）
 *  6. templateId=classic、autoOnePage=true、draggingProjectId 为空
 *  7. certificates 为数组（建议 []）
 *  8. 顶层 campus 与 customData 菜单内容一致（双写校验，按内容匹配不依赖菜单标题）
 *  9. fieldOrder 存在且含 name/title（实测成品形态）
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const fileArg = args.find(a => !a.startsWith('--'));
if (!fileArg) {
  console.error('用法: node scripts/validate-resume.mjs <resume.json> [--strict]');
  process.exit(1);
}
const filePath = resolve(process.cwd(), fileArg);

const issues = [];
const error = (msg) => issues.push({ level: 'ERROR', msg });
const warn = (msg) => issues.push({ level: 'WARN', msg });
const seen = (msg) => issues.push({ level: 'INFO', msg });

// ---------------------------------------------------------- 载入
let json;
try {
  json = JSON.parse(readFileSync(filePath, 'utf8'));
} catch (e) {
  console.error(`[ERROR] 文件不是合法 JSON: ${filePath} → ${e.message}`);
  process.exit(1);
}

// ---------------------------------------------------------- 1. 顶层必填
const TOP_KEYS = ['title', 'basic', 'education', 'skillContent', 'selfEvaluationContent',
  'experience', 'campus', 'draggingProjectId', 'projects', 'menuSections', 'certificates',
  'customData', 'activeSection', 'globalSettings', 'id', 'createdAt', 'updatedAt', 'templateId'];
for (const k of TOP_KEYS) {
  if (!(k in json)) error(`顶层缺少必填字段: ${k}`);
}

// ---------------------------------------------------------- 2. basic
const BASIC_KEYS = ['name', 'title', 'employementStatus', 'email', 'phone', 'location',
  'birthDate', 'fieldOrder', 'icons', 'photoConfig', 'customFields', 'photo',
  'githubKey', 'githubUseName', 'githubContributionsVisible', 'layout'];
if (json.basic) {
  for (const k of BASIC_KEYS) {
    if (!(k in json.basic)) error(`basic 缺少必填字段: ${k}`);
  }
  if (!json.basic.name) error('basic.name 为空');
  if (!json.basic.title) error('basic.title 为空');

  // fieldOrder：实测两份渲染成功成品均为 name+title 两项
  if (!Array.isArray(json.basic.fieldOrder) || json.basic.fieldOrder.length === 0) {
    error('basic.fieldOrder 必须为非空数组');
  } else {
    const keys = json.basic.fieldOrder.map(f => f && f.key);
    if (!keys.includes('name')) error('basic.fieldOrder 缺少 name 项');
    if (!keys.includes('title')) error('basic.fieldOrder 缺少 title 项');
    for (const f of json.basic.fieldOrder) {
      if (typeof f.visible !== 'boolean') warn(`fieldOrder 项 ${f.key} 缺少布尔 visible`);
    }
  }

  // photo：data URI 结构检查（若 base64 则查分段）
  if (typeof json.basic.photo !== 'string') {
    error('basic.photo 必须为字符串（可为空串或 data URI）');
  } else if (json.basic.photo && !/^data:image\//.test(json.basic.photo) && !/^https?:\/\//.test(json.basic.photo)) {
    warn('basic.photo 既不是 data:image URI 也不是 http(s) 链接，可能无法在线上渲染');
  } else if (/^data:image\//.test(json.basic.photo)) {
    const m = json.basic.photo.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,/);
    if (!m) warn('basic.photo 是 data URI 但缺少标准 base64 前缀 data:image/…;base64,');
  }
}

// ---------------------------------------------------------- 3. menuSections
const STD_IDS = ['basic', 'education', 'experience', 'projects', 'skills', 'selfEvaluation'];
const menuIds = [];
if (!Array.isArray(json.menuSections) || json.menuSections.length === 0) {
  error('menuSections 必须为非空数组');
} else {
  const customNums = [];
  json.menuSections.forEach((m, i) => {
    if (!m || typeof m.id !== 'string') { error(`menuSections[${i}] 缺少 id`); return; }
    menuIds.push(m.id);
    if (STD_IDS.includes(m.id)) {
      // 标准内置菜单
    } else if (/^custom-\d+$/.test(m.id)) {
      customNums.push(Number(m.id.slice('custom-'.length)));
    } else {
      error(`menuSections[${i}].id 非法: ${m.id}（应为 basic/education/experience/projects/skills/selfEvaluation/custom-N）`);
    }
    if (typeof m.enabled !== 'boolean') warn(`menuSections[${m.id}] 缺少布尔 enabled`);
    if (typeof m.order !== 'number') warn(`menuSections[${m.id}] 缺少数字 order`);
    else if (m.order !== i) warn(`menuSections[${m.id}] order=${m.order} 与数组位置 ${i} 不一致`);
    if (!m.title) warn(`menuSections[${m.id}] title 为空`);
  });
  if (new Set(menuIds).size !== menuIds.length) error('menuSections 存在重复 id');
  customNums.forEach((n, i) => {
    if (customNums.indexOf(n) !== i) error(`custom-N 编号重复: custom-${n}`);
    if (n < 1) error(`custom-N 编号必须从 1 开始: custom-${n}`);
  });
}

// ---------------------------------------------------------- 4. customData ↔ menuSections 一致性
const customData = json.customData;
if (!customData || typeof customData !== 'object' || Array.isArray(customData)) {
  error('customData 必须为对象');
} else {
  const customMenuIds = menuIds.filter(id => /^custom-\d+$/.test(id));
  for (const id of customMenuIds) {
    const menu = json.menuSections.find(m => m.id === id);
    const enabled = !menu || menu.enabled !== false;
    const hasKey = Object.prototype.hasOwnProperty.call(customData, id);
    if (enabled && !hasKey) error(`菜单 ${id} 已启用但 customData 缺少对应键（渲染会缺失）`);
    if (!enabled && hasKey) warn(`菜单 ${id} 已禁用但 customData 仍有数据（建议同步删除）`);
  }
  for (const key of Object.keys(customData)) {
    if (!/^custom-\d+$/.test(key)) error(`customData 键非法: ${key}（必须与菜单 custom-N 一致）`);
    if (!menuIds.includes(key)) error(`customData 孤儿键: ${key}（menuSections 中无对应菜单）`);
    if (!Array.isArray(customData[key])) {
      error(`customData.${key} 必须是数组（坑位：曾出现对象未包裹数组导致不渲染）`);
    } else {
      customData[key].forEach((item, i) => {
        if (!item || typeof item !== 'object') { error(`customData.${key}[${i}] 不是对象`); return; }
        if (!('description' in item)) error(`customData.${key}[${i}] 缺少 description`);
      });
    }
  }
}

// ---------------------------------------------------------- 5. HTML 结构检查
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function checkHtml(label, html, { allowLeadingP = false } = {}) {
  if (html === undefined || html === null) { error(`${label} 缺失`); return; }
  if (typeof html !== 'string') { error(`${label} 必须是字符串（HTML 字段，不是纯文本数组）`); return; }
  const h = html.trim();
  if (!h) { error(`${label} 为空`); return; }

  // 允许项目描述以 <p> 开头（金标准成品含技术栈导语），其余必须 <ul> 起头
  let rest = h;
  if (allowLeadingP) {
    rest = rest.replace(/^(<p[\s\S]*?<\/p>\s*)+/, '');
  }
  if (!/^<ul/i.test(rest)) error(`${label} 必须以 <ul> 开头${allowLeadingP ? '（前置 <p> 导语除外）' : ''}`);

  // 标签配对检查（ul/li/p/strong/em/b 栈式平衡）
  const stack = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let m;
  while ((m = tagRe.exec(h)) !== null) {
    const full = m[0], tag = m[1].toLowerCase();
    if (full.startsWith('</')) {
      const top = stack.pop();
      if (top !== tag) {
        error(`${label} 标签配对错误: 遇到 </${tag}>，期望 </${top || '无'}>`);
        return;
      }
    } else if (!['br', 'img', 'hr', 'meta', 'input'].includes(tag)) {
      stack.push(tag);
    }
  }
  if (stack.length > 0) error(`${label} 存在未闭合标签: <${stack.join('>, <')}>`);

  // 每个 <li> 内的文字必须被 <p> 包裹（magicv 特定渲染）
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/g;
  let liCount = 0;
  while ((m = liRe.exec(h)) !== null) {
    liCount += 1;
    const body = m[1];
    if (!/<p[\s>]/i.test(body)) {
      error(`${label} 第 ${liCount} 个 <li> 内缺少 <p>（magicv 要求 <li><p>…</p></li> 结构）`);
      continue;
    }
    // 去掉 <p>…</p> 后剩余文本必须是空（不可有 p 外裸文本）
    const withoutP = body.replace(/<p[\s\S]*?<\/p>/gi, '');
    const bareText = withoutP.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
    if (bareText) error(`${label} 第 ${liCount} 个 <li> 存在 <p> 之外的裸文本: "${bareText.slice(0, 40)}"`);
  }
  if (liCount === 0) error(`${label} 没有 <li> 条目`);
}

checkHtml('skillContent', json.skillContent);
checkHtml('selfEvaluationContent', json.selfEvaluationContent);

const eduIds = [], expIds = [], projIds = [], campusIds = [], cfIds = [], cdIds = [];
const collectId = (arr, label) => {
  if (!Array.isArray(arr)) { warn(`${label} 不是数组`); return; }
  arr.forEach((it, i) => {
    if (!it || typeof it !== 'object') { warn(`${label}[${i}] 不是对象`); return; }
    if (!it.id || typeof it.id !== 'string') error(`${label}[${i}] 缺少 id`);
    else if (!UUID_RE.test(it.id)) warn(`${label}[${i}].id 不是 UUID: ${it.id}（金标准成品允许可读 id，线上导入后可自愈，建议用 UUID）`);
    arr[i]._checkId = it.id;
  });
};

if (Array.isArray(json.education)) {
  json.education.forEach((e, i) => {
    if (!e.school) error(`education[${i}] 缺少 school`);
    checkHtml(`education[${i}].description`, e.description);
  });
  collectId(json.education, 'education');
}
if (Array.isArray(json.experience)) {
  json.experience.forEach((e, i) => {
    if (!e.company) error(`experience[${i}] 缺少 company`);
    if (!e.position) warn(`experience[${i}] position 为空`);
    checkHtml(`experience[${i}].details`, e.details);
  });
  collectId(json.experience, 'experience');
}
if (Array.isArray(json.projects)) {
  json.projects.forEach((pr, i) => {
    if (!pr.name) error(`projects[${i}] 缺少 name`);
    checkHtml(`projects[${i}].description`, pr.description, { allowLeadingP: true });
  });
  collectId(json.projects, 'projects');
}
if (Array.isArray(json.campus)) {
  json.campus.forEach((c, i) => {
    if (!c.name) warn(`campus[${i}] name 为空`);
    checkHtml(`campus[${i}].details`, c.details);
  });
  collectId(json.campus, 'campus');
}

// customFields id 检查
if (Array.isArray(json.basic && json.basic.customFields)) {
  json.basic.customFields.forEach((f, i) => {
    if (!f.id) error(`basic.customFields[${i}] 缺少 id`);
    else if (!UUID_RE.test(f.id)) warn(`basic.customFields[${i}].id 不是 UUID`);
    if (f.value === undefined || f.value === '') warn(`basic.customFields[${i}]（${f.label}）值为空`);
  });
}
for (const key of Object.keys(customData || {})) {
  if (Array.isArray(customData[key])) {
    customData[key].forEach((item) => {
      if (item && item.description) checkHtml(`customData.${key}.description`, item.description);
    });
    collectId(customData[key], `customData.${key}`);
  }
}

// campus 与 customData 校园菜单一致性（双写校验）
// 识别方式：按内容匹配（campus[].name === customData 条目 title 或 details 相同），
// 不依赖菜单标题文字（标题可能改为"在校经历"等），最稳健的来源是生成器双写保证同源。
if (Array.isArray(json.campus) && json.campus.length > 0) {
  const campusEntries = json.campus.filter(c => c && c.name);
  const matchedMenuIds = new Set();
  for (const c of campusEntries) {
    for (const menu of json.menuSections || []) {
      if (!/^custom-\d+$/.test(menu.id) || menu.enabled === false) continue;
      const items = (customData[menu.id] || []);
      const found = items.find(it => it.title === c.name) ||
        (c.details && items.find(it => it.description === c.details)) ||
        (items.length === 1 && items[0].title === '' && items[0].description && c.details &&
          items[0].description === c.details);
      if (found) { matchedMenuIds.add(menu.id); break; }
    }
  }
  if (matchedMenuIds.size === 0) {
    warn('顶层 campus 非空，但未找到内容一致的自定义菜单条目（历史版本可能不渲染；检查 menuSections/customData 双写）');
  } else {
    for (const menu of json.menuSections || []) {
      if (!matchedMenuIds.has(menu.id)) continue;
      const items = customData[menu.id] || [];
      const missing = campusEntries.filter(c => !items.some(it =>
        it.title === c.name || (c.details && it.description === c.details)));
      if (missing.length > 0) {
        warn(`顶层 campus 与 customData.${menu.id} 内容不一致，缺失条目: ${missing.map(m => m.name).join(' / ')}`);
      }
    }
  }
}

// ---------------------------------------------------------- 6. globalSettings / templateId / dragging
if (json.globalSettings) {
  if (json.globalSettings.autoOnePage !== true) error('globalSettings.autoOnePage 必须为 true（一页装下硬性要求）');
  if (!json.globalSettings.themeColor) warn('globalSettings.themeColor 为空');
  if (typeof json.globalSettings.baseFontSize !== 'number') warn('globalSettings.baseFontSize 应为数字');
}
if (json.templateId !== 'classic') error(`templateId 必须为 "classic"（当前: ${JSON.stringify(json.templateId)}）`);
if (json.draggingProjectId !== '' && json.draggingProjectId !== null) {
  warn(`draggingProjectId 应为空（当前: ${JSON.stringify(json.draggingProjectId)}）`);
}
if (!Array.isArray(json.certificates)) {
  error('certificates 必须为数组');
} else if (json.certificates.length > 0) {
  warn('certificates 非空（金标准建议 []，证书并入技能优势）');
}

// ---------------------------------------------------------- 汇总输出
const errors = issues.filter(i => i.level === 'ERROR');
const warns = issues.filter(i => i.level === 'WARN');
const infos = issues.filter(i => i.level === 'INFO');
console.log(`\n=== 校验报告: ${filePath} ===`);
for (const i of issues) console.log(`[${i.level}] ${i.msg}`);
console.log(`\n结果: ${errors.length} ERROR / ${warns.length} WARN / ${infos.length} INFO`);
if (errors.length > 0) console.log('结论: ❌ 未通过（存在必改问题）');
else if (strict && warns.length > 0) console.log('结论: ❌ 未通过（--strict 下 WARN 视为失败）');
else if (warns.length > 0) console.log('结论: ✅ 通过（含警告，建议核实）');
else console.log('结论: ✅ 全部通过');

process.exit(errors.length > 0 || (strict && warns.length > 0) ? 1 : 0);
