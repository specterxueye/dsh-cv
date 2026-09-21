# 架构评估 — dsh-cv 在 DSH 生态中的定位

> 评估日期：2026-09-18　｜　评估方法：`architecture-assessment` skill（先锁轴线/意图/基准，再判断）
> **证据基础（实测，非记忆）**：本机安装状态（`D:\dsh\skills` 软链、`D:\dsh\.agent-presets` roster）、仓库结构、`dshmarket` 插件对照（`profiles\web\package.json` + `@mars-sea/dsh-commandcode-provider` 实体）

---

## 0. 范围与边界

| 项 | 内容 |
|---|---|
| **轴线（Axis）** | **平台集成度与产品定位** —— "它算不算 DSH 插件？有没有用？" |
| **不覆盖** | 脚本实现质量、规则库内容质量、性能、安全（这些是另外的轴线，本次不评） |
| **基准（Baseline）** | DSH 的**官方扩展点分类**（实测：Plugin / Preset / Skill 三类），以及 dshmarket 插件的真实形态 |
| **意图来源** | 用户自述（"第一个自己完全独立做的、方便自己的插件""顺应 dsh 万物插件的浪潮"）——**不是** README 的宣称 |

> ⚠️ 本次评估的意图（intent）由用户口述确认。若你的真实目标其实是"把它做成能发布给别人用的产品"，结论第 4/5 节需要改口径。请指出。

---

## 1. 这个东西实际上是什么

**它不是"没做成插件"，而是"用了另外两条官方扩展点"。**

`preset/REGISTER-NOTES.md` 写明了它的安装机制，实测与文档一致：

```
安装（scripts\install.ps1）
  1) 设用户级环境变量 DSH_CV_ROOT = 仓库根
  2) 技能联接：<DSH_HOME>\skills\{cv-intake, resume-writing, interview-pitch, mock-interview}
               → <仓库>\preset\skills\*（遍历 preset\skills\* 全量建链，新增技能子目录无需改脚本）
  3) 渲染预设注册壳：<DSH_HOME>\.agent-presets\resume-master\
```

**实测证据（2026-09-18 本机）**：

| 事实 | 证据 |
|---|---|
| 技能**真的挂载了** | `D:\dsh\skills\` 下 `resume-writing` / `interview-pitch` / `mock-interview` / `cv-intake` 四条是**目录联接/符号链接**（`l----`），指向仓库 `preset\skills\*` |
| 预设**真的注册了** | `D:\dsh\.agent-presets\resume-master\`（`agent.cordis.yml` 3.6 KB + `preset.yml`）—— 这正是 DSH roster 读取的位置 |
| 技能**此刻正在生效** | **本次会话就在用 `resume-writing`**（它也是这么被加载的） |

---

## 2. 载荷性决策（逐条判断）

### D1 — 选 Preset + Skill，而不是 Plugin ✅ **正确**

DSH 有三类并列扩展点（实测确认）：

| 扩展点 | 形态 | 提供什么 | 安装方式 |
|---|---|---|---|
| **Plugin** | npm 包 + `package.json` 的 `dsh.bundle.patch` + `cordis.patch.yml` | **运行时能力**：服务、模型工具、Client UI、模型路由 | 写进 profile 的 `dsh.profile.bundles` → `pnpm install` |
| **Preset** | `<DSH_HOME>\.agent-presets\<id>\`（`agent.cordis.yml` + `preset.yml`） | **一次会话的人格/提示词/工具组合** | 落到 `.agent-presets`，roster 自动列出 |
| **Skill** | `<DSH_HOME>\skills\<name>\SKILL.md` | **按需加载的知识与流程** | 落目录即生效（**热更新**） |

dsh-cv 用的是后两类。**这两个同样是官方一等公民**，不是二等公民。

**为什么它不该做成 Plugin（这是根因，不是借口）**：
- **Plugin 是路径无关的**（pnpm 装进 `node_modules`，靠包名解析）
- 而 dsh-cv 的核心资产是 **文件系统上的知识与数据**：`data/rules/*.md`（规则库五件套）、`scripts/*.mjs`（门槛）、`users/<用户名>/`（个人事实基线 + 素材库）
- 把它塞进 npm 包，等于**每改一条规则都要重新发版**——诊断上这是"用错了分发容器"

### D2 — 内容与能力同仓 ⚠️ **可接受，但有代价**

`data/`（规则）+ `scripts/`（能力）+ `users/`（数据）+ `preset/`（装配）混在一个仓库。
- 好处：单源、改一处全链路生效、gitignore 隔离个人数据
- 代价：**无法只把"能力"部分抽出来单独分发**（见 D1 的根因）

### D3 — 注入式安装（模板 + 占位符渲染）✅ **务实**

`preset/agent.cordis.yml` 是模板（`@DSH_CV_ROOT@` 占位），`sync-preset.ps1` 渲染出注册壳。
- 换来的：**仓库内零绝对路径 → clone 到任何目录都能装**（REGISTER-NOTES 明确记载这是 v2 相对 v1 的升级）
- 代价：改源后必须重跑 `sync-preset.ps1`（一条命令，README 有写）

---

## 3. 真正做得好的地方（具体）

1. **三道可执行门槛 —— 这是全项目最硬的价值，而且已经真实拦下过错误**
   - 本次生成中电信定制稿时：`diff-resume.mjs` **报出 20 项越权改动**（我把 `touchedFields` 写成了中文描述而非机器路径）→ 修正后通过
   - 同一个项目里：`audit-facts.mjs` **报出 2 个未溯源数字**（`311,106`、`2020+`）→ 补 `--corpus` 溯源后通过
   - **这不是设计文档里的承诺，是实际发生过两次的拦截。** 一个只有纪律没有牙齿的流程做不到这一点。

2. **规范驱动开发（SDD）落地得完整**：改动申请单（规格）→ ★确认门（人工批准）→ 实施 → 机器校验"实际改动 ⊆ 已批准范围"。**四步齐全，且最后一步是机器判据而非人肉自觉。**

3. **技能热更新**：软链指向仓库源文件，改 SKILL.md 立即生效，无需重装。

4. **个人数据层隔离**：`users/<用户名>/` 被 gitignore，公开仓库不含个人隐私 —— 这是能在 GitHub 上公开的前提。

5. **可预览安装**：`install.ps1 -DryRun` 先打印计划再执行。

---

## 4. 发现（Findings）

| # | 发现 | 严重度 | 追溯到的决策 |
|---|---|---|---|
| **F1** | **「感觉没啥用」是基准错配，不是事实。** 拿 dshmarket 里 npm Plugin 的尺子，去量一个 Preset + Skill 的东西，必然得出"不像插件"的结论 | 认知级（非缺陷） | 用户对 DSH 扩展点的分类认知 |
| **F2** | **它确实不是 dshmarket 插件，而且不应该硬做成那种。** 根因是分发容器与资产类型不匹配（Plugin = 路径无关的运行时能力；本项目的资产 = 文件系统上的知识 + 数据） | 定位级（已澄清） | D1 |
| **F3** | **只有一部分适合抽成 Plugin**：三道门槛（validate / audit / diff）+ magicv 渲染 —— 这些是**可执行能力**，做成模型工具后 agent 可直接调用，不必每次走 `pwsh` | 机会级 | D2 |
| **F4** | **分发门槛确实高于 npm 插件**：用户需 clone 仓库 + 跑 ps1（还要 PowerShell 7）+ 新会话生效。对比 dshmarket 插件的"一条命令"，这是真实劣势 | 中 | D1 + D3 |

> **未验证、不下结论的一项**：dshmarket 目前是否支持"只含 Skill 或 Preset 的包"。本地 `.dsh-market` 只有发现缓存（`discovery-compatibility-v1.json`），看不出市场是否接受非 Plugin 类型。**需要时应实际去市场搜一次确认，不要凭印象断言。**

> **2026-09-21 更新**：F4 的分发门槛已部分缓解——`install.ps1` 增加**安装自检**（环境变量/技能联接/注册壳，实跑 3/3）并打印「下一步怎么用」，且新增 `docs\安装与使用.md`（安装三步 / 自检与手工核对 / 首次使用 / 升级·换电脑·卸载 / 常见问题表）。**R4 的 npm 级分发（npx 引导、winget 包）仍未做。**

---

## 5. 建议（按杠杆排序）

**R1 — 不要在网易这场面试里弱化它。**（最高杠杆）
本 JD 要的三件事——「设计、实现和优化 Agent、Skill 或工作流」「沉淀模板、案例和最佳实践」「规范驱动开发」——**它全中**，而且**是真的在跑**（有测试、有校验门、有实际拦截记录、有会话在用）。
> 面试若问"你的插件怎么分发的？"——**如实答**：它是 Agent Preset + Skill 形态（DSH 的官方扩展点），通过脚本安装；我清楚它与 dshmarket 的 npm Plugin 是两类东西，也清楚各自的适用边界。**这个回答本身就是工程判断力的证据。**

**R2 — 若真要做成 Plugin，只抽"能力"，不搬"知识"。**
最小可行：一个 thin plugin，把 `validate-resume` / `audit-facts` / `diff-resume` / 渲染器注册为模型工具；规则库仍留在文件系统（或作为包内只读资源）。**这样既拿到"命令安装"的分发优势，又不牺牲"改规则不用发版"。**

**R3 — 把"价值证据"沉淀下来（比改代码更值钱）。**
把本次两处真实拦截（20 项越权 / 2 个未溯源数字）写进 README 的"为什么需要这道门槛"一节。**一个能举出具体拦截案例的工具，说服力远高于列出功能清单的工具。**

**R4 — 若目标转为"给别人用"，先解决 F4 的分发门槛**（例如提供 npx 引导脚本或 Scoop/winget 包），否则它天然只能服务本机。

---

## 6. 结论

**它有用，而且此刻正在用；它不是 dshmarket 那种插件，但那不是缺陷——是选对了扩展点。**

- 「没啥用」的根因是**基准错配**：DSH 的扩展点有 Plugin / Preset / Skill 三类并列，它用了后两类中的全部两类。
- 真正值得改的不是"把它做成 plugin"，而是 **F3（把可执行能力抽成 thin plugin）** 与 **F4（降低分发门槛）**。
- 最不该做的是：**因为它"不像市场上的插件"而在面试里把它说小**——这个 JD 要的东西，它恰好都有，而且有跑通的证据。
