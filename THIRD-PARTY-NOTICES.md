# 第三方内容与许可说明（THIRD-PARTY NOTICES）

本仓库自身以 [MIT](LICENSE) 发布。以下第三方内容被引用、改造或作为参照，按各自许可注明。

---

## 1. `grilling`（技能机制改造来源）— MIT

- 来源：<https://github.com/mattpocock/skills>（`skills/productivity/grilling`，commit `6eeb81b`）
- 用途：`preset/skills/cv-intake/` 的 **frontier 轮次提问法**（整轮列完 frontier、每题给推荐答案、事实自查、决策问用户）改造自该技能。
- 说明：**不是逐字复制**。本仓库的 `cv-intake` 是针对"个人履历建档"场景的重写，关键差异：上游公理"事实归你查、决策归用户"在建档场景只对部分成立（个人史实只有本人知道），故本文档把问题分流为「只有用户知道的事实 / 机器可自查的事实 / 决策」三类，并加入温和档节奏、`status: pending` 纪律与确认门对接。
- 许可全文（随上游保留，MIT 要求保留版权声明）：

```
MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 2. `JOYCEQL/magic-resume`（数据格式参照）— Apache-2.0

- 来源：<https://github.com/JOYCEQL/magic-resume>（Apache License 2.0）
- 用途：magicv.art 的简历 JSON **数据格式**（`menuSections` / `customData` / `globalSettings.autoOnePage` 等字段结构）参照该开源实现，并按线上成品实测校准（见 `data/rules/04-magicv-schema.md`）。
- 说明：**未复制其源代码**；本仓库的生成器（`scripts/build-resume.mjs`）、校验器（`scripts/validate-resume.mjs`）与全部规则文档均为独立实现，仅沿用公开的数据结构约定。如后续引入其任何代码，须按 Apache-2.0 保留其声明。

---

## 3. 写作规律语料（公开资料提炼）

- `data/rules/`、`data/samples/`、`data/phrases/` 中的规律与句式，**提炼自公开网络资料**（招聘平台文章、HR 视角帖、简历指导材料、行业报告等），每条在文件内标注来源方向。
- 说明：**提炼规律与句式，不复制任何真实个人简历原文**；不包含具体个人的姓名、数字或公司信息（见 `data/rules/01-优化清单.md` 附则）。

---

## 4. 运行期依赖

- `playwright-core`（Apache-2.0）：仅用于**真实渲染验收**（`scripts/render-*.cjs`、`e2e-render.cjs` 等），属可选开发依赖；不装则其余脚本（生成/校验/审计/自检）全部照常工作。
- 浏览器：脚本驱动**本机已安装的 Chrome/Edge/Chromium**，不下载、不打包浏览器。
