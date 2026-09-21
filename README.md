# dsh-cv · 简历大师（Resume Master）

面向中文求职场景的简历写作工具集：基于**人物事实画像**与目标岗位**招聘要求（JD，文字或图片）**，生成可直接导入 [magicv.art](https://magicv.art) 的标准简历 JSON。

核心设计原则：**事实可溯源 · 针对岗位定制 · 一页装下 · 零编造**。

> 📖 第一次安装与上手：[安装与使用](docs/安装与使用.md)（装什么、怎么装、装完怎么确认、怎么用）｜完整流程见 [用户手册](docs/user-guide.md)

## 特性

- **人物画像建档**：对话式采集 → 结构化事实基线（每条事实带来源），支持从已有简历/材料反解析。每个用户一组四件套：
  - **拷问式建档（`cv-intake` 技能）**：frontier 轮次提问法——每轮把当前能问的问题**整批列出、每题带推荐答案**，用户回"1✅ 2改成 X"即可，不必自己组织语言；成绩单/证书/项目仓库等**可自查项派 subagent 去查**，不占用用户。机制改造自 [mattpocock/skills](https://github.com/mattpocock/skills) 的 `grilling`（MIT），并针对"个人史实只有本人知道"重写了事实/决策分流
  - `<名字>-事实基线.json` —— **唯一事实源**：`basic / education / experience / projects / campus / awards / skills / selfEvaluation`，外加 `_rules` 规则区（待确认项 / 用户已确认回填 / 口径核验 / **作废口径登记**）。`status: pending` 的事实不得写入简历
  - `<名字>-事实溯源清单.json` —— 每条事实回指出处，并记录「衍生简历自述 vs 一手材料」的交叉校验结论
  - `<名字>-画像.md` —— **内部资产**：卖点、避雷点、面试口径与投递策略；**避雷点不进简历**
  - `项目素材库.md` —— 项目细节素材池，供换岗位时重组叙事
  - 口径作废时**不删记录**：把那一行标上 **`【作废】`**，溯源审计会自动将它排除出语料（见下"三重可执行门槛"）
- **JD 理解**：文字或图片输入（图片自动识别）；输出硬性要求 / 软性要求 / 加分项 / 关键词表 / **缺口清单**（画像中缺失的能力如实标注，绝不编造）
- **定制撰写**：按岗位重排经历、关键词加粗、技能分层（范本五规律）、自我评价采用"结论+论证"
- **magicv JSON 生成**：自动处理菜单-数据键一致（customData ↔ menuSections）、顶层 campus 双写、`autoOnePage` 一页开关、HTML 内容规范、UUID
- **校验与诊断**：结构校验器（必填字段/HTML 结构/菜单一致性/UUID）+ 0-7 优化清单逐项自检 + 无编造核查
- **蓝本壳复用**：以"已在 magicv.art 真实渲染验收过"的成品为壳（版式参数/照片/菜单结构），只替换内容层——避免每次从零调参试错（`scripts/merge-blueprint.mjs`）
- **★ 改动申请单与确认门**：**蓝本默认零改动**；替换/新增/删除/重排任何项目内容都要先出方案（改哪条/现状/拟改/为什么/影响/哪些不动），**用户批准后才生成**。未获批准的产物不得交付
- **三重可执行门槛**：结构校验（`validate-resume.mjs`）+ **数字溯源审计**（`audit-facts.mjs`：稿子里每个数字都要能在事实基线/溯源清单/语料里找到出处，查不到即退出码 1）+ **改动合规核对**（`diff-resume.mjs`：实际改动必须 ⊆ 申请单批准范围，越权即报错）
  - **⛔ 作废口径排除（语料污染防护）**：溯源审计的判据是"该数字在语料里出现过"，于是**一个已作废的数字只要还留在语料里，就永远能通过溯源**——连"原 X 条实为 Y 条"这类**更正句本身**也会让 X 合法。故 `audit-facts.mjs` 会剔除任何含 `【作废】` / `[RETRACTED]` 标记的**行**。口径作废时把记录那一行标上标记即可，无需删除历史。**注意：JSON 语料里标记要写在字符串值内部**（写成行首会破坏 JSON）
- **按 JD 取舍项目（`cv-intake` 场景 B）**：先给候选池（`项目素材库.md` ＋ 蓝本内未显示项目）按**六维打分**（关键词命中/职能同型/级别真实性/角色主导/可量化可溯源/差异化），再**一轮列出"点亮哪 3-4 项、收起哪几项、为什么"**由用户逐项裁决；结果写进改动申请单 `projectVisibility` 与 `changes(op:visibility)`。**未显示 ≠ 删除**，用户明确排除项永不进池
- **模块化项目库**：一份 JSON 内写入全部备选项目，用 `visible` 开关按 JD 点亮需要的 3-4 项（写了但不展示，随时切换）
- **面试侧技能**：`interview-pitch`（按岗位角度生成项目讲稿，含 2-3 条可能追问）+ `mock-interview`（友好复盘 / 高压追问 × BQ / JD 面 / 混合）
- **写作语料库**：技术岗（含后端/前端/算法AI/测试/运维）、央国企、行业（半导体/政务/运营商/新能源）共 100+ 条岗位规律与句库，全部来自网络检索提炼并标注来源方向，**不复制任何真实简历原文**

## 架构

通用资产与个人数据严格分离：

```
dsh-cv/
├── preset/          # DSH 预设（cordis.yml / prompts 工作流与规则引用 / skills 技能）
│   └── skills/      #   cv-intake（拷问式建档 + 按 JD 取舍项目）
│                    #   resume-writing（简历写作）/ interview-pitch（项目讲稿）/ mock-interview（模拟面试）
├── data/            # 通用写作资产（rules 规则库 / samples 范文规律 / phrases 句式库）
├── scripts/         # 生成器 build-resume / 蓝本合并 merge-blueprint / 结构校验 validate-resume
│                    #   数字溯源审计 audit-facts / 改动合规核对 diff-resume
│                    #   冒烟测试 / 渲染量高 / 预设同步
├── profile/         # profile / jd / strategy 输入模板（JSON schema）
├── docs/            # 安装与使用 · 用户手册 · 面试辅导方法
├── users/           # 个人数据层（每用户独立目录，仅存本机，不入库）
│   └── <用户名>/    #   事实基线 / 画像 / output 成品与申请单 / review 档案
└── README.md
```

## 环境要求

- **运行环境**：DeepSeek Harness（DSH）环境（技能挂载 + junction；见下）
- **脚本**：Node.js ≥ 16（无第三方依赖，独立于 DSH 亦可运行）
- **渲染验收（可选）**：Playwright-core + 本机 Chrome

## 安装（Windows）

```powershell
git clone https://github.com/specterxueye/dsh-cv.git
cd dsh-cv
pwsh -NoProfile -File scripts\install.ps1
```

安装脚本自动完成五件事：

1. 设置用户级环境变量 `DSH_CV_ROOT` = 仓库根；
2. **遍历 `preset\skills\*` 全量建立技能联接** `<DSH_HOME>\skills\<技能名>` → 仓库 `preset\skills\<技能名>`（新增技能子目录无需改脚本）；
3. 渲染预设注册壳（模板注入本机路径）；
4. **安装自检**（环境变量 / 技能联接 / 注册壳），打印 `[OK]` 逐项结果；
5. 打印摘要与「下一步怎么用」。

**不需要管理员权限**（用目录联接 Junction）；**克隆到任意目录均可**（含空格/中文路径）。装完自检应显示 **3/3 通过、技能联接 4/4 就位**：

```
== 安装自检 ==
  [OK]  DSH_CV_ROOT（用户级）= D:\...\dsh-cv
  [OK]  技能联接 4/4 就位：cv-intake, interview-pitch, mock-interview, resume-writing
  [OK]  预设注册壳就绪且已注入本机根：D:\dsh\.agent-presets\resume-master
```

新开 DSH 会话即可使用（触发词：建档 / 写简历 / 分析 JD / 按 JD 选项目 / magicv JSON），或在新建会话时选择「简历大师」预设。升级：`git pull` 后重跑 `install.ps1`（幂等）。

> 装不上、技能看不见、换电脑、卸载、以及每个触发词对应什么，见 **[安装与使用](docs/安装与使用.md)**（含常见问题表与手工核对命令）。

## 快速开始

1. **建档**：说一句"帮我写简历"即自动加载 `cv-intake` 技能——先要现成材料（已有简历/成绩单/证书/项目仓库，派 subagent 反解析后逐条回显确认），没材料就走 7 轮 frontier 提问（**每轮整批问、每题带推荐答案、可跳过**）→ 生成 `users\<用户名>\<名字>-事实基线.json`、画像与 `项目素材库.md`（卖点/避雷点为内部资产）。
2. **提供 JD**：粘贴文字或提供图片路径（图片自动识别，识别不确定项会要求确认）。
3. **选项目（按 JD 取舍）**：候选池按六维打分，一轮给出"点亮 3-4 项 / 收起哪几项 / 命中了哪条 JD 要求"，由你逐项裁决（`cv-intake` 场景 B）。
4. **出方案（改动申请单）**：产出 `strategy-*.json` 与 `changerequest-*.json`——后者写明改哪条 / 蓝本现状 / 拟改成什么 / JD 依据 / 影响 / **哪些不动**，并带上第 3 步的 `projectVisibility`。
5. **★ 确认门**：把申请单呈现给用户并**等待明确批准**（"你看着办""没回复"都不算）；批准后写回 `approved: true` 与 `touchedFields`，才能进入生成。**项目取舍的裁决只是输入，不等于批准。**
6. **生成**（二选一）：
   ```powershell
   # 模式 A（默认·微调）：复制蓝本 → 只改被批准的路径
   Copy-Item "<蓝本.json>" "<新稿.json>"
   # 模式 B（大改动·重写）：生成器产出内容层 → 套蓝本壳
   node "scripts\build-resume.mjs" --profile <profile.json> --strategy <strategy.json> --out <临时.json> [--quiet]
   node "scripts\merge-blueprint.mjs" --blueprint <蓝本.json> --content <临时.json> --out <新稿.json> --title "<姓名>-简历-<岗位>"
   ```
7. **三重校验（缺一不可）**：
   ```powershell
   node "scripts\validate-resume.mjs" <新稿.json> [--strict]              # ① 结构
   node "scripts\audit-facts.mjs" <新稿.json> --user "users\<用户名>"      # ② 数字溯源（可加 --corpus 补来源）
   node "scripts\diff-resume.mjs" --base <蓝本.json> --new <新稿.json> --expect <申请单.json>   # ③ 改动合规
   ```
   三者全绿才交付；任一不过 → 修复后重跑。
8. **导入**：打开 magicv.art → 导入 JSON（自带模板渲染，`autoOnePage` 已开启）。

每份交付附《写作说明》：关键词命中、来源说明、缺口清单、清单自检结果、**改动申请单（含批准记录）与差异报告**。

### 面试环节（可选，交付后衔接）

- `interview-pitch` 技能：按同一份 JD 与事实基线生成**项目讲稿**（开场句→背景与问题→我做了什么→结果→与本岗位的连接，含 2-3 条可能追问）
- `mock-interview` 技能：**模拟面试**（开局选风格与类型 → 一次一问 → 复盘含"最弱回答的改善版"）
- 概念教学法（把项目里的名词讲透，避免"背答案过不了追问"）：见 [面试辅导方法](docs/面试辅导方法.md)

## 输入格式

- **`--profile`**：见 `profile\profile-template.json`（事实基线，无来源的事实不得写入简历）
- **`--strategy`**：`jobTitle` / `keywords` / `customBlocks` / `sectionOverrides` / `settings`，见 `profile\strategy-template.json`

## 测试与验证

```powershell
# 端到端冒烟（任意 magicv 成品 → 反推输入 → 生成 → 校验）
node "scripts\_smoke-test.mjs" <金标准简历.json>

# 渲染高度测量（旧口径：量 A4 元素高度，受预览容器拉伸影响，仅供参考）
node "scripts\render-height.mjs" <resume.json>

# ★ 分页判据（推荐）：定位 magicv 自己画的「第N页结束」标记，判定页数与溢出量
node "scripts\render-measure3.cjs" <resume.json> [截图前缀]

# 版面逐块称重：量出每个区块占多少高度，用于定位"版面被谁吃掉"
node "scripts\render-blocks.cjs" <resume.json> [截图前缀]

# 数字溯源审计：稿子里每个数字回到事实语料核对（未命中退出码 1）
node "scripts\audit-facts.mjs" <resume.json> --user "users\<用户名>" [--profile <基线.json>] [--corpus <补充语料>]

# 改动合规核对：实际改动 ⊆ 申请单批准范围（越权退出码 1）
node "scripts\diff-resume.mjs" --base <蓝本.json> --new <新稿.json> [--expect <changerequest.json>]
```

> 三个脚本都设计成**可做门槛**：审计与核对失败时退出码为 1，可直接串进流水线。

## 数据与隐私

- 个人数据仅存本机 `users\<用户名>\`；**仓库不含任何个人数据**（`users\`、`test\`、`scripts\.smoke\` 均在 `.gitignore` 排除）。
- 写作规律库为通用资产（网络检索提炼的规律与句式，不复制真实简历原文）。

## 已知限制

1. **安装需运行 `install.ps1`**：预设注册壳依赖本机路径注入（模板 → 渲染），纯手工复制不可用；跨机 clone 后重跑 `install.ps1` 即完成。
2. **`autoOnePage` 实测不生效，不能当兜底**（2026-09-21 实测）：`autoOnePage: true` 的稿子在 magicv 预览里仍溢出 337px；开关开着与关着读数一致，**它不改变预览渲染**。
3. **"A4 元素高度"不是页数判据**：早期 `e2e-render.cjs` 量 `[class*="210mm"]` 元素高度，读数恒为 1750px——对任何简历都不变（极简探针把内容清空到每区块一行，仍是 1750px），量为**预览容器**而非内容。真判据是 magicv **自己画的「第N页结束」标记**：标记 y ≈ `A4 页高 1123px − 上下页边距`（1123−2×25=1073，实测 1073.6）。该画布会随内容长高，**不会截断内容**。
4. 图片 JD 识别依赖视觉桥可用性；识别不确定时会列出待确认项。
5. magicv 的顶层 `campus` 与 `customData` 存在双写设计，须经校验器守护，防止渲染缺失。
6. **magicv 记录会与仓库 JSON 分叉**：每次「导入简历」新建一条**同名**记录，反复试验后工作台会堆满同名稿；用户若在 UI 里手改过某条，那条就与 JSON 不再一致（本次即发现一条手改记录含 JSON 中不存在的表述）。**以 JSON 为准、只做导入导出**，手改须回流到 JSON（见路线图）。

## 路线图

- **面试防御审查（进行中）**：时间线自洽 / 技能-经历互证 / 表述余量清单化 → 已完成部分：面试讲稿与模拟面试技能、概念教学法（[docs/面试辅导方法.md](docs/面试辅导方法.md)）；待做：把"数字溯源审计"扩展到讲稿与模拟面试答案
- **一页口径（2026-09-21 统一）**：**一页装下 = 硬标准**（早先"不再以必须一页为目标"的说法**已作废**）。判据=下方「已知限制 3」的真实渲染标记（magicv 自画的「第N页结束」y ≈ 1073.6px）；`autoOnePage` 开关与 "A4 元素高度"读数**都不是判据**。达成顺序：① 删无效内容 ② 精炼措辞 ③ 按岗位相关性裁剪 ④ 收起低相关项目（`visible:false`，未显示 ≠ 删除）。**禁止达标手段**：压行距到不可读（实测"塞进一页"需压到行距 1.07）、关闭自我评价、隐藏核心项目凑页数。装不下时**如实摊牌**——把"要一页须收起哪一项"写进改动申请单，由用户裁决。（完整规则见 `data\rules\01-优化清单.md` §9）
- 用户手调回流（2026-09-21 暴露为真实痛点）：magicv 每次导入新建同名记录，用户在 UI 里的手改会与仓库 JSON **分叉**。待做：导入前记录指纹、手改差异回流、工作台记录清理
- `validate-resume` 增加内容密度估算 WARN（当前依赖人工渲染测量）
- `campus` 双写一致性由 WARN 升级为强制校验（本次已按 schema 第五节对齐，尚未纳入校验器）
- 权威副本机制：`current.json` 权威副本 + 桌面导入导出，避免多版本漂移
- 模块化项目库的**可见性清单**：已进申请单模板（`projectVisibility` + `changes(op:visibility)`）与 `cv-intake` 场景 B 的六维打分流程；**待做**：`diff-resume.mjs` 对"实际 `visible` 改动 ⊆ 批准范围"做强制核对（当前仍只核对 `touchedFields` 路径）

## 致谢

- 简历数据格式参照开源项目 [JOYCEQL/magic-resume](https://github.com/JOYCEQL/magic-resume)（schema 已按线上成品实测校准）
- 写作规律提炼自公开网络资源（范文站 / HR 视角帖 / 简历指导材料），每条标注来源方向
- `cv-intake` 技能的 frontier 轮次提问法改造自开源项目 [mattpocock/skills](https://github.com/mattpocock/skills) 的 `grilling` 技能（MIT License, Copyright (c) 2026 Matt Pocock）。本仓库版本是**针对建档场景的重写**（事实/决策分流、温和档节奏、可自查项派子代理、与 dsh-cv 确认门对接），不是逐字复制

## 许可

本仓库当前未附带 LICENSE 文件，版权归作者所有；如需使用或分发请与作者联系。
