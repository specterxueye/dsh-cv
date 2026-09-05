# ============================================================
# sync-preset.ps1 — 把 dsh-cv\preset 注册为 DSH 用户预设（单源同步）
# ============================================================
# DSH 预设发现机制（dsh-agent-presets）：preset = 一个目录，目录名即 preset id
# （必须符合 [a-z0-9][a-z0-9-]*），内含 agent.cordis.yml（装配）+ 可选 preset.yml
# （展示文本）。扫描根：配置的 roots + 默认追加 <dshHome>\.agent-presets（user 根，
# includeUserRoot 默认 true）。发现不做缓存，进程运行期间新增立即可见。
#
# 本脚本策略（与 REGISTER-NOTES 一致，注册壳从"3 个文件"升级为"1 个目录联接"，
# 单源优势更强）：
#   1) 首选：%USERPROFILE%\.dsh\.agent-presets\resume-master → 目录联接（junction）
#      指向 D:\DeepSeek harness\项目\dsh-cv\preset —— 磁盘上只有一份内容。
#   2) 兜底：junction 创建失败（权限/文件系统限制）时，复制 agent.cordis.yml +
#      preset.yml 到注册壳，并打印警告（此后改动需重跑本脚本）。
#
# 用法：pwsh -NoProfile -File scripts\sync-preset.ps1
#      （本文件为无 BOM UTF-8，请用 PowerShell 7 执行；Windows PowerShell 5.1 会按 ANSI 误读中文）
# 验证：重新打开 DSH 会话并在预设选择器里选择"简历大师（Resume Master）"。

$ErrorActionPreference = 'Stop'

$src  = 'D:\DeepSeek harness\项目\dsh-cv\preset'
$dshHome = $env:DSH_HOME
if ([string]::IsNullOrWhiteSpace($dshHome)) { $dshHome = Join-Path $env:USERPROFILE '.dsh' }
$shellDir = Join-Path $dshHome '.agent-presets'
$shell    = Join-Path $shellDir 'resume-master'

Write-Host "== sync-preset: 注册壳 = $shell" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $src)) {
    Write-Error "源目录不存在: $src"
    exit 1
}

New-Item -ItemType Directory -Force -Path $shellDir | Out-Null

if (Test-Path -LiteralPath $shell) {
    $item = Get-Item -LiteralPath $shell
    if ($item.LinkType -eq 'Junction' -or $item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        Write-Host "注册壳已是目录联接，指向: $($item.Target)" -ForegroundColor Green
        Get-ChildItem -LiteralPath $shell -File | ForEach-Object { Write-Host "  - $($_.Name) ($($_.Length) bytes)" }
        Write-Host "== 同步完成（单源联通，无需复制）" -ForegroundColor Green
        exit 0
    }
    Write-Warning "注册壳已存在且不是联接：$shell"
    Write-Warning "如需改为单源联接，请先手动删除该目录（不影响 dsh-cv\preset 源）后重跑。"
    exit 1
}

# ---- 首选：目录联接 ----
try {
    New-Item -ItemType Junction -Path $shell -Target $src | Out-Null
    Write-Host "已创建目录联接: $shell -> $src" -ForegroundColor Green
    Get-ChildItem -LiteralPath $shell -File | ForEach-Object { Write-Host "  - $($_.Name) ($($_.Length) bytes)" }
    Write-Host "== 同步完成" -ForegroundColor Green
    exit 0
} catch {
    Write-Warning "创建目录联接失败（$($_.Exception.Message)）→ 回退为复制模式"
}

# ---- 兜底：复制模式 ----
$files = @('agent.cordis.yml', 'preset.yml')
New-Item -ItemType Directory -Force -Path $shell | Out-Null
foreach ($f in $files) {
    Copy-Item -LiteralPath (Join-Path $src $f) -Destination (Join-Path $shell $f) -Force
    Write-Host "  复制 $f"
}
Write-Warning "注册壳为复制模式：改源后必须重跑本脚本（否则注册壳过期）。"
Write-Warning "建议排查 junction 失败原因（见上）后复位为单源联接。"
