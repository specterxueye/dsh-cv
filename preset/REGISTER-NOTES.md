# 预设注册壳实现指引（T4 依据 · captain 已调研确认）

> 结论：DSH 预设的 persona `text` **只能内嵌文本**（`{{variable}}` 模板，无文件引用），完整知识库必须走 **Skill** 承载；skill 根目录可配置绝对路径 → **内容单源保持在 dsh-cv，注册壳仅 3 个文件**。

## 一、最终架构

```
D:\DeepSeek harness\项目\dsh-cv\preset\            ← 唯一源
├── preset.yml                  # 元信息（name/description/order）
├── agent.cordis.yml            # AGENT-PLANE 组合（源文件）
├── prompts\                    # 01-system / 02-workflow / 03-rules（知识源，skill 引用）
└── skills\
    └── resume-writing\
        └── SKILL.md            # ★ 完整知识入口（frontmatter + 正文）

%USERPROFILE%\.dsh\.agent-presets\resume-master\    ← 注册壳（拷贝/同步）
├── preset.yml                  # 同源
└── agent.cordis.yml            # 同源（同步脚本维护）
```

## 二、agent.cordis.yml 核心行（依据 shipped `standard` 写法）

```yaml
# 人设：短文本内嵌（核心纪律 + 指向 skill/规则文件），不用 complete（保留宿主上下文）
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    text: >-
      你是简历写作专家（Resume Master，dsh-cv 插件）。
      最高纪律：能就是能、不能就是不能，客观理性实事求是；绝不编造简历内容，一切数字可溯源。
      每份简历必须逐条落实 D:\DeepSeek harness\项目\dsh-cv\data\rules\01-优化清单.md（0-7 条），
      生成 JSON 必须通过 D:\DeepSeek harness\项目\dsh-cv\scripts\validate-resume.mjs。
      工作第一步：加载 resume-writing skill。

# skills：customSkillDirs 绝对路径指向 dsh-cv（关键！单源）
- id: skill-filesystem
  name: '@deepseek-ai/dsh-skill-filesystem'
  config:
    customSkillDirs:
      - 'D:\DeepSeek harness\项目\dsh-cv\preset\skills'

- id: tool-skill
  name: '@deepseek-ai/dsh-tool-skill'

# 工具行（照 standard 的注释语义）
- id: tool-fs
  name: '@deepseek-ai/dsh-tool-fs'          # read/write/edit/read_image（图片 JD 识别）
- id: tool-fs-search
  name: '@deepseek-ai/dsh-tool-fs-search'
- id: tool-pwsh
  name: '@deepseek-ai/dsh-tool-pwsh'
  disabled: !!js process.platform !== 'win32'
- id: tool-jobs
  name: '@deepseek-ai/dsh-tool-jobs'
- id: tool-web
  name: '@deepseek-ai/dsh-tool-web'
  config: { fetch: false, searchTimeoutMs: 60000 }
- id: tool-ask-user
  name: '@deepseek-ai/dsh-tool-ask-user'
- id: tool-todo
  name: '@deepseek-ai/dsh-tool-todo'
```

## 三、SKILL.md（resume-writing · 完整知识入口）

frontmatter：
```yaml
---
name: resume-writing
description: 简历写作专家知识库：0-7 优化清单、真实性铁律、范本五规律、分岗位规则、magicv JSON 金标准。写任何简历前必读。
---
```

正文结构（引用 dsh-cv 绝对路径，不复制正文）：
1. 触发时机与工作流五阶段（引用 prompts\02-workflow.md）
2. 纪律（引用 data\rules\00-总则.md）
3. 规则清单（引用 data\rules\01~04）
4. 范文/句式按需读取指引（data\samples\、data\phrases\）
5. 交付与校验（validate-resume.mjs）

## 四、同步脚本

`dsh-cv\scripts\sync-preset.ps1`：把 preset.yml + agent.cordis.yml 从 dsh-cv\preset 复制到注册壳 + 打印摘要。改动源后运行一次即可。

## 五、验证步骤

1. 运行 sync-preset.ps1 → 注册壳两文件存在
2. 新开会话选择 resume-master 预设 → 确认 persona 生效（会话标题旁标签 + 系统提示出现简历专家文本）
3. 挂载检测：话中问"resume-writing skill 是否可加载"→ tool-skill 能列出
4. 若有异常，读 dsh-agent-presets README 的 mount 拒绝原因排查

## 六、实事求是边界

- persona 内嵌文本无法读取大文件 → **知识全靠 skill**（设计如此）
- `{{…}}` 无转义：persona 文本中不要写字面 `{{`（要写就避开）
- read_image 依赖模型声明 image 输入 + attachments 服务（宿主已具备，modlens 桥可用）

> 修订（engineer-1 · T4 实施）：注册壳按第五节实现为**目录联接（junction）单源**——`<DSH_HOME>\.agent-presets\resume-master` → `dsh-cv\preset`，由 `dsh-cv\scripts\sync-preset.ps1` 创建（junction 失败自动回退复制模式）。本机实测 `DSH_HOME=D:\dsh`（env 已设），即 `D:\dsh\.agent-presets\resume-master`；发现流程无缓存，单源改动即时生效。persona/工具行已按第二节实现并验证插件名全部存在（见 README「T4」节）。
