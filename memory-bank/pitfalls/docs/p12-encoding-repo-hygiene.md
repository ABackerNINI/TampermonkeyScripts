# 文件/编码与仓库卫生
> 摘要: UTF-8 无 BOM、`cSpell.words` 白名单、测试样本脱敏三条仓库卫生约定。
> 触发: 新增站点域名, 新增测试样本, 提交 HTML 样本, 排查乱码

- **触发**: 新增站点域名、新增测试 HTML 样本、提交含真实账号/会话信息的页面。
- **判别**: 中文注释乱码、专有名词拼写检查误报、样本含真实账号/会话信息。
- **处置**: 保持 UTF-8（无 BOM），避免中文注释乱码；`.vscode/settings.json` 的 `cSpell.words` 用于站点域名等专有名词拼写检查白名单，新增站点域名时同步补充；新增测试 HTML 样本（如 BTSchoolTorrentsTableSample.html）命名清晰，勿提交含真实账号/会话信息的页面（脱敏后提交）。

## P12. 文件/编码与仓库卫生

- 保持 UTF-8（无 BOM），避免中文注释乱码。
- `.vscode/settings.json` 的 `cSpell.words` 用于站点域名等专有名词拼写检查白名单，新增站点域名时同步补充。
- 新增测试 HTML 样本（如 BTSchoolTorrentsTableSample.html）命名清晰，勿提交含真实账号/会话信息的页面（脱敏后提交）。

