# dsh-cv · 简历大师插件（Resume Master）

> 状态：v1.0 完成（面向所有用户）
> 定位：针对不同岗位 JD（文字/图片），基于**用户自己的事实画像** + **网络检索提炼的写作语料**，写出专业、有重点、不流水账、可溯源的定制简历，交付 **magicv.art 可直接导入的 JSON**。

## 一、架构：通用资产 ⊕ 个人数据（严格分离）

```
D:\DeepSeek harness\项目\dsh-cv\
├── preset\                 ★ 通用：预设（cordis.yml / prompts / skills / manifest）
│   └── prompts\            # 01-system 人设 / 02-workflow 工作流 / 03-rules 引用
│   └── skills\resume-writing\SKILL.md   # 知识入口
├── data\                   ★ 通用：写作资产（不含任何个人数据）
│   ├── rules\              # 00-总则 / 01-优化清单(通用版) / 02-范本五规律 / 03-分岗位规则 / 04-magicv-schema
│   ├── samples\            # 范文规律库（tech\ 技术岗 6 文件、soe\ 央国企 3 文件）——源于网络检索提炼
│   └── phrases\            # 动词库 / 量化句式 / 自我评价句式
├── scripts\                ★ 通用：build-resume.mjs（生成器）/ validate-resume.mjs（校验器）/ _smoke-test.mjs / sync-preset.ps1
├── profile\                ★ 通用：profile / jd / strategy 模板（JSON schema）
├── users\                  ● 个人层：每用户独立目录（事实基线/画像/成品/个案）
│   └── <用户名>\           # 示例用户（本机数据源，仅属该用户；插件逻辑零依赖；不入库）
│       ├── <名字>-事实基线.json / <名字>-画像.md / <名字>-事实溯源清单.json
│       ├── 优化清单-个案.md / 投递策略-个案.md
│       ├── output\         # 简历 JSON + 写作说明 + strategy
│       └── review\         # 回归验证档案
└── README.md
```

**红线**：通用规则库禁止出现具体用户姓名/数字/公司；用户数据一律进 `users\<该用户>\`。

## 二、数据来源（与个人本地文件无关）

| 资产 | 来源 |
|------|------|
| 写作规律（rules 01/02/03、samples、phrases） | **网络检索**提炼：范文站/HR 视角帖/简历指导材料 → 提炼规律入档（每条标注来源方向，存疑数字隔离）；**不复制任何真实简历原文**；发现新规律先更新规则库 |
| magicv JSON 格式（04-schema） | magic-resume 开源 schema + 线上成品格式校准（通用格式标准） |
| 某用户的事实 | 该用户自己提供（对话/材料目录），经**事实溯源**入基线（每事实带 source）；插件不默认引用任何用户数据 |

## 三、使用流程（任意新用户）

1. **建档**：插件按工作流提问 → 生成 `users\<用户名>\<名字>-事实基线.json` + 画像（卖点/避雷点仅内部）。
2. **给 JD**：文字或图片（图片自动识别）→ JD 理解卡。
3. **定制撰写**：写作策略 → `build-resume.mjs` 生成 magicv JSON（自动：关键词加粗/菜单-数据键一致/一页开关/HTML 规范）。
4. **诊断交付**：`validate-resume.mjs` + 0-7 清单自检 → 《写作说明》随 JSON 交付（导入 magicv.art 即用）。

## 四、纪律（不可违背）

1. **简历只写优势与真实成果，绝不写缺点**；画像避雷点=内部资产。
2. **无据不写**：数字/经历/技能可溯源（用户事实基线）；JD 缺口处理=挖掘相近/建议补充/明确不写（不进简历正文）。
3. 一页装下：autoOnePage + 按岗位相关性裁剪。
4. 结构固定：基础信息 → 教育 → 实习 → 项目 → 校园/实践 → 技能 → 自我评价；证书并入技能。

## 五、T3 · 生成器与校验器（运行说明）

```powershell
# 生成（test\ 为示例夹具，可作新用户最小示例）
node "D:\DeepSeek harness\项目\dsh-cv\scripts\build-resume.mjs" --profile <profile.json> --strategy <strategy.json> [--out <输出.json>] [--quiet]

# 校验（退出码 0=通过；--strict 把 WARN 升级为失败）
node "D:\DeepSeek harness\项目\dsh-cv\scripts\validate-resume.mjs" <resume.json> [--strict]

# 端到端冒烟（金标准示例用户 → 反推输入 → 生成 → 校验）
node "D:\DeepSeek harness\项目\dsh-cv\scripts\_smoke-test.mjs"
```

- 生成器输入契约：`--profile`（profile-template.json v2 结构）+ `--strategy`（jobTitle/keywords/customBlocks/sectionOverrides/settings；另兼容 v1 字段）。
- 实测校准：菜单 id↔customData 键一致（custom-N 连续编号）、顶层层 campus 双写、autoOnePage 恒 true、templateId=classic、时间戳 ISO 8601（5 份线上成品实测）、fieldOrder=name/title。schema 与成品冲突处以成品为准。

## 六、安装（装好即用，无需入口/切换）

**标准安装 = 用户技能根 junction（已验证热生效）**：
```
D:\dsh\skills\resume-writing  (junction) → D:\DeepSeek harness\项目\dsh-cv\preset\skills\resume-writing
```
- 安装命令：`New-Item -ItemType Junction -Path "$env:DSH_HOME\skills\resume-writing" -Value "D:\DeepSeek harness\项目\dsh-cv\preset\skills\resume-writing"`
- 效果：所有会话的技能目录立即出现 `resume-writing`（watch 热更新，无需重启）；对模型说出"写简历/分析 JD/生成 magicv JSON"即自动加载
- **单源**：技能正文在 dsh-cv；规则库/语料/脚本被技能按绝对路径引用，改 dsh-cv 即全局生效

**可选增强形态**：`preset\`（persona/工具行）已做好，注册壳 = `D:\dsh\.agent-presets\resume-master`（junction）。想开"简历专家专属会话"的新会话可选该预设；**非必需**。
- 人工验收（可选）：新会话选「简历大师」→ persona/skill 生效。
- 修改源后运行 `scripts\sync-preset.ps1`（junction 已建时幂等）。

**渲染验证**：`scripts\e2e-render.cjs`（依赖 playwright-core + 本机 Chrome，示例环境 `D:\desk\_tmp_magicv\`）——按工作流阶段 5b 判据执行。

## 七、示例用户数据（个人层 · 不入库）

`users\` 为**个人数据层**：含真实个人信息的示例用户数据（某个用户的基线/画像成品、`test\`、`scripts\.smoke\` 等）**不随本仓库分发**——隐私红线，见 `.gitignore`。新用户按本文档第三节在本地建档即可（数据结构见 `profile\` 模板）。

## 八、经验与插件改进方向（2026-08-23 复盘）

**已固化的机制**：HR 终审（5c）/ 渲染验证（5b）/ 零重复与信息单点原则 / 加粗手动标记（keywords=[] + ** 显式） / 离屏量高工具（render-height.mjs）。

**待改进（按优先级）**：
1. **一页密度策略**：目标 0.9-1.0 页（内容以真实数据满载为准），避免"砍到 0.85 页"造成内容浪费；render-height 已支持，建议把"满载 0.95±"写入 workflow 策略提示。
2. **面试防御审查**：HR 终审增加"时间线自洽/技能-经历互证/表述余量（如英语'可阅读'优于'流畅'）"三项（已在 5c 枚举，建议落成独立清单文件）。
3. **用户手调回流**：用户会手动改 JSON——流程应支持"以用户改版为源继续迭代"（已有一键同步桌面；建议把 _merge-user-edits 类工具并入官方 sync 脚本），并把用户手调中出现的新事实**回填事实基线**（本次已做：30+ 条/17 人/无人机云台/设备规范）。
4. **autoOnePage 警示**：它是"保险"不是"条件"——真一页判据 = render-height ≤1123px；建议 validate-resume 增加"内容密度估算 WARN"（当前依赖流程人工跑量高）。
5. **双写一致性**：顶层 campus 与 customData 的 title/date 需强制一致（validate 已 WARN，本次已修复用户版差异）。
6. **content source**：用户最终认可的文件（桌面版）与插件内副本保持同步——建议正式化"current.json 权威副本 + 桌面包导入导出"，避免多版本漂移。

## 九、路径与跨机部署（实事求是说明）

- 本插件设计为**单机部署**：技能 junction + 绝对路径前缀 `D:\DeepSeek harness\项目\dsh-cv\`（见 `preset\agent.cordis.yml` 的 `customSkillDirs` 与各 prompt 引用）。
- 换路径/换机器部署时：**全局替换该绝对路径前缀** 为新目录，重建 `~/.dsh/skills/resume-writing` junction 与 `~/.dsh/.agent-presets/resume-master` junction，再跑 `scripts\sync-preset.ps1`。
- 仓库即源码备份：clone 后按第五节"安装"操作（示例用户数据需本地自建，不入库）。
