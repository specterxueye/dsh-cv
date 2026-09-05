# dsh-cv · 简历大师（Resume Master）

面向中文求职场景的简历写作工具集：基于**人物事实画像**与目标岗位**招聘要求（JD，文字或图片）**，生成可直接导入 [magicv.art](https://magicv.art) 的标准简历 JSON。

核心设计原则：**事实可溯源 · 针对岗位定制 · 一页装下 · 零编造**。

> 📖 完整使用流程见 [用户手册](docs/user-guide.md)

## 特性

- **人物画像建档**：对话式采集 → 结构化事实基线（每条事实带来源），支持从已有简历/材料反解析
- **JD 理解**：文字或图片输入（图片自动识别）；输出硬性要求 / 软性要求 / 加分项 / 关键词表 / **缺口清单**（画像中缺失的能力如实标注，绝不编造）
- **定制撰写**：按岗位重排经历、关键词加粗、技能分层（范本五规律）、自我评价采用"结论+论证"
- **magicv JSON 生成**：自动处理菜单-数据键一致（customData ↔ menuSections）、顶层 campus 双写、`autoOnePage` 一页开关、HTML 内容规范、UUID
- **校验与诊断**：结构校验器（必填字段/HTML 结构/菜单一致性/UUID）+ 0-7 优化清单逐项自检 + 无编造核查
- **写作语料库**：技术岗（含后端/前端/算法AI/测试/运维）、央国企、行业（半导体/政务/运营商/新能源）共 100+ 条岗位规律与句库，全部来自网络检索提炼并标注来源方向，**不复制任何真实简历原文**

## 架构

通用资产与个人数据严格分离：

```
dsh-cv/
├── preset/          # DSH 预设（cordis.yml / prompts / skills）
├── data/            # 通用写作资产（rules 规则库 / samples 范文规律 / phrases 句式库）
├── scripts/         # 生成器 / 校验器 / 冒烟测试 / 渲染验证 / 同步脚本
├── profile/         # profile / jd / strategy 输入模板（JSON schema）
├── users/           # 个人数据层（每用户独立目录，仅存本机，不入库）
│   └── <用户名>/    #   事实基线 / 画像 / output 成品 / review 档案
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

安装脚本自动完成三件事：

1. 设置用户级环境变量 `DSH_CV_ROOT` = 仓库根；
2. 建立技能联接 `<DSH_HOME>\skills\resume-writing` → 仓库 `preset\skills\resume-writing`；
3. 渲染预设注册壳（模板注入本机路径）。

**克隆到任意目录均可**。新开会话即可使用（触发词：写简历 / 分析 JD / magicv JSON），或在新建会话时选择「简历大师」预设。升级：`git pull` 后重跑 `install.ps1`（幂等）。

## 快速开始

1. **建档**：对话中按工作流提问（或提供已有简历/材料路径）→ 生成 `users\<用户名>\<名字>-事实基线.json` 与画像（卖点/避雷点为内部资产）。
2. **提供 JD**：粘贴文字或提供图片路径（图片自动识别，识别不确定项会要求确认）。
3. **生成**：写作策略确认后：
   ```powershell
   node "scripts\build-resume.mjs" --profile <profile.json> --strategy <strategy.json> [--out <输出.json>] [--quiet]
   ```
4. **校验**：
   ```powershell
   node "scripts\validate-resume.mjs" <resume.json> [--strict]
   ```
   退出码 0 = 通过；`--strict` 将 WARN 升级为失败。
5. **导入**：打开 magicv.art → 导入 JSON（自带模板渲染，`autoOnePage` 已开启）。

每份交付附带《写作说明》：关键词命中、来源说明、缺口清单、清单自检结果。

## 输入格式

- **`--profile`**：见 `profile\profile-template.json`（事实基线，无来源的事实不得写入简历）
- **`--strategy`**：`jobTitle` / `keywords` / `customBlocks` / `sectionOverrides` / `settings`，见 `profile\strategy-template.json`

## 测试与验证

```powershell
# 端到端冒烟（任意 magicv 成品 → 反推输入 → 生成 → 校验）
node "scripts\_smoke-test.mjs" <金标准简历.json>

# 渲染高度测量（一页判据：≤ 1123px）
node "scripts\render-height.mjs" <resume.json>
```

## 数据与隐私

- 个人数据仅存本机 `users\<用户名>\`；**仓库不含任何个人数据**（`users\`、`test\`、`scripts\.smoke\` 均在 `.gitignore` 排除）。
- 写作规律库为通用资产（网络检索提炼的规律与句式，不复制真实简历原文）。

## 已知限制

1. **安装需运行 `install.ps1`**：预设注册壳依赖本机路径注入（模板 → 渲染），纯手工复制不可用；跨机 clone 后重跑 `install.ps1` 即完成。
2. `autoOnePage` 是渲染侧的**保险机制**而非充分条件；真一页判据以渲染高度 ≤ 1123px 为准。
3. 图片 JD 识别依赖视觉桥可用性；识别不确定时会列出待确认项。
4. magicv 的顶层 `campus` 与 `customData` 存在双写设计，须经校验器守护，防止渲染缺失。

## 路线图

- 一页密度策略：内容满载 0.9–1.0 页为准（避免过度裁剪造成信息浪费）
- 面试防御审查：时间线自洽 / 技能-经历互证 / 表述余量清单化
- 用户手调回流：手改进阶正式化为"以用户改版为源继续迭代"，新事实自动回填基线
- `validate-resume` 增加内容密度估算 WARN（当前依赖人工渲染测量）
- `campus` 双写一致性由 WARN 升级为强制校验
- 权威副本机制：`current.json` 权威副本 + 桌面导入导出，避免多版本漂移

## 致谢

- 简历数据格式参照开源项目 [JOYCEQL/magic-resume](https://github.com/JOYCEQL/magic-resume)（schema 已按线上成品实测校准）
- 写作规律提炼自公开网络资源（范文站 / HR 视角帖 / 简历指导材料），每条标注来源方向

## 许可

本仓库当前未附带 LICENSE 文件，版权归作者所有；如需使用或分发请与作者联系。
