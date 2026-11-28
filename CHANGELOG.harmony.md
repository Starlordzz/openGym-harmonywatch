# 华为手表适配版发布记录

## 未发布

- 新增圆表 HAP：`round` 模块为 466×466 圆屏，`entry` 保留 408×480 方屏；两者共用 HML/JS，圆屏差异来自暂存阶段的 `pages/index/round.css`、空闲列表高度与数字拟合尺寸 `FIT`。两个模块分别声明 `module.distroFilter.screenShape`（`rect` / `circle`），由 AppGallery 按屏幕形态分发。`prepare.mjs --round-project` 与 `build-local.ps1 -Module` 同步支持。

## v1.4.6 (2026-11-27)

openGym for Huawei Watch 1.4.6 源码发布。基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym) 开发，是面向 Android 和华为 Lite Wearable 手表的第三方适配；当前代码以上游 [1.4.5](https://github.com/DuarteSantos8/openGym/releases/tag/v1.4.5) 为功能基线。

- **双端同步与时钟校正**：手表与手机事件补齐序号 `seq`、双端时钟偏移校正、`acked` 消费与单侧撤销检测；支持后台与时间戳裁决下的休息加减秒、暂停/恢复与动作跳转，单侧加组保留左右独立目标，手表完成页将分项单位统一折算为用户单位，45 分钟无操作结束训练时上报 `idle` 标记。
- **手表存储、运行时与交互**：将 `ready` 计划快照拆分至 `og-ready0`/`og-ready1` 独立双槽文件并在内容未变时跳过重写；停用手表心率采集接口，事件批发送上限提升至 20 条，启动时清理孤立动作帧；`setDots` 窗口上限控制在 18 个，修复编辑态冻结实时数值、确认丢弃弹窗分支、完成角标点击与 `cardio` 动作界面显示。
- **Android 通信桥接与 F-Droid 隔离**：`WatchFrames` 改为 128 px 独立后台抓帧线程并支持取消；新增 `WatchPeerIdentity.selectConnectedIndex` 多设备选择、片段发送超时回收与错误隔离；将华为 Wear Engine 依赖与插件移入 `gms`/`sideload` 渠道，`fdroid`/`offline` 清单与类路径不再包含华为、Google Play services、ML Kit 或 Garmin 组件。
- **构建校验与自签打包**：`prepare.mjs` 新增 `--placeholder` 门禁、暂存前清理非发布文件与探针绑定，`check-lite-config.mjs --bin` 新增编译产物内包名与对端指纹校验。Android 版本升至 `1.4.6`（`versionCode 47`），手表版本升至 `1.4.6`（`code 1004006`）；自签打包见[自签名打包指南](https://github.com/Starlordzz/openGym-harmonywatch/blob/v1.4.6/docs/harmony/SELF_SIGNING_ZH.md)，支持范围与实机待验项见[兼容性记录](https://github.com/Starlordzz/openGym-harmonywatch/blob/v1.4.6/docs/harmony/COMPATIBILITY_ZH.md)。

代码按 [AGPL-3.0-or-later](https://github.com/Starlordzz/openGym-harmonywatch/blob/v1.4.6/LICENSE) 提供，发布资产包含对应源码归档 `openGym-harmonywatch-v1.4.6-source.tar.gz` 和 `SHA256SUMS`。训练图片、动画和华为 SDK 的许可范围见[项目声明](https://github.com/Starlordzz/openGym-harmonywatch/blob/v1.4.6/NOTICE.md)。

## v1.4.5 (2026-11-21)

openGym for Huawei Watch 1.4.5 首个源码发布。基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym) 开发，是面向 Android 和华为 Lite Wearable 手表的第三方适配。[上游 1.4.5 发布说明](https://github.com/DuarteSantos8/openGym/releases/tag/v1.4.5)

- 同步上游 1.4.5 的 Web 和 API，Android 版本为 `1.4.5`（`versionCode 46`）。华为手表入口位于「设置 → 连接 → 手表」。
- 保留手机计划下发、手表离线记组和回连同步、休息控制以及动作帧传输。支持范围与设备验证状态见[兼容性记录](https://github.com/Starlordzz/openGym-harmonywatch/blob/v1.4.5/docs/harmony/COMPATIBILITY_ZH.md)。
- 发布资产包含对应源码归档和 SHA-256 校验文件。Android APK 和 Lite Wearable HAP 可用自己的应用身份与签名在本机构建，手表调试包安装到 Profile 登记的设备。[自签名打包指南](https://github.com/Starlordzz/openGym-harmonywatch/blob/v1.4.5/docs/harmony/SELF_SIGNING_ZH.md)

代码按 [AGPL-3.0-or-later](https://github.com/Starlordzz/openGym-harmonywatch/blob/v1.4.5/LICENSE) 提供。训练图片、动画和华为 SDK 的许可范围见[项目声明](https://github.com/Starlordzz/openGym-harmonywatch/blob/v1.4.5/NOTICE.md)。
