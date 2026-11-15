# 华为手表开发文档

本分支面向 Android + 华为手表，圆表和方表均在目标范围；当前运行时和已验证设备见兼容性记录。

| 文档 | 用途 |
|---|---|
| [Apple Watch 与华为手表功能对比](WATCH_FEATURE_COMPARISON_ZH.md) | 功能、平台差异、实现与实机验证状态 |
| [心率开关、显示与记录](HEART_RATE_GUIDE_ZH.md) | 两类开关、实时读数、手机历史组心率与当前缺项 |
| [兼容性与多型号适配](COMPATIBILITY_ZH.md) | 目标范围、实际验证设备、圆屏与不同运行时待办 |
| [开发与构建](../HARMONY_FIT.md) | 手机桥接、手表源码、身份配置与构建校验 |
| [用户需求](../HARMONY_USER_REQUIREMENTS_ZH.md) | 当前功能与交互要求 |
| [缺陷进度](../HARMONY_OPEN_BUGS_ZH.md) | 缺陷、自动回归与实机验证状态 |
| [交接记录](../HARMONY_HANDOFF_PROMPT_ZH.md) | 当前安装组合、历史排查及下一步 |
| [本轮变更](../HARMONY_IMPROVEMENTS_20261114_ZH.md) | 本轮功能、构建、整理和上游同步证据 |
| [构建脚本索引](../../scripts/harmony/README.md) | 构建、签名、校验与诊断命令 |

需求与进度文档保留原固定路径；安装包和设备日志统一放在 Git 忽略的 `harmonywatch/artifacts/`。华为申请材料、离线平台文档和本机签名资料单独保存在本地。

基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym)；本版本为第三方华为手表 / HarmonyOS 适配。
