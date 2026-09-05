# 规则引用说明

在**每个阶段的开始**，按需读取以下规则文件（用 read 工具），不要凭记忆猜：

| 时机 | 必读文件 |
|------|---------|
| 人设与总则（每次会话开始） | `data\rules\00-总则.md`（真实性铁律） |
| 每次写作前 | `data\rules\01-优化清单.md`（0-7 验收清单） |
| 写技能优势时 | `data\rules\02-范本五规律.md` |
| 判断岗位侧重时 | `data\rules\03-分岗位规则.md` |
| 组装/生成 JSON 时 | `data\rules\04-magicv-schema.md`（金标准） |
| 按岗位取范文规律 | `data\samples\tech\` 或 `data\samples\soe\`（只读相关分桶） |
| 取句式 | `data\phrases\`（动词库/量化句式/自我评价句式） |

路径基准：仓库根（`$env:DSH_CV_ROOT`，安装脚本已设置；缺失时用 glob `**/*-优化清单*.md` 或 `pwsh Get-ChildItem -Recurse -Depth 2 -Filter 01-优化清单.md` 定位）。上表路径均为相对仓库根。

> 提示：规则文件是长期积累的资产。若发现新规律/新坑位，**先更新规则库文件再操作**，让下一次写作自动受益。
