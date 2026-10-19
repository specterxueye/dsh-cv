# 权威工作流：从真实经历到岗位简历

本文是完整执行流程的唯一维护入口，其他技能按职责引用。资源根 ROOT 从已加载 SKILL.md 的 resourceBase.path 向上三级获得。DATA 是用户明确选择的个人目录；下文 users/<用户名>/ 只是 DATA 的简写，不能写进插件包。规则与脚本只读，命令用绝对路径，不依赖环境变量或当前目录。

## 1. 识别输入并整理事实

确认是否已有简历、目标 JD、可读材料和保存目录。已有材料先提取事实摘要，仅问冲突、关键缺失和职责边界；学校、日期等已知信息不重问。没有材料时加载 cv-intake，按当前最有价值的问题逐步整理，七轮题库仅作备用。工具和子智能体可用时处理独立材料；不可用时顺序完成，不把委派设为前提。

事实文件必须属于当前用户。空模板和合成示例不能直接生成或充当来源；复制模板后建立 kind=user-profile 的本人事实文件。新记录可用以下小合同：

```json
{"value":"本人实际完成的动作与产出","status":"confirmed","source":{"kind":"user-confirmation","reference":"本次明确确认"},"evidenceStatus":"unverified"}
```

status 与证据强度分开。confirmed 且有来源的事实可用；pending/retracted 不得生成或成为数字来源。待核事项放 pendingFacts 单独保留，不能替用户补答案。旧 plain profile 可兼容，但没有可执行的逐事实确认凭据，不能报告已证明真实。内部 _meta/_rules/source 等不能进入正文。

## 2. 集中审阅一次方案

读取总则与优化清单，按 JD 选相关经历，回显满足、待核、明确缺口。项目数量取决于材料与页数；候选项目可以隐藏而不删事实。不要把所有求职者套成校招，也不强制固定校园、自评或证书栏目。

在 strategy.policy 中记录 audience（unspecified/campus/professional/research）与 maxPages（null 或正整数）。已确认校招可建议一页；在职/科研依据材料与用户选择。autoOnePage 仅为外部格式字段，不承载页数政策。

方案卡集中列出项目取舍、关键改写、事实纠错、栏目/页数和保留项。首次创建写 mode=create，审阅拟创建内容；已有稿写 mode=edit，说明原稿与变化范围。用户必须明确批准，未回复或仅确认某条事实不等于批准整份方案。已授权范围内的常规实现不反复索要批准。

准备内部批准记录（命令中的路径均引用当前用户文件）：

```text
node "<ROOT>/scripts/approval.mjs" prepare --plan "<方案.json>" --out "<申请单.json>" --profile "<事实基线.json>" --strategy "<策略.json>" [--base "<原稿.json>"]
```

prepare 总是输出 approved=false。只在本次明确批准后，记录 approved=true 与 ISO approvedAt，并保留实际确认依据。schemaVersion=2、baseSha256、strategySha256、profileSha256 与 planSha256 绑定输入和方案；输入或方案变化后重新审阅，不能只改摘要延用旧批准。摘要是版本保护，不是用户身份签名。

## 3. 生成并检查

先运行 approval.mjs check，传入申请单及记录中绑定的同一份原稿/策略/事实文件。检查通过只证明记录与文件版本一致，不能证明同意或事实真实。

- 首次创建：build-resume.mjs --profile ... --strategy ...，输出完整新稿供审阅；无原稿 diff 标为不适用，不人造个人蓝本。
- 已有稿微调：保留原稿，按批准路径修改副本。重写时可先 build，再 merge-blueprint；合并要求自定义菜单语义兼容，不能猜配。
- 默认不覆盖已有文件；确认替换输出才用 --force，输入始终不能作为输出。默认保存到事实基线同级 output。

检查分别执行：

```text
node "<ROOT>/scripts/validate-resume.mjs" "<新稿.json>" --strict
node "<ROOT>/scripts/audit-facts.mjs" "<新稿.json>" --profile "<事实基线.json>" [--corpus "<个人补充材料.md>"]
node "<ROOT>/scripts/diff-resume.mjs" --base "<原稿.json>" --new "<新稿.json>" --expect "<申请单.json>" [--strategy "<策略.json>"] [--profile "<事实基线.json>"]
```

最后一条仅适用于已有稿；传齐批准记录绑定的文件。数字命中只检查 token 出现，仍人工核对对象、角色、单位、基准和时间；公共规则、样例、pending 和作废内容不得充当本人来源。不要为了通过扫描随意加入整套写作语料。

按优化清单检查表达与事实保真。真实能力不因 AI 协作自动弱化，协作方式按实际责任集中说明；也不把 AI 生成代码的完整责任自动归给用户。

## 4. 排版与交付

交付可读正文、JSON 和简短核验说明；内部批准记录/诊断文件留在个人目录。事实待核或某项未验收须明确，不能把运行成功包装成已通过所有检查。

本地 render-height 仅近似。在线 render-measure3 会把指定文件导入 MagicV，先确认用户允许该外部处理；核对正文锚点、字体与图片后测全部文本矩形。0=ONE_PAGE，1=OVERFLOW，2=UNKNOWN/失败。只有一页 policy 才用该单页结论验收；多页需另验页数，不能自动把 OVERFLOW 当作产品失败。最终核对导出 PDF 页数及文字、图片、栏目完整性。

任何可见文字或布局变化后重新测量，不能因条目数没变继承旧结论。无法连接外部编辑器时，正文/JSON 可明确以未排版验收状态交付，不能声称 PDF 完成。

简历交付后可选 interview-pitch 与 mock-interview。知识/假设情景允许练习，练习答案不自动回填履历。个人任务不自动改公共规则，不替用户提交申请。
