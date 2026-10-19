# Compatibility entry for the former manual preset synchronizer.
param([string]$Profile = 'web', [switch]$DryRun)
$ErrorActionPreference = 'Stop'
Write-Warning 'sync-preset 已改用原生插件安装；不会改写旧注册壳或移除现有联接。'
& (Join-Path $PSScriptRoot 'install.ps1') -Profile $Profile -DryRun:$DryRun
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
