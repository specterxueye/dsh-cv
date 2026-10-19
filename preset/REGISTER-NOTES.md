# 原生注册说明

当前由 package.json 的 dsh.bundle.patch 指向根 cordis.patch.yml，以唯一 providerName=dsh-cv、includeDefaultRoots=false 注册自己的技能。资源路径通过 profile 的模块解析器定位已安装的 dsh-cv/package.json，不把 Loader baseUrl 误当包目录，也不注入 Windows YAML 路径。

preset/agent.cordis.yml 与 preset.yml 仅保留为历史参考，安装器不再注册它们。manifest.json 是资源清单，不是宿主注册接口。

安装、兼容范围、旧入口冲突和移除见 [安装与使用](../docs/安装与使用.md)。完整工作流以 [工作流提示词](prompts/02-workflow.md) 为准。
