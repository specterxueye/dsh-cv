# magicv.art 简历 JSON 金标准 Schema（v1 · 以真实成品校准确认）

> 来源：线上成品格式校准（已导入 magicv.art 渲染成功、一页验收通过；schema 为通用格式标准，本文示例值均为**虚构占位**，与任何真实用户无关）
> 对照开源版 `JOYCEQL/magic-resume` 的 `src/types/resume.ts` 校验过的**线上版**差异已标注
> 生成器必须 100% 按本文件产出，任何偏离都可能导致渲染失败

---

## 一、顶层结构（完整字段，缺一不可）

```jsonc
{
  "title": "张三-简历-AI应用开发",          // 简历标题（建议：姓名-简历-方向）
  "basic": { ... },                            // 基础信息对象（见二）
  "education": [ ... ],                        // 教育经历数组（见三）
  "skillContent": "<ul>\n<li>...</li>\n</ul>", // 技能优势（HTML，须含 <strong> 关键词）
  "selfEvaluationContent": "<ul>\n<li>...</li>\n</ul>", // 自我评价（HTML，3 条结论+论证）
  "experience": [ ... ],                       // 实习/工作经历数组（见四）
  "campus": [ ... ],                           // ★ 顶层校园经历数组（线上版特有！见五）
  "draggingProjectId": "",
  "projects": [ ... ],                         // 项目经历数组（见六）
  "menuSections": [ ... ],                     // 菜单配置（见七）★ customData 键名与它匹配
  "certificates": [],                          // ★ 线上版成品为 []（证书并入技能优势，勿单独列）
  "customData": { ... },                       // 自定义区块（见八）
  "activeSection": "projects",                 // 当前激活菜单 id
  "globalSettings": { ... },                   // 全局设置（见九）★ autoOnePage 一页开关
  "id": "c8586e8e-7c1e-4454-86bf-6f526853d655", // UUID
  "createdAt": "2026-08-12T00:00:00.000Z",    // ★ ISO 8601（勘误：初版误记 MM/dd/yyyy，系 PowerShell ConvertFrom-Json 日期化显示；5 份成品实测均为 ISO）
  "updatedAt": "2026-08-15T07:33:29.000Z",
  "templateId": "classic"                      // ★ 线上版固定 "classic"
}
```

## 二、basic 对象

```jsonc
{
  "name": "张三",
  "title": "AI 应用开发工程师",                  // 求职标题（按岗位变）
  "employementStatus": "在校",                   // 状态（在校/离职/…）
  "email": "example@example.com",
  "phone": "13800000000",
  "location": "XX省XX市",
  "birthDate": "2000/01",
  "fieldOrder": [                                // 基础信息字段显隐与排序
    {"id":"1","key":"name","label":"姓名","visible":true},
    {"id":"2","key":"title","label":"职位","visible":true},
    // ... 其余字段（email/phone/location/birthDate/employementStatus/customFields…）
  ],
  "icons": {"email":"Mail","phone":"Phone","birthDate":"CalendarRange","employementStatus":"Briefcase","location":"MapPin"},
  "photoConfig": {"width":90,"height":120,"aspectRatio":"1:1","borderRadius":"none","customBorderRadius":0,"visible":true},
  "customFields": [                              // 附加信息（求职意向/政治面貌/毕业院校…）
    {"id":"<uuid>","label":"求职意向","value":"AI应用开发","icon":"Briefcase","visible":true,"displayLabel":false},
    {"id":"<uuid>","label":"政治面貌","value":"中共党员","icon":"User","visible":true,"displayLabel":false}
    // 常用：求职意向、出生年月、政治面貌、籍贯、毕业院校、邮箱
  ],
  "photo": "data:image/jpeg;base64,/9j/...",     // base64 原样透传（照片）
  "githubKey": "",
  "githubUseName": "",
  "githubContributionsVisible": false,
  "layout": "left"                               // ★ 线上版有该字段（left/center/right）
}
```

## 三、education[]

```jsonc
{
  "id": "<uuid>",
  "school": "某大学",
  "major": "计算机科学与技术",
  "degree": "本科",
  "startDate": "2022/09",       // 注意：线上版用 "2022/09 - 2026/06" 合并在 startDate 内
  "endDate": "",
  "visible": true,
  "gpa": "3.8/5.0",
  "description": "<ul>\n<li><p>…</p></li>\n</ul>"  // HTML，可多 li；<strong> 关键词加粗
}
```

## 四、experience[]

```jsonc
{
  "id": "<uuid>",
  "company": "某科技有限公司",
  "position": "前端开发工程师",
  "date": "2024/06 - 2025/06",
  "visible": true,
  "details": "<ul>\n<li><p>…量化成果…</p></li>\n</ul>"  // HTML，每行有结果，避免流水账
}
```

## 五、campus[]（★ 线上版顶层字段，必须与 customData 对应菜单同步）

```jsonc
{
  "id": "campus-media",
  "name": "（在校期间）XX 组织策划",
  "position": "统筹 / 执行（示例职责）",
  "date": "在校期间",
  "visible": true,
  "details": "<ul>\n<li><p>…量化…</p></li>\n</ul>"
}
```

> 实测发现：线上版渲染以 `menuSections` + `customData` 为准；**顶层 campus 字段与 customData[custom-1] 并存**（历史遗留双写）。上次"校园经历不渲染"根因是菜单 id=campus 与数据 key=custom-1 不匹配。**安全策略：生成时 menuSections 用 custom-N 类 id（与 customData key 一致），顶层 campus 数组同步写一份**，避免任何渲染缺失。

## 六、projects[]

```jsonc
{
  "id": "<uuid>",
  "name": "基于 YOLO 的目标检测系统",
  "role": "算法开发（示例课程设计）",      // 角色 + 项目级别标注
  "date": "2025/06",
  "description": "<ul>\n<li><p>…量化指标（mAP@0.5 0.95）…</p></li>\n</ul>",
  "visible": true,
  "link": "",
  "linkLabel": ""
}
```

## 七、menuSections[]（★ 顺序即渲染顺序）

```jsonc
[
  {"id":"basic","title":"基本信息","icon":"👤","enabled":true,"order":0},
  {"id":"education","title":"教育经历","icon":"🎓","enabled":true,"order":1},
  {"id":"experience","title":"实习经历","icon":"💼","enabled":true,"order":2},
  {"id":"projects","title":"项目经历","icon":"🚀","enabled":true,"order":3},
  {"id":"custom-1","title":"校园经历","icon":"🎬","enabled":true,"order":4},
  {"id":"skills","title":"技能优势","icon":"⚡","enabled":true,"order":5},
  {"id":"custom-3","title":"荣誉奖项","icon":"➕","enabled":true,"order":6},
  {"id":"selfEvaluation","title":"自我评价","icon":"📝","enabled":true,"order":7}
]
```

> 规则：**menuSections[].id 必须与 customData 键完全一致**（含 custom-N 编号从 1 开始、菜单启用状态）；title 按岗位场景可调整（如不要荣誉奖项则 enabled:false 且 customData 同步删）。

## 八、customData[]

```jsonc
{
  "custom-1": [                                  // 校园经历
    {
      "id": "<uuid>",
      "title": "（在校期间）XX 组织策划",
      "subtitle": "统筹 / 执行（示例职责）",
      "dateRange": "",
      "description": "<ul>\n<li><p>…精简量化…</p></li>\n</ul>",
      "visible": true
    }
  ],
  "custom-3": [                                  // 荣誉奖项
    {
      "id": "<uuid>",
      "title": "",
      "subtitle": "",
      "dateRange": "",
      "description": "<ul>\n<li><p><strong>XX 竞赛省级二等奖</strong>；优秀共青团员（示例）；优秀学生奖学金（示例×N）…</p></li>\n</ul>",
      "visible": true
    }
  ]
}
```

## 九、globalSettings（★ 一页装下在此）

```jsonc
{
  "baseFontSize": 13,
  "pagePadding": 34,
  "paragraphSpacing": 3,
  "lineHeight": 1.42,
  "sectionSpacing": 10,
  "headerSize": 32,
  "subheaderSize": 16,
  "useIconMode": false,
  "themeColor": "#10b981",
  "centerSubtitle": true,
  "autoOnePage": true,            // ★ 引擎级"一页装下"开关，生成时恒 true
  "flexibleHeaderLayout": true,
  "fontFamily": "\"Alibaba PuHuiTi\", sans-serif"
}
```

---

## 十、HTML 内容规范（所有 description/details/skillContent/selfEvaluationContent）

```
<ul>
<li><p><strong>关键词</strong>：正文…量化数字…（一行一个事实，先总后分）</p></li>
<li><p>…</p></li>
</ul>
```

- 必须 `<ul>` 包裹，每条 `<li><p>…</p></li>`（P 标签包裹，magicv 特定渲染需要）
- 关键词/量化数字用 `<strong>` 加粗
- 换行用实际 `\n`（JSON 字符串内为 `\n` 转义）

## 十一、生成器硬性约束（校验脚本照此检查）

1. JSON 可解析；必填字段齐全（顶层 + basic + globalSettings）
2. `menuSections[].id` ∈ {basic, education, experience, projects, custom-N…, skills, selfEvaluation} 且每项 enabled 的菜单在 customData 有对应 key（或为标准内置菜单）
3. `customData` 每个 key 都有对应 menuSection（不许孤儿键）
4. 所有 HTML 字段非空、符合 `<ul><li><p>` 结构、无裸文本
5. `id` 全为 UUID（可用 crypto.randomUUID()）
6. `templateId: "classic"`、`autoOnePage: true`、`draggingProjectId: ""`
7. `certificates: []`（证书并入技能优势）
8. 顶层 `campus` 同步写（与 customData 校园菜单内容一致）
9. `fieldOrder` 完整覆盖 basic 展示字段
10. 内容真实性：**所有数字可溯源至 profile.json 或素材；无据可查的不写**
