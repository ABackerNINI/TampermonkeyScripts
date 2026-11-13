# 文档与知识库同步
> 摘要: 代码或项目文档变更后必须同步更新 memory-bank 并同次提交, 附同步检查表
> 触发: 改码后, 提交前, 同步知识库

## 6. 文档与知识库同步（本项目特有）

- **铁律见第 0.4 节**：任何代码/项目文档变更后，必须同步更新 `memory-bank/` 知识库，并与代码同次提交。
- 同步检查表：
  1. 脚本头 `@version`（**必须**，见第 1 节铁律）+ `@description`（能力变化时）；
  2. `memory-bank/scripts/<脚本名>.md`：结构/字段/站点表/选择器变化时；
  3. `memory-bank/conventions/` / `memory-bank/pitfalls/_index.md`：产生新的通用约定或坑时；
  4. `memory-bank/tasks/_index.md`：完成/新增待办登记到对应任务文件或 `_index.md`；
  5. 新脚本/新站点：`memory-bank/README.md` 索引登记。
- 新站点/新规则上线前，先在真实页面控制台验证解析与点击日志，再提交。
