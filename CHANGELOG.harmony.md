# 华为手表适配版发布记录

## 未发布

- 新增圆表 HAP：`round` 模块为 466×466 圆屏，`entry` 保留 408×480 方屏；两者共用 HML/JS，圆屏差异来自暂存阶段的 `pages/index/round.css`、空闲列表高度与数字拟合尺寸 `FIT`。两个模块分别声明 `module.distroFilter.screenShape`（`rect` / `circle`），由 AppGallery 按屏幕形态分发。`prepare.mjs --round-project` 与 `build-local.ps1 -Module` 同步支持。

## v1.4.5 (2026-11-21)

openGym for Huawei Watch 1.4.5 首个源码发布。基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym) 开发，是面向 Android 和华为 Lite Wearable 手表的第三方适配。[上游 1.4.5 发布说明](https://github.com/DuarteSantos8/openGym/releases/tag/v1.4.5)

- 同步上游 1.4.5 的 Web 和 API，Android 版本为 `1.4.5`（`versionCode 46`）。华为手表入口位于「设置 → 连接 → 手表」。
- 保留手机计划下发、手表离线记组和回连同步、休息控制以及动作帧传输。支持范围与设备验证状态见[兼容性记录](https://github.com/Starlordzz/openGym-harmonywatch/blob/v1.4.5/docs/harmony/COMPATIBILITY_ZH.md)。
- 发布资产包含对应源码归档和 SHA-256 校验文件。Android APK 和 Lite Wearable HAP 可用自己的应用身份与签名在本机构建，手表调试包安装到 Profile 登记的设备。[自签名打包指南](https://github.com/Starlordzz/openGym-harmonywatch/blob/v1.4.5/docs/harmony/SELF_SIGNING_ZH.md)

代码按 [AGPL-3.0-or-later](https://github.com/Starlordzz/openGym-harmonywatch/blob/v1.4.5/LICENSE) 提供。训练图片、动画和华为 SDK 的许可范围见[项目声明](https://github.com/Starlordzz/openGym-harmonywatch/blob/v1.4.5/NOTICE.md)。
