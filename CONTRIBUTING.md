# 参与维护

这是 DeepSeek Harness 插件，核心 CLI 使用 Node 标准库。优先修复可复现的正确性、安装和使用问题，避免为目前没有的服务端场景增加框架。

使用 Node 22.3+ 或 24.x 和锁文件，运行 `npm ci --ignore-scripts`、`npm test`、`npm run check`、`npm run check:package`。涉及渲染时再运行 `npm run test:browser`；涉及安装、包或资源时运行隔离的 `npm run test:dsh`。浏览器与原生宿主准备方式见 [发布与维护](docs/发布与维护.md)。

每个 PR 说明具体问题、最终行为和实际验证结果。缺陷测试使用失败反例及合法对照，不复制实现来证明自身正确。规则变更须检查四技能和唯一工作流，不把个人经验写成通用招聘结论。

只提交公共代码、规则和合成夹具；严禁真实用户档案、成品、凭据及个案工具。新增发布资源登记到 package.files 的逐文件清单。依赖、权限和外部数据处理变化需明确说明。

使用短期分支和单一 main；按批次提交，经 quality-gate 后合入。版本与发布流程、历史标签和回滚约定见 [发布与维护](docs/发布与维护.md)，漏洞报告见 [SECURITY](SECURITY.md)。
