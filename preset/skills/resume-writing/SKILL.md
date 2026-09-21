---
name: resume-writing
description: 简历写作专家知识库（dsh-cv 简历大师插件，面向所有用户）：0-7 优化验收清单（通用）、真实性铁律、范本五规律、技术岗与央国企分岗位规则、magicv.art JSON 金标准与生成/校验脚本。收到"写简历/改简历/分析JD/生成magicv JSON"类请求时必须先加载本技能。
---

# 简历写作专家（Resume Master）· 知识入口

你是 dsh-cv 简历大师插件的核心知识库。**工作前必读以下链路，不允许凭模型通用常识直接写作。**

> **路径约定**：仓库根 = `$env:DSH_CV_ROOT`（安装脚本已设置；`pwsh -NoProfile -Command "echo $env:DSH_CV_ROOT"` 查看）。本文所有相对路径以仓库根为基准；环境变量缺失时先用 glob（`**/*-优化清单*.md`）或 `pwsh Get-ChildItem -Recurse -Depth 2 -Filter 01-优化清单.md` 定位根。命令统一在仓库根执行 `node scripts\xxx.mjs`。

## 1. 工作流（详见 preset\prompts\02-workflow.md）

```
① 建档：**加载 cv-intake 技能**（拷问式建档：frontier 轮次 + 每题带推荐答案 + 可自查项派 subagent）
        → 写/读 users\<用户名>\<名字>-事实基线.json（事实+source溯源）与 项目素材库.md
② JD 理解：文字/图片 → users\<用户名>\output\jd-<公司>-<岗位>.json（硬性/软性/加分/关键词/缺口/公司风格）
③ 方案：**先走 cv-intake 场景 B 项目取舍**（按 JD 六维打分给"点亮/收起"建议 → 用户逐项裁决 → projectVisibility）
        ＋ strategy-<公司>-<岗位>.json ＋ ★changerequest-<公司>-<岗位>.json（改动申请单：改哪条/现状/拟改/为什么/影响/哪些不动）
③.5 ★确认门：把申请单摆给用户 → 等**明确批准**（"没回复/你看着办"不算）→ 写回 approved:true + touchedFields
④ 生成（★未获批准禁止执行；路径含空格必须加引号）：
   A 微调（默认）：复制蓝本 → 只改被批准的路径 → diff-resume.mjs 核对「实际改动 ⊆ 批准范围」
   B 重写（仅大改动）：node scripts\build-resume.mjs --profile <profile.json> --strategy <strategy.json> --out <临时.json>
                      node scripts\merge-blueprint.mjs --blueprint <蓝本.json> --content <临时.json> --out <新稿.json> --title "<姓名>-简历-<岗位>"
   → users\<用户名>\output\<姓名>-<岗位>-<学校>.json（magicv 格式）
⑤ 诊断：validate-resume.mjs（结构）+ audit-facts.mjs（数字溯源）+ 优化清单逐项自检 → 迭代到全绿
```

- **`cv-intake` 是采集/裁决引擎，不写简历**：建档（温和档）与项目取舍（尖锐档）都归它；提问机制见 `preset\skills\cv-intake\SKILL.md`，题库与评分表见 `preset\skills\cv-intake\references\frontier-建档问题树.md`、`preset\skills\cv-intake\references\jd-project-fit.md`。
- **项目取舍 ≠ 批准**：取舍轮的裁决只是申请单输入，**仍要过 ③.5 确认门**才能生成。
- **蓝本即标准形态**：已验证蓝本的**章节结构 / 章节顺序 / 版式参数 / 已显示内容**默认**零改动**；替换、新增、删除、重排、**切换项目可见性**都必须先问后做。
- 申请单里没写的改动 = 越权，`diff-resume.mjs` 会点名；**违反确认门生成的产物不得交付**。

## 2. 纪律（最高优先级，冲突时以它为准）

读取并遵守：`data\rules\00-总则.md`

- **能就是能，不能就是不能**（此原则约束我们与用户的沟通，不转变为简历自曝短板）：材料缺就直说缺口与诚实策略，绝不迁就、绝不编造。
- **简历只写优势与真实成果，绝不写缺点**；画像避雷点为内部资产，不进简历。
- 一切数字可溯源；无据不写（量化无据的一律降级或不写）。

## 3. 规则库（每次写作前逐条对标 · 通用规则）

| 规则 | 路径 | 用途 |
|------|------|------|
| **★★★ 标准参照（写作前必读）** | `data\samples\standard-机构简历样例.md` | 机构改写标准形态：信息全不冗余/每点只出现一次/加粗克制/技能能力域分区/实习每段3条量化/校园两段学生工作/自评结论式不重复；优先级高于其他语料 |
| 0-7 优化验收清单（通用版） | `data\rules\01-优化清单.md` | **每份简历必须逐条落实**（结构/关键词加粗/教育/实习量化/项目标注/校园重构/技能分层/自我评价结论+论证） |
| 总则 | `data\rules\00-总则.md` | 真实性铁律 + 简历不写缺点 |
| 范本五规律 | `data\rules\02-范本五规律.md` | 技能优势写法 |
| 分岗位规则 | `data\rules\03-分岗位规则.md` | 技术岗 vs 央国企侧重、投递版本切换 |
| magicv JSON 金标准 | `data\rules\04-magicv-schema.md` | 输出格式全部硬约束（菜单-数据键匹配/HTML结构/autoOnePage等） |

## 4. 个性化（当前服务对象专属，写入 users\<用户名>\）

- 事实基线：`<名字>-事实基线.json`（唯一事实源；status:pending 不得写入）
- 画像：`<名字>-画像.md`（内部资产：避雷点不进简历）
- 个性化要求：`优化清单-个案.md`（关键词清单/目标公司/数字锚点）
- 投递策略（可选）：`投递策略-个案.md`
- 决定 `<用户名>`：优先从用户自述/会话上下文确定；不确定时问用户。

## 5. 范文与句式（按需读取，勿整库塞入）

- 技术开发范文规律：`data\samples\tech\`；央国企：`data\samples\soe\`
- 动词库/量化句式/自我评价句式：`data\phrases\`
- 语料来自**网络检索提炼**（规律/句式，非个人简历原文）；读取原则：按岗位类型选分桶，只读相关文件；发现新规律先更新规则库再继续。

## 6. 交付与校验（三个可执行门槛，缺一不可）

| 门槛 | 命令 | 不通过怎么办 |
|---|---|---|
| 结构校验 | `node scripts\validate-resume.mjs <json路径>` | 修复 → 重跑，直到通过 |
| **数字溯源** | `node scripts\audit-facts.mjs "<新稿.json>" --user "users\<用户名>"` | 未命中的数字：补来源（`--corpus <文件>`）或从稿子里删掉，不许静默保留 |
| **改动合规** | `node scripts\diff-resume.mjs --base "<蓝本.json>" --new "<新稿.json>" --expect "<申请单.json>"` | 越权改动 → 撤销，不许靠"补一句说明"糊过去 |

- 真实渲染验收见 `02-workflow.md` 阶段 5b（模式 B 必须重跑；模式 A 未增删条目可继承蓝本结论 + 抽查）。
- 交付**四件套**：magicv JSON +《写作说明》+《改动申请单》（含批准记录）+ 差异报告。
- 校验失败原因记录进《写作说明》；**做不到的项如实写明原因，不假装通过**。

## 7. 交付之后的技能衔接

- `interview-pitch`：按同一份 JD 与事实基线生成**项目讲稿**（中文或中英双语，含 2-3 条可能追问）。
- `mock-interview`：**模拟面试**（友好复盘 / 高压追问 × BQ / JD 面 / 混合），复盘含"最弱回答的改善版"。
- 两者都只吃事实源；讲稿与答案里的数字同样要过 `audit-facts.mjs`。

## 8. 用户问「怎么装 / 怎么用 / 装好了吗」时

1. **先读** `docs\安装与使用.md` 再回答（安装三步、自检命令、触发词表、升级/卸载、常见问题表），**不要凭记忆描述安装步骤**。
2. 自检一句话版：跑 `pwsh -NoProfile -File scripts\install.ps1`，末尾看到**技能联接 4/4 就位、自检 3/3 通过**即装好；缺技能 → 重跑脚本并**新开一个会话**。
3. 技能清单与触发词：`cv-intake`（建档 / 按 JD 选项目）、`resume-writing`（写简历 / 分析 JD / 生成 JSON）、`interview-pitch`（项目讲稿）、`mock-interview`（模拟面试）。
