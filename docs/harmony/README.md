# 华为手表开发文档

本分支面向 Android + 华为手表，圆表和方表均在目标范围；当前运行时和已验证设备见兼容性记录。

| 文档 | 用途 |
|---|---|
| [Apple Watch 与华为手表功能对比](WATCH_FEATURE_COMPARISON_ZH.md) | 功能、平台差异、实现与实机验证状态 |
| [心率开关、显示与记录](HEART_RATE_GUIDE_ZH.md) | 两类开关、实时读数、手机历史组心率与当前缺项 |
| [兼容性与多型号适配](COMPATIBILITY_ZH.md) | 目标范围、实际验证设备、圆屏与不同运行时待办 |
| [圆表与方表适配流程](ROUND_SQUARE_ADAPTATION_ZH.md) | 双 Entry HAP、`distroFilter`、API 12、构建签名与验收标准 |
| [经手机联网](WATCH_NETWORK_ZH.md) | GT / FIT 的 `fetch` 蓝牙代理、地区与报文限制、FIT 5 Pro 验证项 |
| [开发与构建](../HARMONY_FIT.md) | 手机桥接、手表源码、身份配置与构建校验 |
| [用户需求](../HARMONY_USER_REQUIREMENTS_ZH.md) | 当前功能与交互要求 |
| [缺陷进度](../HARMONY_OPEN_BUGS_ZH.md) | 缺陷、自动回归与实机验证状态 |
| [交接记录](../HARMONY_HANDOFF_PROMPT_ZH.md) | 当前安装组合、历史排查及下一步 |
| [本轮变更](../HARMONY_IMPROVEMENTS_20261114_ZH.md) | 本轮功能、构建、整理和上游同步证据 |
| [构建脚本索引](../../scripts/harmony/README.md) | 构建、签名、校验与诊断命令 |
| [自签名打包](SELF_SIGNING_ZH.md) | 用自己的注册身份生成、签名和核验 APK 与 Lite HAP |
| [Agent 自签打包](AGENT_PACKAGING_ZH.md) | 可复制的提示词、非交互配置和本机验收 |
| [与上游的差异](FORK_DIFFERENCES_ZH.md) | 对照 1.4.5 的平台、同步、服务和发布差异 |

需求与进度文档保留原固定路径；安装包和设备日志统一放在 Git 忽略的 `harmonywatch/artifacts/`。华为申请材料、离线平台文档和本机签名资料单独保存在本地。

基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym)；本版本为第三方华为手表 / HarmonyOS 适配。
