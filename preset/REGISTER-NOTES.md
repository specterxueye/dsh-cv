# 预设注册与安装机制（v2 · 路径无关）

> 本文件为开发/维护者参考。用户安装见 README「安装」与 `scripts\install.ps1`。

## 一、机制概览（v2 模板注入，仓库内零绝对路径）

```
仓库（任意目录，可 clone）
├── preset\agent.cordis.yml        ← 模板：@DSH_CV_ROOT@ 占位
├── preset\preset.yml              ← 展示元信息（原样复制）
└── preset\skills\resume-writing\  ← 技能源（SKILL.md 内部为相对路径 + $env:DSH_CV_ROOT 约定）

安装（scripts\install.ps1）
  1) 设置用户级环境变量 DSH_CV_ROOT = 仓库根
  2) 技能联接：<DSH_HOME>\skills\resume-writing → <仓库>\preset\skills\resume-writing
  3) 渲染注册壳：<DSH_HOME>\.agent-presets\resume-master\（agent.cordis.yml 注入根路径 + preset.yml）
```

- **源文件不写死绝对路径**；注册壳由 `sync-preset.ps1` 从模板渲染生成（生成式，不再使用目录联接）。
- 改动源后重跑 `scripts\sync-preset.ps1` 刷新注册壳（幂等）。
- 根目录解析顺序：`$env:DSH_CV_ROOT`（install 设置）> 脚本所在目录上级——**clone 到任何目录都能装**。

## 二、为什么从"目录联接"改为"模板注入生成"

目录联接单源很干净，但 DSH 读取的 `agent.cordis.yml` 需要本机绝对路径（`customSkillDirs`）——联接指向的源文件若写死绝对路径，仓库就无法跨机复用。v2 改为：源为模板（`@DSH_CV_ROOT@` 占位），安装时渲染注入，注册壳为生成目录。代价：改源需重跑 sync（一条命令，README 有说明）。

## 三、核心行（模板形态，出自 `standard` 参照）

```yaml
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    text: >-
      你是简历写作专家（Resume Master，dsh-cv 插件）。
      最高纪律：能就是能、不能就是不能，客观理性实事求是；绝不编造简历内容，一切数字可溯源。
      每份简历必须逐条落实 @DSH_CV_ROOT@\data\rules\01-优化清单.md（0-7 条），
      生成 JSON 必须通过 @DSH_CV_ROOT@\scripts\validate-resume.mjs。
      工作第一步：加载 resume-writing skill。

- id: skill-filesystem
  name: '@deepseek-ai/dsh-skill-filesystem'
  config:
    customSkillDirs:
      - '@DSH_CV_ROOT@\preset\skills'

- id: tool-skill
  name: '@deepseek-ai/dsh-tool-skill'
# 其余工具行（tool-fs / tool-fs-search / tool-pwsh / tool-jobs / tool-web / tool-ask-user / tool-todo）
# 见 preset\agent.cordis.yml 模板本体。
```

## 四、验证步骤

1. `pwsh -NoProfile -File scripts\install.ps1 -DryRun` 查看计划 → 正式运行。
2. 检查注册壳两文件存在、`customSkillDirs` 已注入本机路径。
3. 新开会话选「简历大师」预设 → persona/skill 生效（会话可读 `$env:DSH_CV_ROOT`）。
4. 所有会话技能目录出现 `resume-writing`（触发词：写简历 / 分析 JD / magicv JSON）。

## 五、路径约定（模型侧）

- 文档/SKILL 以相对路径（仓库根为基准）引用规则库；根由 `$env:DSH_CV_ROOT` 提供。
- 环境变量缺失兜底：glob `**/*-优化清单*.md` 或 `pwsh Get-ChildItem -Recurse -Depth 2 -Filter 01-优化清单.md` 定位根。
- 绝对路径仅出现在安装生成的注册壳与 `$env:DSH_CV_ROOT` 中；仓库工作区不含任何本机路径。

## 六、边界（实事求是）

- persona `text` 只能内嵌短文本（`{{variable}}` 模板，无文件引用）→ 完整知识走 Skill（设计如此）。
- `{{…}}` 无转义：模板文本中不要写字面 `{{`。
- `read_image` 依赖模型声明 image 输入 + attachments 服务（宿主已具备）。

> 修订：v2 由"目录联接单源"升级为"模板注入生成"（2026-08，路径参数化改造）。历史注记：v1 实测 `DSH_HOME=D:\dsh`（env 已设），注册壳位于 `D:\dsh\.agent-presets\resume-master`；v2 后注册壳仍按 `$env:DSH_HOME` 解析该位置，install 会自动转换旧联接。
