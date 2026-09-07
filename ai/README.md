# AI 知识库

本目录存放 **TampermonkeyScripts** 项目的知识库文档，供 AI 助手（如 GitHub Copilot）与开发者快速理解项目结构、代码约定和各脚本的职责，从而高效地进行代码修改、调试与扩展。

## 文档索引

| 文档 | 内容 |
|------|------|
| [project-overview.md](./project-overview.md) | 仓库结构、脚本速查、开发与发布工作流 |
| [conventions.md](./conventions.md) | 铁律(计划不改码/等审核/版本号/知识库同步)、提交信息规范、测试与可测性约定、检查清单 |
| [pitfalls.md](./pitfalls.md) | 已知易错点与坑（含现存 Bug 清单） |
| [roadmap.md](./roadmap.md) | 路线图：待修 Bug / 近期功能 / 中期改进 / 远期构想 |
| [scripts/PTAutoCheckIn.md](./scripts/PTAutoCheckIn.md) | PT 多站点自动签到脚本（站点配置驱动框架） |
| [scripts/BTSchoolHelper.md](./scripts/BTSchoolHelper.md) | BTSchool 种子列表高亮 + 快捷键滚动脚本 |
| [scripts/BilibiliEnterFullscreen.md](./scripts/BilibiliEnterFullscreen.md) | B 站 Enter 键全屏切换脚本 |
| [scripts/EnhanceVisitedLinks.md](./scripts/EnhanceVisitedLinks.md) | 全局已访问链接样式增强脚本 |

## 如何阅读

- **首次接触项目**：先读 `project-overview.md`，了解目录结构与脚本概览；再按需阅读对应脚本文档。
- **修改某个脚本**：直接阅读该脚本的文档页 + 源文件（`src/*.user.js`）。
- **动手写代码前**：阅读 `conventions.md`（约定）与 `pitfalls.md`（易错点），避免重踩历史 Bug。
- **排障/查现状**：优先查 `pitfalls.md` 的症状→原因对照表，其次看脚本内 `[ScriptName]` 日志。
- **规划改动**：参考 `roadmap.md` 中已登记的待办与方向。
- **新增脚本**：参考 `conventions.md` 第 7 节检查清单，完成后在 `README.md` 与知识库中补充登记。
- **需要真实页面 HTML**：`src/BTSchoolTorrentsTableSample.html` 是 BTSchool 种子表格的真实 HTML 样本，用于验证解析逻辑。

## 快速提醒

1. **协作纪律：计划不改码**——任务为计划/分析时禁止修改代码；实施类修改完成后**等用户审核、不自动提交**（git commit/push 由用户执行）。详见 `conventions.md` 第 0 节。
2. **铁律：版本号**——`@version YYYY.MM.DD.N`，**修改代码/元数据必须同步递增**并与代码同次提交（纯注释/仅改 `ai/` 文档除外）；详见 `conventions.md` 第 0/1 节。
3. **铁律：知识库同步**——更新代码/项目文档后**必须同步更新 `ai/` 知识库**并同次提交；详见 `conventions.md` 第 0.4 / 6 节。
4. **提交信息规范且详细**——首行概括 + 正文要点分条；一次提交只做一件事。格式见 `conventions.md` 第 1 节。
5. **测试纪律**——可设计易测代码，但**不给测试留后门/通道**、**不为通过测试而修改生产代码**；详见 `conventions.md` 第 8 节。
6. **标点**：注释/日志用中文但统一**英文标点**。
7. **解析易错**：BTSchool 表格用 `tbody > tr:has(> td.rowfollow)` 定位行、`:scope > td` 取列；浮点属性（时魔）不可用整数解析函数。
8. **自测**：改动后在真实站点页面 F12 看 console；详尽的症状/原因/对策见 `pitfalls.md`。
