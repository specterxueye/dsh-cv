# 更新日志

本仓库遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与[语义化版本](https://semver.org/lang/zh-CN/)。

> 历史标签 `v1.0.0` 与后来的 `v0.5.0` 均保留原始指向。本轮不兼容合同采用新主版本，候选代码为 **2.0.0-beta.1**；尚未创建该标签或 Release。

## [Unreleased]

## [2.0.0-beta.1] - 候选，未发布

### 修复

- 第一批正确性与安全：严格拒绝无效对象/数组类型；授权差异保留类型、空容器、照片和无歧义字段路径。
- 默认输出阻止路径越界、联接和静默覆盖；显式 `--force` 原子替换输出，保护输入及其硬链接。
- 校园覆盖与混合 HTML 列表不再丢内容；蓝本合并拒绝自定义栏目语义错配，并保留空照片选择。
- 本地量高使用隔离浏览器与惰性文本复制，拒绝布局注入、禁止页面脚本与外部资源；保留富文本实体文字。
- 新增纯合成核心回归与离线浏览器安全测试入口。
- 第二批：数字使用完整 token 集合匹配，覆盖长文、英文单位、证书与 Markdown 讲稿；缺失来源和损坏 JSON 可靠失败，报告明确语义限制。
- 分页改用全部文本 Range 矩形及可见图片/图形边界；核对导入文本、等待字体和图片，超页返回 1、未知或导入失败返回 2。旧在线测量命令统一入口，块测量复用导入流程。
- 第三批：原生 config-only bundle 以唯一 provider 注册四个技能；原生包解析资源路径，不依赖环境变量、目录联接或旧预设注册壳。
- 默认输出改到事实文件同级 output；显式资源允许清单排除用户目录、本地个案脚本和依赖。旧同名技能冲突可靠失败；安装器不再自动改注册表或旧入口。
- 隔离 DSH profile 已验安装、实际技能发现、表达式路径、不同源更新、移除和恢复；中文/空格/单引号路径通过，外部合成数据保持完整。
- 第四批：空模板与合成示例分离；模板、示例、待核和作废事实不能生成或提供数字来源。confirmed 值保留 source 与独立的材料强度，内部字段不渲染。
- schemaVersion=2 批准记录绑定原稿、策略、事实与方案；prepare 始终未批准，首次创建无须虚构蓝本，变化后旧批准失效。
- 工作流收敛到唯一权威入口，四个技能按需引用；职责不升级、个人笔记不改公共规则、政治面貌/调配意愿不推断，页数与栏目按 policy。
- CI 纳入 Node 22/24 三系统核心行为、离线浏览器和原生宿主生命周期；汇总 quality-gate 只接受全部作业成功，Action 固定官方 SHA 与只读权限。
- 浏览器开发依赖固定已验证的 1.63.0，锁文件保留可审查 diff。发布包改为逐文件清单，并以真实 npm pack 与合成私人文件验证排除。
- 补充参与维护、安全报告、问题/PR 模板，以及尚未执行的 GitHub 保护与预发布方案。离线夹具通过不等于线上 MagicV 或 PDF 已验收。

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
