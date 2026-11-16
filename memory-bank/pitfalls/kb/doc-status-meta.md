# HTML 制品的 `doc-status` 取值: 不在 5 词表 ⇒ 索引**静默漏收**

> 摘要: `plans/` `reports/` 的 `<meta name="doc-status">` 不在 5 词表(`Open`/`In Progress`/`Done`/`Dropped`/`Superseded`)时, 该件不落任何分区 ⇒ **静默漏收**。修复前 `kb.index` 仍打印「已生成 N 个生成物」、零警告, `kb.check` / `doc.links` 全绿, 只有提交闸门的同源校验才红。已把检查**提前到根因**(生成器 fail-fast + 闸门同源校验, 见处置)。诱因通常是写了「语义上像状态、但不在表里」的词(如 `Draft`)。
> 触发: 新建计划/报告, doc-status, 状态词, 索引漏收, kb.index 已生成但件不在索引, Draft

> 本坑取景自上游 auto-qb 的 2026-10-16 事故档案(其 kb.index 曾生成 plans/reports 分区); 本仓同源单点是 5 词表 `_common.DOC_STATUSES` 与 `gen_doc_map.py --check` 同源校验(挂 `kb.check` 与提交闸门) —— 判别取景按上游叙事读, **处置对本仓完全适用**(待拍板用 `Open`, 不写 `Draft`)。

## 判别

- **触发**: 新建 `plans/*.html` 或 `reports/*.html`, 手写 `<meta name="doc-status">`。
- **判别**: 新计划写了 `doc-status: Draft`(语义上是"待实施", 不在 5 词表), 于是:
  - `kb.index` 报 `[ok] 已生成 N 个生成物`, **但生成的索引分区里没有这一条**(静默漏收);
  - `gen_doc_map --check` 把这个件计入文档数(它读的是 `doc-topic`, 不是 `doc-status`), 认领链也 OK ⇒ 看不出异常;
  - 生成器跳过该件时, 索引 == 生成结果, 自洽 ⇒ 无告警。
  对照: md 档案的 `**Status:**` 是 4 词表(`In Progress`/`Open`/`Done`/`Dropped`), **两张表不同**, 别互相套用。
- **处置**: 计划待拍板/待实施一律用 **`Open`**(实施中 = `In Progress`; report 恒 `Done`); 改完**重跑**
  `commands run kb.index`。已机械守住, 不再依赖人眼:
  - **根因侧**: 索引生成器遇表外值即 fail-fast 报错并列出台外件(`kb.index` / `kb.check` 两条入口都响亮报错) —— 索引从此不再静默漏收。
  - **闸门侧**: `gen_doc_map --check` 加同源词表校验, 提交闸门 `memory-bank/` 轮次即判红并给出逐件清单(纯文档轮也覆盖)。
  - 5 词表单点在 `_common.DOC_STATUSES`(生成器与守卫 import 同源, 不手抄)。
