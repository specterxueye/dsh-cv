# ============================================================
# install.ps1 — 一键安装 dsh-cv 简历大师（路径无关，开箱即用）
# ============================================================
# 功能：
#   1) 设置用户级环境变量 DSH_CV_ROOT = 本仓库根（新会话生效）
#   2) 建立技能联接：<DSH_HOME>\skills\<技能名> → <根>\preset\skills\<技能名>（遍历全量）
#   3) 调用 sync-preset.ps1 渲染并部署预设注册壳（模板注入根路径）
#   4) 安装自检（环境变量 / 技能联接 / 注册壳，只读）
#   5) 打印摘要 + 「下一步怎么用」
#
# 用法：pwsh -NoProfile -File scripts\install.ps1 [-DryRun]
#      （本文件为无 BOM UTF-8，请用 PowerShell 7 执行）
# 说明：克隆到任意目录均可；本机已有旧安装时重跑即升级（幂等）。

param([switch]$DryRun)

$ErrorActionPreference = 'Stop'

# ---- 仓库根解析 ----
if ($env:DSH_CV_ROOT -and (Test-Path -LiteralPath $env:DSH_CV_ROOT)) {
    $root = (Resolve-Path -LiteralPath $env:DSH_CV_ROOT).Path
} else {
    $root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
}
$skillsSrcRoot = Join-Path $root 'preset\skills'

$dshHome = $env:DSH_HOME
if ([string]::IsNullOrWhiteSpace($dshHome)) { $dshHome = Join-Path $env:USERPROFILE '.dsh' }

Write-Host "== install dsh-cv 简历大师 ==" -ForegroundColor Cyan
Write-Host "   仓库根   : $root"
Write-Host "   DSH_HOME : $dshHome"

if ($DryRun) {
    $preview = (Get-ChildItem -LiteralPath $skillsSrcRoot -Directory | Sort-Object Name | ForEach-Object Name) -join ', '
    Write-Host "   [DryRun] 将执行："
    Write-Host "     1. 环境变量 DSH_CV_ROOT = $root（用户级）"
    Write-Host "     2. 技能联接（遍历 preset\skills\ 全量）：$preview"
    Write-Host "        → $dshHome\skills\<技能名>"
    Write-Host "     3. 渲染预设注册壳 $dshHome\.agent-presets\resume-master"
    Write-Host "   [DryRun] 未做任何更改。" -ForegroundColor Yellow
    exit 0
}

# ---- 1) 环境变量（用户级，新会话生效；注册表不可用时降级为会话级并警告）----
try {
    [Environment]::SetEnvironmentVariable('DSH_CV_ROOT', $root, 'User')
    Write-Host "  [1/3] DSH_CV_ROOT 已设置（用户级）= $root" -ForegroundColor Green
} catch {
    [Environment]::SetEnvironmentVariable('DSH_CV_ROOT', $root, 'Process')
    Write-Warning "  [1/3] 用户级环境变量设置失败（$($_.Exception.Message)）"
    Write-Warning "       已降级为当前会话临时设置；请在完整权限终端执行: setx DSH_CV_ROOT `"$root`""
}

# ---- 2) 技能联接（遍历 preset\skills\* 全量建链；新增技能子目录无需改本脚本）----
$skillsRoot = Join-Path $dshHome 'skills'
New-Item -ItemType Directory -Force -Path $skillsRoot | Out-Null

$skillDirs = @(Get-ChildItem -LiteralPath $skillsSrcRoot -Directory | Sort-Object Name)
if ($skillDirs.Count -eq 0) { Write-Warning "  [2/3] $skillsSrcRoot 下没有技能目录，跳过建链" }

foreach ($skillDir in $skillDirs) {
    $skillLink = Join-Path $skillsRoot $skillDir.Name
    if (Test-Path -LiteralPath $skillLink) {
        $item = Get-Item -LiteralPath $skillLink
        if ($item.LinkType -in @('Junction', 'SymbolicLink') -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            $target = ($item.Target | Select-Object -First 1)
            Write-Host "  [2/3] 技能联接已存在：$($skillDir.Name) → $target ——跳过" -ForegroundColor Green
        } else {
            Write-Warning "  [2/3] 目标已存在但非联接，请手动处理后再跑：$skillLink"
        }
    } else {
        New-Item -ItemType Junction -Path $skillLink -Target $skillDir.FullName | Out-Null
        Write-Host "  [2/3] 技能联接已创建：$($skillDir.Name)" -ForegroundColor Green
    }
}

# ---- 3) 预设注册壳（渲染）----
& (Join-Path $PSScriptRoot 'sync-preset.ps1')
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) { Write-Warning "sync-preset.ps1 返回非零（见上）" }

# ---- 4) 安装自检（只读；回答"我怎么知道装好了"）----
Write-Host ""
Write-Host "== 安装自检 ==" -ForegroundColor Cyan
$checkTotal = 3
$checkOk = 0

# 4.1 环境变量（用户级，新会话靠它定位仓库根）
$envUser = [Environment]::GetEnvironmentVariable('DSH_CV_ROOT', 'User')
if ($envUser -eq $root) {
    Write-Host "  [OK]  DSH_CV_ROOT（用户级）= $envUser" -ForegroundColor Green
    $checkOk++
} else {
    Write-Warning "  [!!]  DSH_CV_ROOT 用户级读回为 '$envUser'（期望 $root）"
    Write-Warning "        本会话可用，但新会话可能定位不到规则库；请重跑本脚本，或执行：setx DSH_CV_ROOT `"$root`""
}

# 4.2 技能联接（每个技能一条，缺任何一条该技能就不会出现在会话里）
$linkedNames = @()
foreach ($skillDir in $skillDirs) {
    $lp = Join-Path $skillsRoot $skillDir.Name
    if (Test-Path -LiteralPath $lp) {
        $li = Get-Item -LiteralPath $lp
        if ($li.LinkType -in @('Junction', 'SymbolicLink') -or ($li.Attributes -band [IO.FileAttributes]::ReparsePoint)) { $linkedNames += $skillDir.Name }
    }
}
if ($linkedNames.Count -eq $skillDirs.Count) {
    Write-Host "  [OK]  技能联接 $($linkedNames.Count)/$($skillDirs.Count) 就位：$($linkedNames -join ', ')" -ForegroundColor Green
    $checkOk++
} else {
    $missing = ($skillDirs | Where-Object { $_.Name -notin $linkedNames } | ForEach-Object Name) -join ', '
    Write-Warning "  [!!]  技能联接仅 $($linkedNames.Count)/$($skillDirs.Count) 就位；缺失：$missing"
}

# 4.3 预设注册壳（可选路径；只用技能不用预设时不影响）
$shellDir     = Join-Path $dshHome '.agent-presets\resume-master'
$shellCordis  = Join-Path $shellDir 'agent.cordis.yml'
$shellPreset  = Join-Path $shellDir 'preset.yml'
if ((Test-Path -LiteralPath $shellCordis) -and (Test-Path -LiteralPath $shellPreset)) {
    $shellText = Get-Content -LiteralPath $shellCordis -Raw -Encoding UTF8
    if ($shellText.Contains((Join-Path $root 'preset\skills'))) {
        Write-Host "  [OK]  预设注册壳就绪且已注入本机根：$shellDir" -ForegroundColor Green
        $checkOk++
    } else {
        Write-Warning "  [!!]  注册壳在，但未注入本机根（customSkillDirs 不指向当前仓库）——重跑 sync-preset.ps1"
    }
} else {
    Write-Warning "  [!!]  预设注册壳缺失：$shellDir"
}

Write-Host "  自检结果：$checkOk/$checkTotal 通过" -ForegroundColor $(if ($checkOk -eq $checkTotal) { 'Green' } else { 'Yellow' })

# ---- 5) 摘要 + 下一步（怎么用）----
Write-Host ""
Write-Host "== 安装完成 ==" -ForegroundColor Green
Write-Host "  环境变量  : DSH_CV_ROOT=$root（新开 DSH 会话生效）"
$skillNames = ($skillDirs | ForEach-Object Name) -join ' / '
Write-Host "  技能      : 所有会话可加载 $skillNames"
Write-Host "  预设      : 新会话可选择「简历大师」"
Write-Host "  升级      : 更新仓库后重跑本脚本即可（幂等；新增技能子目录自动建链）"
Write-Host "  卸载      : 删除技能联接与注册壳；移除环境变量 DSH_CV_ROOT；个人数据在 users\ 请自留"
Write-Host ""
Write-Host "== 下一步：怎么用 ==" -ForegroundColor Cyan
Write-Host "  1. 回到 DSH 会话（环境变量与技能在新会话生效）"
Write-Host "  2. 说「帮我写简历」        → 加载 cv-intake 开始建档（第一次使用必做）"
Write-Host "  3. 贴 JD 文字或图片路径    → 出《JD 理解卡》（硬性/软性/加分/关键词/缺口）"
Write-Host "  4. 说「按这个 JD 选项目」  → 六维打分给出点亮/收起建议，你逐项裁决"
Write-Host "  5. 批准《改动申请单》后才生成 magicv JSON（说「生成/改简历」）"
Write-Host "  6. 打开 https://magicv.art 导入 JSON → 导出 PDF"
Write-Host "  手册：$root\docs\安装与使用.md（安装+首次使用）｜ $root\docs\user-guide.md（完整流程）"
Write-Host "  没有 DSH 也能用生成器/校验器（只需 Node ≥16）：node `"$root\scripts\build-resume.mjs`" --help"
