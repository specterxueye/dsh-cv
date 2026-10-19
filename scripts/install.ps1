# Native DSH plugin installer. No registry variables or manual junctions.
param([string]$Profile = 'web', [switch]$DryRun)
$ErrorActionPreference = 'Stop'
$packageRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Write-Host "目标 profile: $Profile"
Write-Host "插件源目录: $packageRoot"
Write-Host '使用 DSH 原生 add；用户数据目录不会迁移或删除，也不修改全局环境变量。'
if ($DryRun) {
    Write-Host "[DryRun] dsh plugin --profile $Profile add <上述插件源目录>"
    exit 0
}
$legacyHome = $env:DSH_HOME
if ([string]::IsNullOrWhiteSpace($legacyHome)) { $legacyHome = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.dsh' }
$conflicts = @()
foreach ($skill in @('cv-intake', 'resume-writing', 'interview-pitch', 'mock-interview')) {
    $legacyPath = Join-Path $legacyHome "skills/$skill"
    if (Test-Path -LiteralPath $legacyPath) { $conflicts += $legacyPath }
}
if ($conflicts.Count -gt 0) { throw "存在旧版或其他来源的同名技能，请先按安装文档核验归属并停用，避免串版本；未改动它们：$($conflicts -join ', ')" }
& dsh plugin --profile $Profile add $packageRoot
if ($LASTEXITCODE -ne 0) { throw "DSH 安装失败，退出码 $LASTEXITCODE；请核对版本与 profile。" }
Write-Host '原生安装命令已成功完成；重开该 profile 会话后验证四个技能可被加载。'
Write-Host "卸载：dsh plugin --profile $Profile remove dsh-cv（个人资料保持原位）"
