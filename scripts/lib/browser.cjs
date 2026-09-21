/**
 * scripts/lib/browser.cjs — 渲染脚本共用的「浏览器 + playwright-core」解析（零依赖）
 *
 * 解决的问题：
 *   1) 仓库内**不写死任何绝对路径**（历史上 4 个 .cjs 都硬编码 C:\Program Files\...\chrome.exe）
 *   2) playwright-core 未装在本仓库时，允许指向别的已装目录
 *
 * 解析顺序（先显式、后环境变量、最后平台默认位置）：
 *   Chrome   : --chrome <path> / --chrome=<path>  >  $DSH_CV_CHROME  >  $CHROME_PATH
 *              >  平台默认安装位置探测（Win/macOS/Linux）>  交给 playwright 的 channel:"chrome"
 *   playwright-core : cwd > $DSH_CV_PLAYWRIGHT_DIR > $PLAYWRIGHT_DIR > 直接 require
 *
 * 用法：
 *   const { requireChromium, launchOptions, parseChromeArg, resolveChrome } = require('./lib/browser.cjs');
 *   const { chromium } = requireChromium('render-xxx.cjs');        // 找不到会打印引导并 exit(2)
 *   const browser = await chromium.launch(launchOptions({ headless: true }));
 */
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { createRequire } = require('node:module');

const CHROME_ENV_KEYS = ['DSH_CV_CHROME', 'CHROME_PATH'];
const PW_ENV_KEYS = ['DSH_CV_PLAYWRIGHT_DIR', 'PLAYWRIGHT_DIR'];

/** 各平台 Chrome/Edge 常见安装位置（仅作为候选，不假设存在） */
function defaultChromeCandidates() {
  const out = [];
  if (process.platform === 'win32') {
    for (const key of ['ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA']) {
      const base = process.env[key];
      if (!base) continue;
      out.push(join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      out.push(join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    out.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    out.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
    out.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    out.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable');
    out.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium');
    out.push('/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable');
  }
  return out;
}

/** 从 argv 里取 --chrome <path> / --chrome=<path>（无则返回 null） */
function parseChromeArg(argv = process.argv) {
  const eq = argv.find((a) => typeof a === 'string' && a.startsWith('--chrome='));
  if (eq) return eq.slice('--chrome='.length);
  const i = argv.indexOf('--chrome');
  if (i >= 0 && argv[i + 1] && !String(argv[i + 1]).startsWith('--')) return argv[i + 1];
  return null;
}

/**
 * 解析要用的 Chrome 可执行文件。
 * @returns {string|null} 命中则返回路径；都没命中返回 null（调用方应回退到 channel:'chrome'）
 */
function resolveChrome(argv = process.argv) {
  const explicit = parseChromeArg(argv);
  if (explicit) {
    if (!existsSync(explicit)) {
      throw new Error(`--chrome 指定的浏览器不存在：${explicit}`);
    }
    return explicit;
  }
  for (const key of CHROME_ENV_KEYS) {
    const v = process.env[key];
    if (v && existsSync(v)) return v;
  }
  for (const p of defaultChromeCandidates()) {
    if (existsSync(p)) return p;
  }
  return null;
}

/** 找一个能解析 playwright-core 的 require 上下文 */
function loadPlaywright() {
  const bases = [process.cwd(), ...PW_ENV_KEYS.map((k) => process.env[k]).filter(Boolean)];
  for (const base of bases) {
    try {
      return createRequire(join(base, 'package.json'))('playwright-core');
    } catch (e) { /* 继续尝试下一个 */ }
  }
  try {
    return require('playwright-core');
  } catch (e) {
    return null;
  }
}

/**
 * 取 chromium 并做可执行的失败引导（找不到就打印两条修复路径并 exit(2)）。
 * @param {string} who 调用方标识，用于报错前缀（如 'render-blocks.cjs'）
 */
function requireChromium(who = 'script') {
  const pw = loadPlaywright();
  if (!pw || !pw.chromium) {
    console.error(
      `[${who}] 找不到 playwright-core（真实渲染验收才需要）。任选其一：\n` +
      `  1) 在本仓库安装：npm i -D playwright-core\n` +
      `  2) 或指向已装目录：$env:PLAYWRIGHT_DIR="<含 node_modules 的目录>"（Windows）\n` +
      `                    export PLAYWRIGHT_DIR="<含 node_modules 的目录>"（macOS/Linux）`
    );
    process.exit(2);
  }
  return pw;
}

/**
 * 组装 chromium.launch 的选项：命中本地 Chrome 就用它，否则回退 channel:'chrome'。
 * @param {object} extra 其余 launch 选项（如 { headless: true }）
 */
function launchOptions(extra = {}, argv = process.argv) {
  const exe = resolveChrome(argv);
  if (exe) return { executablePath: exe, ...extra };
  return { channel: 'chrome', ...extra };
}

module.exports = {
  CHROME_ENV_KEYS,
  PW_ENV_KEYS,
  defaultChromeCandidates,
  parseChromeArg,
  resolveChrome,
  loadPlaywright,
  requireChromium,
  launchOptions,
};
