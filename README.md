# dsh-cv · DeepSeek Harness 求职插件

[![ci](https://github.com/specterxueye/dsh-cv/actions/workflows/ci.yml/badge.svg)](https://github.com/specterxueye/dsh-cv/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

在 DSH 中整理真实经历、按招聘要求（JD）选择与改写内容，生成可导入 [MagicV](https://magicv.art) 的中文简历 JSON，并可继续准备项目讲稿和模拟面试。

当前代码为 `2.0.0-beta.1` 候选，尚未发布。历史标签保持原样，本轮分支未合入前，GitHub 默认分支和旧 Release 不代表此候选版。

重点是事实整理、职责边界、改写确认与变更保护。数字来源命中不证明语义真实，也不承诺通过 ATS、提升录用率或自动完成 PDF 验收。

## 安装与兼容

当前适配基准：DSH `0.2.0-rc.1`、Node 22.3+ 或 24.x。保留宿主标准预设；插件只注册四个技能，不另搭 Agent 框架或接管模型。本机实测 Node 24，Node 22 与其他系统待 CI。

```powershell
# 在本轮交付的候选代码目录执行
cd "<候选代码目录>"
dsh plugin --profile web add .
# Windows 辅助入口：pwsh -NoProfile -File ./scripts/install.ps1 -Profile web
```

macOS/Linux 使用相同的 DSH 原生命令。桌面托管 profile 使用宿主插件管理入口。候选包也可用 `dsh plugin --profile web add "<候选tgz绝对路径>"` 安装。当前候选分支尚未推送，普通 git clone 默认取得的旧 main 不能代替候选目录；合入或预发布后再提供固定 ref。不要把历史 v1.0.0 Release 当作本轮修复版。

安装成功后重开相应 profile，验证 cv-intake、resume-writing、interview-pitch、mock-interview 均可加载。旧全局同名技能需先核验来源，避免串版本。完整步骤、移除和恢复见 [安装与使用](docs/安装与使用.md)。

## 怎么用

1. 给出已有简历、项目材料和目标 JD；没有材料时逐步梳理，不必一次备齐。
2. 核对事实摘要与关键缺口；职责、成绩、数字以本人确认与提供的来源为边界。
3. 审阅项目取舍、改写范围、栏目和页数方案，明确批准后生成。
4. 获取可读正文和 JSON；按需要导入 MagicV 并核对导出 PDF。面试讲稿与逐题模拟是可选后续。

首次创建与已有稿修改有不同的审阅要求，完整流程见 [使用手册](docs/user-guide.md)；AI 执行流程见 [工作流](preset/prompts/02-workflow.md)。

## 资源和个人资料

插件包只提供技能、规则、模板与脚本。每位用户选择稳定的数据目录，保存事实基线、来源、偏好、方案和成品；更新或卸载插件不搬动该目录。旧仓库 users 目录可继续显式使用，迁移须另行批准。

```text
dsh-cv/                 用户选定的数据目录/
  cordis.patch.yml        事实基线.json
  preset/skills/          来源与个人偏好
  preset/prompts/         策略.json
  data/rules/             output/
  profile/                 简历.json、讲稿、批准记录
  scripts/
```

技能从宿主提供的 resourceBase.path 定位自己的包资源，不依赖 DSH_CV_ROOT 或递归搜索。默认成品写在事实基线同级的 output；同名输出默认拒绝覆盖，需要确认替换时显式使用 --force，输入始终不能作为覆盖目标。

## 独立使用脚本

核心脚本只依赖 Node 标准库。所有输入与输出路径都可以是绝对路径，从无关目录调用亦可。

空模板保存在 profile，复制到个人目录、填入本人确认的内容后将 `_meta.kind` 改为 `user-profile` 或 `user-strategy`。模板与合成示例会被拒绝生成和充当来源。新事实可用 `value/status/source`，材料核验强度单独记录；旧 plain 格式可兼容，不能据此宣称已证明真实。

```powershell
node "<资源根>/scripts/paths.mjs" --data-dir "<个人目录>"
node "<资源根>/scripts/build-resume.mjs" --profile "<个人目录>/事实基线.json" --strategy "<个人目录>/策略.json"
node "<资源根>/scripts/validate-resume.mjs" "<成品.json>" --strict
node "<资源根>/scripts/audit-facts.mjs" "<成品.json或讲稿.md>" --profile "<事实基线.json>" --corpus "<补充来源.md>"
node "<资源根>/scripts/approval.mjs" prepare --plan "<方案.json>" --out "<申请单.json>" --profile "<事实基线.json>" --strategy "<策略.json>" [--base "<原稿.json>"]
node "<资源根>/scripts/approval.mjs" check --request "<申请单.json>" --profile "<事实基线.json>" --strategy "<策略.json>" [--base "<原稿.json>"]
node "<资源根>/scripts/diff-resume.mjs" --base "<原稿.json>" --new "<新稿.json>" --expect "<申请单.json>" [--profile "<事实基线.json>"] [--strategy "<策略.json>"]
```

蓝本合并使用 merge-blueprint.mjs，复用布局时会严格检查自定义栏目的语义匹配。输入模板见 profile 目录，不能直接把示例内容当作本人经历。

prepare 始终生成未批准申请单，只有本次明确批准后才记录 approved 与 approvedAt。新 schemaVersion=2 绑定方案及 prepare 时显式提供的输入；求职流程须提供本次事实与策略，修改模式另绑定原稿。check 仅报告实际核对的范围，显式提供未绑定文件会失败；已绑定文件变化后须重新审阅，旧记录不能自动升级。首次方案用 mode=create，没有原稿则不做 diff；摘要只是版本保护，不是用户身份签名。

## 验证与排版

以下回归与仓库自检命令在源码开发目录运行。

```powershell
npm test                 # 核心行为、来源命中、安装合同；全部使用合成资料
npm run check            # 语法、资源、技能与文档自检
npm run check:package    # npm 实际发布清单必须与逐文件允许清单一致
npm run test:browser     # 离线安全与分页反例；需 playwright-core 和本机浏览器
```

源码开发目录使用锁文件安装 `npm ci --ignore-scripts`。从 tgz 安装的插件不含开发锁文件，渲染时让 PLAYWRIGHT_DIR 指向独立工具目录里已有的 playwright-core；本轮验证版本为 1.63.0。Chrome/Edge 路径由 --chrome、CHROME_PATH 或平台常见位置解析。

- render-height.mjs：禁脚本、禁外部请求的本地近似量高，不能代替 MagicV。
- render-measure3.cjs：在线导入所选 JSON，核对正文锚点，比较全部文本矩形与分页边界。0=ONE_PAGE、1=OVERFLOW、2=UNKNOWN/失败；最终另验 PDF。当前不自动验收多页 policy。
- render-blocks.cjs：共享导入核对后测量区块，仅供定位排版问题。
- 数字检查：0=扫描 token 均命中、1=存在未命中、2=输入或来源错误。对象、职责、单位、时间关系仍需人工核对。

2026-10-19 已验一份合成稿的实际导入及 1 页 A4 PDF。当前网页缺分页标记，在线测量返回 UNKNOWN；其他模板、多页与真实用户流程仍待验收。进度与待办见 [公开发布优化计划](docs/公开发布优化计划.md)。

## 隐私与边界

个人文件默认保存在用户选定的本地目录；仓库忽略 users/test/output 等目录，发布包另用资源允许清单防止误带资料。本地保存不等于处理过程离线：DSH 会把你发送的内容交给所配置模型；MagicV 是可选外部处理环节，在线测量也会导入选定文件。不承诺第三方保留政策或端到端离线。

通用规则在个人任务中只读。项目仍需真实 DSH 会话、外部导入/PDF 和陌生用户反馈来验证公开使用价值，不能以测试数量代替这些结果。

维护、候选包、CI 与待批准的 GitHub 设置见 [发布与维护](docs/发布与维护.md)；参与方式见 [CONTRIBUTING](CONTRIBUTING.md)，安全报告见 [SECURITY](SECURITY.md)。

## 许可与来源

MIT，见 [LICENSE](LICENSE) 和 [第三方说明](THIRD-PARTY-NOTICES.md)。cv-intake 的 frontier 提问机制改造自 [mattpocock/skills](https://github.com/mattpocock/skills) 的 grilling（MIT，Copyright 2026 Matt Pocock）；MagicV JSON 格式参照 [magic-resume](https://github.com/JOYCEQL/magic-resume)。版本变化见 [CHANGELOG](CHANGELOG.md)。
