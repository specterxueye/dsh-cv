# ============================================================
# sync-preset.ps1 — 渲染并部署 dsh-cv 预设到 DSH 用户预设目录
# ============================================================
# 机制（v2，路径无关）：
#   preset\agent.cordis.yml 是【模板】——其中的 @DSH_CV_ROOT@ 占位符由本脚本
#   注入为本机仓库根（即"安装时渲染"），生成到注册壳目录：
#       <DSH_HOME>\.agent-presets\resume-master\
#   preset.yml 原样复制；文件不在仓库里写死任何绝对路径。
#
# 根目录解析顺序：$env:DSH_CV_ROOT（install.ps1 设置）> 本脚本所在目录的上级。
# 旧式目录联接注册壳会被自动转换为生成式（删除联接不删除源文件）。
#
# 用法：pwsh -NoProfile -File scripts\sync-preset.ps1
#      （本文件为无 BOM UTF-8，请用 PowerShell 7 执行）
# 验证：重新打开 DSH 会话并在预设选择器里选择"简历大师（Resume Master）"。

$ErrorActionPreference = 'Stop'

# ---- 仓库根解析 ----
if ($env:DSH_CV_ROOT -and (Test-Path -LiteralPath $env:DSH_CV_ROOT)) {
    $root = (Resolve-Path -LiteralPath $env:DSH_CV_ROOT).Path
} else {
    $root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
}
$src = Join-Path $root 'preset'
$tpl = Join-Path $src 'agent.cordis.yml'

$dshHome = $env:DSH_HOME
if ([string]::IsNullOrWhiteSpace($dshHome)) { $dshHome = Join-Path $env:USERPROFILE '.dsh' }
$shellDir = Join-Path $dshHome '.agent-presets'
$shell    = Join-Path $shellDir 'resume-master'

Write-Host "== sync-preset (v2 模板注入) ==" -ForegroundColor Cyan
Write-Host "   仓库根 : $root"
Write-Host "   注册壳 : $shell"

if (-not (Test-Path -LiteralPath $tpl)) { Write-Error "模板不存在: $tpl"; exit 1 }

# ---- 旧式联接注册壳 → 转换 ----
if (Test-Path -LiteralPath $shell) {
    $item = Get-Item -LiteralPath $shell
    if ($item.LinkType -eq 'Junction' -or $item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        Write-Host "检测到旧式目录联接注册壳 → 删除联接（不影响源）并转换为生成式" -ForegroundColor Yellow
        Remove-Item -LiteralPath $shell -Force
    }
}

New-Item -ItemType Directory -Force -Path $shell | Out-Null

# ---- 渲染 agent.cordis.yml（模板 + 路径注入）----
$content = Get-Content -LiteralPath $tpl -Raw -Encoding UTF8
$rendered = $content.Replace('@DSH_CV_ROOT@', $root)
if ($content -eq $rendered) {
    Write-Warning "模板中未发现 @DSH_CV_ROOT@ 占位符（可能已渲染？）——仍将写入注册壳"
}
$outCordis = Join-Path $shell 'agent.cordis.yml'
[IO.File]::WriteAllText($outCordis, $rendered, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "  生成 agent.cordis.yml（已注入根）" -ForegroundColor Green

# ---- preset.yml 原样复制 ----
Copy-Item -LiteralPath (Join-Path $src 'preset.yml') -Destination (Join-Path $shell 'preset.yml') -Force
Write-Host "  复制 preset.yml" -ForegroundColor Green

Write-Host "== 完成：注册壳就绪（改源后重跑本脚本）==" -ForegroundColor Green
