#!/usr/bin/env node
/**
 * build-resume.mjs — magicv.art 简历 JSON 生成器（T3 / dsh-cv）
 *
 * 输入:
 *   --profile  <profile.json>   人物画像（事实原料，结构化事实）
 *   --strategy <strategy.json>  JD 分析 + 写作策略（由 LLM 侧产出：关键词/排序/
 *                               覆盖内容/自定义区块/全局设置）
 *   --out      <path>           输出路径；缺省 output/姓名-岗位-学校.json
 *   --quiet                     只输出错误与警告
 *
 * 输出: 与 data/rules/04-magicv-schema.md 金标准一致的 magicv.art 线上格式 JSON
 *
 * 无第三方依赖；需要 Node.js >= 16（node:crypto randomUUID）。
 *
 * 设计要点（对齐金标准 + 两份实测渲染成功成品）:
 *  - menuSections[].id 与 customData 键完全一致：自定义区块统一编号 custom-1、
 *    custom-2…（按顺序），内容逐项同步，杜绝"菜单 id 与数据 key 不匹配"渲染丢失
 *  - 顶层 campus 数组与 customData 校园菜单同步双写（线上版本历史遗留兼容）
 *  - HTML 字段统一 <ul><li><p>…</p></li></ul>，关键词/量化数字 <strong> 加粗
 *  - globalSettings.autoOnePage 恒为 true（一页装下为硬性要求）
 *  - id 全部使用 crypto.randomUUID()；photo base64 原样透传（支持从文件读取）
 *  - fieldOrder 按实测成品（渲染成功的两份线上导出均为 name+title 两项）
 *
 * 内容来源优先级（LLM 侧控制 > 画像事实）:
 *   strategy.sectionOverrides.<section> 存在则用之；否则取 profile.<section>。
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------- CLI 解析
function parseArgs(argv) {
  const opts = { profile: null, strategy: null, out: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--profile') opts.profile = argv[++i];
    else if (a === '--strategy') opts.strategy = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--help' || a === '-h') { usage(); process.exit(0); }
    else { console.error(`未知参数: ${a}`); usage(); process.exit(1); }
  }
  if (!opts.profile || !opts.strategy) {
    console.error('缺少 --profile 或 --strategy');
    usage();
    process.exit(1);
  }
  return opts;
}
function usage() {
  console.log('用法: node scripts/build-resume.mjs --profile <profile.json> --strategy <strategy.json> [--out <path>] [--quiet]');
}

// ---------------------------------------------------------------- 工具函数
function loadJson(path, label) {
  let raw;
  try { raw = readFileSync(path, 'utf8'); }
  catch (e) { fatal(`无法读取${label}文件: ${path} (${e.code})`); }
  try { return JSON.parse(raw); }
  catch (e) { fatal(`${label}文件不是合法 JSON: ${path} → ${e.message}`); }
}
function fatal(msg) { console.error(`[生成失败] ${msg}`); process.exit(1); }
function warn(msg) { console.warn(`[警告] ${msg}`); }
function info(msg) { console.log(msg); }

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** 关键词加粗。策略：
 *  1) 源文本中的 **xxx** 显式标记优先转 <strong>
 *  2) strategy.keywords 中出现的词做 <strong> 包裹（纯英文/数字词做词边界判断，避免 RAID 中的 AI 被误加粗）
 *  3) 已加粗内容不重复包裹（占位符隔离）
 */
function boldKeywords(text, keywords) {
  if (!text) return '';
  let t = String(text);
  const explicit = [];
  t = t.replace(/\*\*([^*]+)\*\*/g, (m, inner) => {
    explicit.push(inner);
    return `\u0000${explicit.length - 1}\u0000`;
  });
  const kws = [...new Set((keywords || []).map(k => String(k).trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length); // 长词先替换，避免 YOLO 吞掉 YOLOv5
  for (const kw of kws) {
    if (kw.length < 2) continue;
    const isWordLike = /^[A-Za-z0-9.+#/]+$/.test(kw);
    const re = new RegExp(escapeRe(kw), 'g');
    t = t.replace(re, (match, ...rest) => {
      const offset = rest[rest.length - 2];
      const full = rest[rest.length - 1];
      if (isWordLike) {
        const prev = full[offset - 1];
        const next = full[offset + match.length];
        if (prev && /[A-Za-z0-9]/.test(prev)) return match;
        if (next && /[A-Za-z0-9]/.test(next)) return match;
      }
      return `<strong>${match}</strong>`;
    });
  }
  t = t.replace(/\u0000(\d+)\u0000/g, (m, i) => `<strong>${explicit[Number(i)]}</strong>`);
  return t;
}

/** 把一组纯文本要点转成 magicv HTML（<ul><li><p>…</p></li></ul>）。
 *  - 条目以 "<ul" 开头 → 视为完整 HTML 片段原样透传（LLM 直写场景）
 *  - 条目以 "<li" 开头 → 视为 li 片段，包进 <ul>
 *  - 条目以 "<p"  开头 → 包成 <li>…</li>
 *  - 其余 → 关键词加粗后包 <li><p>…</p></li>
 */
function bulletsToHtml(bullets, keywords) {
  // 兼容数组与单条字符串；字符串视为单条要点
  const src = Array.isArray(bullets) ? bullets
    : (bullets === undefined || bullets === null ? [] : [bullets]);
  const list = src.map(b => String(b).trim()).filter(Boolean);
  if (list.length === 0) return '';
  const parts = [];
  for (const item of list) {
    if (/^<ul/i.test(item)) return item.trim();          // 完整片段直接透传
    if (/^<li/i.test(item)) parts.push(item.trim());     // li 片段
    else if (/^<p/i.test(item)) parts.push(`<li>${item.trim()}</li>`);
    else parts.push(`<li><p>${boldKeywords(item, keywords)}</p></li>`);
  }
  return `<ul>\n${parts.join('\n')}\n</ul>`;
}

/** 顶层段落（<p>…</p>）生成：project 描述头部等会用到 */
function paragraphHtml(text, keywords) {
  if (!text) return '';
  const t = String(text).trim();
  if (!t) return '';
  if (/^<p/i.test(t) || /^<ul/i.test(t)) return t;
  return `<p>${boldKeywords(t, keywords)}</p>`;
}

/** 日期范围拆分：startDate 里若给了 "2023/09 - 2027/06" 组合串而 endDate 为空，则拆分 */
function splitDateRange(startDate, endDate) {
  let s = String(startDate || '').trim();
  let e = String(endDate || '').trim();
  if (!e && /^(\d{4}\/\d{1,2})\s*[-–—]\s*(\d{4}\/\d{1,2})$/.test(s)) {
    const m = s.match(/^(\d{4}\/\d{1,2})\s*[-–—]\s*(\d{4}\/\d{1,2})$/);
    s = m[1];
    e = m[2];
  }
  return [s, e];
}

const CUSTOM_FIELD_ICONS = [
  [/求职/, 'Briefcase'],
  [/政治/, 'User'],
  [/籍贯/, 'User'],
  [/出生/, 'CalendarRange'],
  [/毕业/, 'School'],
  [/学校/, 'School'],
  [/邮箱/, 'Mail'],
  [/电话/, 'Phone'],
  [/微信/, 'MessageCircle'],
  [/博客/, 'Globe'],
];
function iconForLabel(label) {
  for (const [re, icon] of CUSTOM_FIELD_ICONS) if (re.test(label)) return icon;
  return 'User';
}

/** basic.customFields 规范化：支持对象 {label: value} 或数组 [{label,value,…}] */
function normalizeCustomFields(raw, defaults) {
  const out = [];
  const push = (label, value, icon) => {
    if (value === undefined || value === null || String(value).trim() === '') return;
    out.push({ id: randomUUID(), label: String(label), value: String(value), icon: icon || iconForLabel(label), visible: true, displayLabel: false });
  };
  if (Array.isArray(raw)) {
    for (const f of raw) {
      if (!f || f.label === undefined) continue;
      const value = f.value !== undefined ? f.value : (f.defaultValue || '');
      push(f.label, value, f.icon);
    }
  } else if (raw && typeof raw === 'object') {
    for (const [label, value] of Object.entries(raw)) push(label, value);
  }
  for (const [label, value, icon] of defaults) {
    if (!out.some(f => f.label === label)) push(label, value, icon);
  }
  return out;
}

/** 默认基本信息自定义字段（求职意向/出生年月/电话/籍贯/政治面貌/邮箱/毕业院校） */
function defaultCustomFields(profile, jobTitle) {
  const b = profile.basic || {};
  const defaults = [];
  defaults.push(['求职意向', jobTitle, 'Briefcase']);
  if (b.birthDate) defaults.push(['出生年月', b.birthDate, 'User']);
  if (b.phone) defaults.push(['电话', b.phone, 'User']);
  if (b.nativePlace) defaults.push(['籍贯', b.nativePlace, 'User']);
  if (b.politics) defaults.push(['政治面貌', b.politics, 'User']);
  if (b.email) defaults.push(['邮箱', b.email, 'User']);
  const edu = (profile.education || [])[0];
  if (edu && edu.school) {
    let v = `${edu.school} · ${edu.major || ''}`.trim();
    if (edu.endDate && /^\d{4}\/\d{2}$/.test(edu.endDate)) {
      const y = Number(edu.endDate.slice(0, 4));
      if (y >= 2000) v += ` · ${y}届`;
    }
    defaults.push(['毕业院校', v, 'School']);
  }
  return defaults;
}

// ---------------------------------------------------------------- 主体生成
function buildResume(profile, strategy) {
  const s = strategy || {};
  const p = profile || {};
  const b = p.basic || {};
  // v1 strategy 契约（profile/strategy-template.json）兼容映射：
  //   targetPosition→jobTitle / versionTitle→title / selfEval→selfEvaluation
  //   keywordPlacement 的键集合→keywords / photo→照片覆盖
  const v1Keywords = s.keywordPlacement && typeof s.keywordPlacement === 'object' && !Array.isArray(s.keywordPlacement)
    ? Object.keys(s.keywordPlacement).filter(Boolean) : [];
  const jobTitle = (s.jobTitle || s.targetPosition || b.title || '').trim();
  const name = (b.name || p.name || '').trim();
  const keywords = Array.isArray(s.keywords) ? s.keywords : v1Keywords;

  // ---- 自定义区块（menuSections 与 customData 的唯一事实源，保证键一致）----
  // customBlocks: [{key,title,icon,enabled,items:[{title,subtitle,dateRange,description:[..]}]}]
  const normalizeBlockItems = (it) => ({
    id: it.id || randomUUID(),
    title: it.title || '',
    subtitle: it.subtitle || '',
    dateRange: it.dateRange || (it.date || ''),
    description: bulletsToHtml(it.bullets || it.description, keywords),
    visible: it.visible !== false,
  });
  const customBlocks = (s.customBlocks || []).map(cb => {
    const block = { key: cb.key, title: cb.title || cb.key, icon: cb.icon || '📦', enabled: cb.enabled !== false };
    // 覆盖优先级：cb.items > sectionOverrides[<key>]（如 campus：profile 结构 name/position/date/bullets，经 defaultCustomBlockItems 映射）> 画像默认拉取
    let rawItems = cb.items;
    if (!rawItems) {
      const ov = s.sectionOverrides && s.sectionOverrides[block.key];
      rawItems = ov ? defaultCustomBlockItems(block.key, { [block.key]: ov }, keywords)
                    : defaultCustomBlockItems(block.key, p, keywords);
    }
    block.items = Array.isArray(rawItems) ? rawItems.map(normalizeBlockItems) : [normalizeBlockItems(rawItems)];
    return block;
  });

  // ---- 各标准区块内容（LLM 覆盖优先）----
  const sec = (name2) => s.sectionOverrides && s.sectionOverrides[name2] !== undefined
    ? s.sectionOverrides[name2] : p[name2];

  const education = (sec('education') || []).map(e => {
    const [startDate, endDate] = splitDateRange(e.startDate || '', e.endDate || '');
    return {
      id: randomUUID(),
      school: e.school || '',
      major: e.major || '',
      degree: e.degree || '',
      startDate,
      endDate,
      visible: e.visible !== false,
      gpa: e.gpa !== undefined ? String(e.gpa) : '',
      description: bulletsToHtml(e.bullets || e.description, keywords),
    };
  });

  const experience = (sec('experience') || []).map(e => ({
    id: randomUUID(),
    company: e.company || '',
    position: e.position || '',
    date: e.date || '',
    visible: e.visible !== false,
    details: bulletsToHtml(e.bullets || e.details, keywords),
  }));

  const projects = (sec('projects') || []).map(pr => {
    const bullets = pr.bullets || pr.description;
    const head = pr.headline || pr.techStack;   // 可选：<p> 开头摘要行（技术栈行）
    let html = '';
    if (head) html = paragraphHtml(head, keywords);
    html += bulletsToHtml(bullets, keywords);
    return {
      id: randomUUID(),
      name: pr.name || '',
      role: pr.role || '',
      date: pr.date || '',
      description: html,
      visible: pr.visible !== false,
      link: pr.link || '',
      linkLabel: pr.linkLabel || '',
    };
  });

  // ---- 顶层 campus（与 customData 校园菜单内容同步双写）----
  const campus = [];
  const schoolName = ((education[0] && education[0].school) || '');

  // ---- customData / menuSections 装配 ----
  const menuSections = [];
  const customData = {};
  let customSeq = 0;
  const customBlocksUsed = new Set();

  const pushMenu = (id, title, icon, enabled) => {
    menuSections.push({ id, title, icon, enabled: enabled !== false, order: menuSections.length });
  };

  // 标准内置菜单
  const stdMenus = [
    { key: 'basic', title: '基本信息', icon: '👤', hasData: true },
    { key: 'education', title: '教育经历', icon: '🎓', hasData: () => education.length > 0 },
    { key: 'experience', title: '实习经历', icon: '💼', hasData: () => experience.length > 0 },
    { key: 'projects', title: '项目经历', icon: '🚀', hasData: () => projects.length > 0 },
  ];
  const skillContent = bulletsToHtml(sec('skills'), keywords);
  const selfEvaluationContent = bulletsToHtml(
    Array.isArray(s.selfEval) && s.selfEval.length > 0 ? s.selfEval : sec('selfEvaluation'),
    keywords
  );

  // strategy.menuSections 全量控制（可选）；缺省则自动排序
  if (Array.isArray(s.menuSections) && s.menuSections.length > 0) {
    for (const m of s.menuSections) {
      if (m.key === 'campus' || customBlocks.some(cb => cb.key === m.key)) {
        const cb = customBlocks.find(x => x.key === m.key);
        if (!cb) continue;
        customSeq += 1;
        const id = `custom-${customSeq}`;
        customBlocksUsed.add(cb.key);
        pushMenu(id, m.title || cb.title, m.icon || cb.icon, m.enabled !== false && cb.enabled);
        if (m.enabled !== false && cb.enabled) customData[id] = cb.items;
        if (cb.key === 'campus') fillTopCampus(campus, cb.items);
      } else {
        pushMenu(m.key, m.title || stdTitle(m.key), m.icon || stdIcon(m.key), m.enabled !== false);
      }
    }
  } else {
    for (const m of stdMenus) {
      const has = typeof m.hasData === 'function' ? m.hasData() : true;
      if (has) pushMenu(m.key, m.title, m.icon, true);
    }
    for (const cb of customBlocks) {
      const idx = customBlocks.indexOf(cb);
      customSeq += 1;
      const id = `custom-${customSeq}`;
      customBlocksUsed.add(cb.key);
      pushMenu(id, cb.title, cb.icon, cb.enabled);
      if (cb.enabled) customData[id] = cb.items;
      if (cb.key === 'campus') fillTopCampus(campus, cb.items);
    }
    // 顶层 campus 兜底（无校园自定义区块但 profile 有 campus 时；位置放在技能菜单之前）
    if (campus.length === 0 && Array.isArray(p.campus) && p.campus.length > 0 && !customBlocksUsed.has('campus')) {
      customSeq += 1;
      const id = `custom-${customSeq}`;
      pushMenu(id, '校园经历', '🎬', true);
      customData[id] = p.campus.map(c => ({
        id: randomUUID(),
        title: c.name || '',
        subtitle: c.position || '',
        dateRange: c.date || '',
        description: bulletsToHtml(c.bullets || c.details, keywords),
        visible: c.visible !== false,
      }));
      fillTopCampus(campus, customData[id]);
    }
    if (skillContent) pushMenu('skills', '技能优势', '⚡', true);
    if (selfEvaluationContent) pushMenu('selfEvaluation', '自我评价', '📝', true);
  }

  // ---- basic ----
  // 自定义字段精确覆盖：strategy.customBasicFields（数组[{label,value,icon?}] 或对象）为最终列表（不补默认项）
  const customFields = Array.isArray(s.customBasicFields) || (s.customBasicFields && typeof s.customBasicFields === 'object')
    ? normalizeCustomFields(s.customBasicFields, [])
    : normalizeCustomFields(b.customFields, defaultCustomFields(p, jobTitle));
  const fieldOrder = Array.isArray(s.fieldOrder) && s.fieldOrder.length > 0
    ? s.fieldOrder.map(f => ({ id: f.id || randomUUID(), key: f.key, label: f.label, type: f.type || 'text', visible: f.visible !== false }))
    : [
        { id: '1', key: 'name', label: '姓名', type: 'text', visible: true },
        { id: '2', key: 'title', label: '职位', type: 'text', visible: true },
      ];

  // ---- photo：base64 原样透传（profile.basic.photo > strategy.photo > profile.basic.photoFile）----
  let photo = b.photo || '';
  if (!photo && typeof s.photo === 'string' && s.photo.trim()) photo = s.photo.trim();
  if (!photo && b.photoFile) {
    const photoPath = resolve(dirname(profilePathAbs), b.photoFile);
    try {
      const content = readFileSync(photoPath, 'utf8').trim();
      if (!content.startsWith('data:')) fatal(`photoFile 内容不是 data URI（应为 data:image/...;base64,...）: ${b.photoFile}`);
      photo = content;
    } catch (e) { fatal(`读取 photoFile 失败: ${photoPath} (${e.code || e.message})`); }
  }

  const basic = {
    name,
    title: jobTitle || name,
    employementStatus: b.employementStatus || '在校',
    email: b.email || '',
    phone: b.phone || '',
    location: b.location || '',
    birthDate: b.birthDate || '',
    fieldOrder,
    icons: {
      email: 'Mail', phone: 'Phone', birthDate: 'CalendarRange',
      employementStatus: 'Briefcase', location: 'MapPin',
    },
    photoConfig: { width: 90, height: 120, aspectRatio: '1:1', borderRadius: 'none', customBorderRadius: 0, visible: true },
    customFields,
    photo,
    githubKey: b.githubKey || '',
    githubUseName: b.githubUseName || '',
    githubContributionsVisible: b.githubContributionsVisible !== undefined ? !!b.githubContributionsVisible : false,
    layout: b.layout || 'left',
  };

  // ---- globalSettings（金标准默认；autoOnePage 恒 true）----
  const gs = s.settings || {};
  if (gs.autoOnePage !== undefined && gs.autoOnePage !== true) warn('settings.autoOnePage 被忽略：按硬性约束强制为 true');
  const globalSettings = {
    baseFontSize: gs.baseFontSize ?? 13,
    pagePadding: gs.pagePadding ?? 34,
    paragraphSpacing: gs.paragraphSpacing ?? 3,
    lineHeight: gs.lineHeight ?? 1.42,
    sectionSpacing: gs.sectionSpacing ?? 10,
    headerSize: gs.headerSize ?? 32,
    subheaderSize: gs.subheaderSize ?? 16,
    useIconMode: gs.useIconMode ?? false,
    themeColor: gs.themeColor ?? '#10b981',
    centerSubtitle: gs.centerSubtitle ?? true,
    autoOnePage: true,
    flexibleHeaderLayout: gs.flexibleHeaderLayout ?? true,
    fontFamily: gs.fontFamily ?? '"Alibaba PuHuiTi", sans-serif',
  };

  // ---- 顶层与元信息 ----
  const now = new Date().toISOString();  // ★ ISO 8601（5 份金标准成品实测均为 ISO；PowerShell 勘察曾误显为 MM/dd/yyyy）
  const schoolPart = schoolName || '未知学校';
  const versionTitle = (s.versionTitle || '').trim().replace(/\.json$/i, '');
  const title = s.title || versionTitle || `${name}-简历-${jobTitle || '岗位'}`;
  const fileNameBase = s.fileName || versionTitle || `${name}-${jobTitle || '岗位'}-${schoolPart}`;

  return {
    fileNameBase,
    data: {
      title,
      basic,
      education,
      skillContent,
      selfEvaluationContent,
      experience,
      campus,
      draggingProjectId: '',
      projects,
      menuSections,
      certificates: [],
      customData,
      activeSection: s.activeSection || 'projects',
      globalSettings,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      templateId: 'classic',
    },
  };
}

function stdTitle(key) {
  return ({ basic: '基本信息', education: '教育经历', experience: '实习经历',
    projects: '项目经历', skills: '技能优势', selfEvaluation: '自我评价' })[key] || key;
}
function stdIcon(key) {
  return ({ basic: '👤', education: '🎓', experience: '💼', projects: '🚀',
    skills: '⚡', selfEvaluation: '📝' })[key] || '📦';
}

/** 自定义区块缺省内容：从画像对应字段拉取 */
function defaultCustomBlockItems(key, profile, keywords) {
  if (key === 'campus') {
    const campus = profile.campus || [];
    return campus.map(c => ({
      id: randomUUID(),
      title: c.name || '',
      subtitle: c.position || '',
      dateRange: c.date || '',
      description: bulletsToHtml(c.bullets || c.details, keywords),
      visible: c.visible !== false,
    }));
  }
  if (key === 'awards') {
    const awards = profile.awards || profile.honors || [];
    return [{
      id: randomUUID(),
      title: '', subtitle: '', dateRange: '',
      description: bulletsToHtml(awards, keywords),
      visible: true,
    }];
  }
  if (key === 'certificates') {
    const certs = profile.certificates || [];
    return [{
      id: randomUUID(),
      title: '', subtitle: '', dateRange: '',
      description: bulletsToHtml(certs, keywords),
      visible: true,
    }];
  }
  return [];
}

/** 与 customData 校园条目同步的顶层 campus 数组（线上版兼容双写） */
function fillTopCampus(campusArr, items) {
  for (const it of items) {
    campusArr.push({
      id: it.id || randomUUID(),
      name: it.title || '',
      position: it.subtitle || '',
      date: it.dateRange || '',
      visible: it.visible !== false,
      details: it.description || '',
    });
  }
}

// ---------------------------------------------------------------- main
const opts = parseArgs(process.argv.slice(2));
const profilePathAbs = resolve(process.cwd(), opts.profile);
const profile = loadJson(profilePathAbs, 'profile');
const strategy = loadJson(resolve(process.cwd(), opts.strategy), 'strategy');

const { fileNameBase, data } = buildResume(profile, strategy);
const outPath = opts.out ? resolve(process.cwd(), opts.out)
  : join(PROJECT_ROOT, 'output', `${fileNameBase}.json`);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

if (!opts.quiet) {
  info(`[生成成功] ${outPath}`);
  info(`  菜单: ${data.menuSections.map(m => m.id).join(' → ')}`);
  info(`  customData 键: ${Object.keys(data.customData).join(', ') || '(无)'}`);
  info(`  campus 顶层条目: ${data.campus.length}；education ${data.education.length}；experience ${data.experience.length}；projects ${data.projects.length}`);
  info(`  autoOnePage=${data.globalSettings.autoOnePage} templateId=${data.templateId}`);
}
