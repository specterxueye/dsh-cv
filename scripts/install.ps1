# ============================================================
# install.ps1 — 一键安装 dsh-cv 简历大师（路径无关，开箱即用）
# ============================================================
# 功能：
#   1) 设置用户级环境变量 DSH_CV_ROOT = 本仓库根（新会话生效）
#   2) 建立技能联接：<DSH_HOME>\skills\resume-writing → <根>\preset\skills\resume-writing
#   3) 调用 sync-preset.ps1 渲染并部署预设注册壳（模板注入根路径）
#   4) 打印安装摘要与验证步骤
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
$skillsSrc = Join-Path $root 'preset\skills\resume-writing'

$dshHome = $env:DSH_HOME
if ([string]::IsNullOrWhiteSpace($dshHome)) { $dshHome = Join-Path $env:USERPROFILE '.dsh' }

Write-Host "== install dsh-cv 简历大师 ==" -ForegroundColor Cyan
Write-Host "   仓库根   : $root"
Write-Host "   DSH_HOME : $dshHome"

if ($DryRun) {
    Write-Host "   [DryRun] 将执行："
    Write-Host "     1. 环境变量 DSH_CV_ROOT = $root（用户级）"
    Write-Host "     2. 技能联接 $dshHome\skills\resume-writing -> $skillsSrc"
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

# ---- 2) 技能联接 ----
$skillLink = Join-Path $dshHome 'skills\resume-writing'
New-Item -ItemType Directory -Force -Path (Split-Path $skillLink) | Out-Null
if (Test-Path -LiteralPath $skillLink) {
    $item = Get-Item -LiteralPath $skillLink
    if ($item.LinkType -eq 'Junction' -or $item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        Write-Host "  [2/3] 技能联接已存在（指向 $((Get-Item $skillLink).Target)）——跳过" -ForegroundColor Green
    } else {
        Write-Warning "  [2/3] 目标已存在但非联接，请手动处理后再跑：$skillLink"
    }
} else {
    New-Item -ItemType Junction -Path $skillLink -Target $skillsSrc | Out-Null
    Write-Host "  [2/3] 技能联接已创建: $skillLink" -ForegroundColor Green
}

# ---- 3) 预设注册壳（渲染）----
& (Join-Path $PSScriptRoot 'sync-preset.ps1')
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) { Write-Warning "sync-preset.ps1 返回非零（见上）" }

# ---- 4) 摘要 ----
Write-Host ""
Write-Host "== 安装完成 ==" -ForegroundColor Green
Write-Host "  环境变量  : DSH_CV_ROOT=$root（新开 DSH 会话生效）"
Write-Host "  技能      : 所有会话可加载 resume-writing（触发词：写简历/分析 JD/magicv JSON）"
Write-Host "  预设      : 新会话可选择「简历大师」"
Write-Host "  升级      : 更新仓库后重跑本脚本即可"
Write-Host "  卸载      : 删除技能联接与注册壳；移除环境变量 DSH_CV_ROOT；个人数据在 users\ 请自留"
