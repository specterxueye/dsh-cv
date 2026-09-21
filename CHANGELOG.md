# 更新日志

本仓库遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与[语义化版本](https://semver.org/lang/zh-CN/)。

> 说明：首个公开标签 `v1.0.0`（2026-09-05）是早期快照；此后按语义化版本回归 0.x 递增，当前为 **0.5.0**。

## [0.5.0] - 2026-09-21

### 新增

- `scripts/lib/browser.cjs`：渲染脚本共用的**浏览器与依赖解析**（零依赖、零硬编码路径）
  - Chrome：`--chrome <路径>` > `$DSH_CV_CHROME` > `$CHROME_PATH` > 平台默认安装位置探测（Windows/macOS/Linux）> 回退 playwright `channel:"chrome"`
  - playwright-core：cwd > `$DSH_CV_PLAYWRIGHT_DIR` > `$PLAYWRIGHT_DIR` > 直接 require
- `scripts/check.mjs`：仓库自检（脚本语法 / JSON 可解析 / 技能 frontmatter 与目录名一致 / 脚本内禁止硬编码绝对路径 / 文档相对链接可解析 / manifest 与实际文件一致）
- 仓库规范化文件：`LICENSE`（MIT）、本 `CHANGELOG.md`、`THIRD-PARTY-NOTICES.md`、`package.json`、`.gitattributes`、`.editorconfig`、`.github/workflows/ci.yml`
- README 徽章与「依赖安装」说明

### 变更

- **渲染脚本去掉硬编码的 Chrome 绝对路径**：`e2e-render.cjs` / `render-blocks.cjs` / `render-measure.cjs` / `render-measure3.cjs` / `render-height.mjs` 统一改用 `scripts/lib/browser.cjs`，并新增 `--chrome <路径>` 参数；找不到浏览器时回退 playwright 的 `channel:"chrome"`，不再直接抛错
- `e2e-render.cjs` 明确标注为**旧判据**（量 `[class*="210mm"]` 容器高，实测恒约 1750px）；一页判定改用 `render-measure3.cjs`（「第N页结束」标记）
- 版本号统一为 0.5.0（`package.json` / `preset/manifest.json` / README / 文档）
- 依赖说明补全：真实渲染验收需 `npm i -D playwright-core`（或指向已装目录）

## [0.4.0] - 2026-09-21

### 新增

- `cv-intake` 技能（拷问式建档 + 按 JD 取舍项目）
  - 场景 A 建档（温和档）：frontier 轮次、每题带推荐答案、可自查项派 subagent、7 轮收口、禁止代答、`pending` 纪律
  - 场景 B 项目取舍（尖锐档）：六维打分 → 一轮裁决 → `projectVisibility` + `changes(op:"visibility")`
  - 参考文档：`references/frontier-建档问题树.md`、`references/jd-project-fit.md`
- `docs/安装与使用.md`：安装三步、自检与手工核对、首次使用、升级/换电脑/卸载、常见问题
- `install.ps1`：**安装自检**（用户级环境变量 / 技能联接 / 注册壳）与「下一步怎么用」输出
- `audit-facts.mjs`：含 `【作废】`/`[RETRACTED]` 标记的行**不进语料**（防已作废数字因仍留在语料里而永久通过溯源）
- `render-measure3.cjs`（「第N页结束」标记判据）、`render-blocks.cjs`（版面逐块称重）

### 变更

- `install.ps1` 由「只链 `resume-writing`」改为**遍历 `preset\skills\*` 全量建链**——原先新用户装完会静默缺 `interview-pitch` / `mock-interview`
- **一页口径统一（重要）**：一页装下 = **硬标准**
  - 判据＝真实渲染里 magicv 自画的「第N页结束」标记（y ≈ 1073.6px）；`autoOnePage` 开关与「A4 元素高度」读数**都不是判据**
  - 达成顺序：删无效内容 → 精炼措辞 → 按相关性裁剪 → 收起低相关项目（`visible:false`，未显示 ≠ 删除）
  - **禁止达标手段**：压行距到不可读、关闭自我评价、隐藏核心项目凑页数
  - 早先「不再以必须一页为目标」的说法**已作废**
- 工作流阶段 3 新增「第 0 步：项目取舍」；改动申请单新增 `projectVisibility` 与 `op:"visibility"`
- `resume-writing` 技能新增 §8「用户问怎么装/怎么用」

## [0.3.0] - 2026-09-18

### 新增

- 改动申请单 + **★确认门**（蓝本默认零改动；未获批准禁止生成）
- 三重可执行门槛：`validate-resume.mjs`（结构）、`audit-facts.mjs`（数字溯源）、`diff-resume.mjs`（改动合规）
- 面试侧技能：`interview-pitch`、`mock-interview`；`docs/面试辅导方法.md`
- `docs/架构评估-dsh-cv在DSH生态中的定位.md`（以 `architecture-assessment` 方法评估扩展点选型）

## [0.2.0] - 2026-09-05

### 变更

- **路径参数化**：仓库内零绝对路径（`DSH_CV_ROOT` + 模板注入注册壳 + `install.ps1` 一键安装，克隆到任意目录可用）
- README 按 GitHub 规范重写；新增用户手册 `docs/user-guide.md`；`render-height` 环境参数化

## [1.0.0] - 2026-09-05

### 新增

- 首个公开快照：规则库（`data/rules` 0-7 清单 / 总则 / 范本五规律 / 分岗位规则 / magicv 金标准）、范文与句式语料、`build-resume.mjs` 生成器、`validate-resume.mjs` 校验器、Agent Preset 与技能、个人数据层 gitignore 隔离
