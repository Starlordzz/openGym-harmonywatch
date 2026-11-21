# 华为手表构建与诊断工具

从仓库根目录执行。手表模板为 `frontend/harmony/watch/`，DevEco 工程为 `harmonywatch/`，本机证据和安装包统一输出到 Git 忽略的 `harmonywatch/artifacts/`。

| 分类 | 入口 | 用途 |
|---|---|---|
| Android | `build-android.sh` | 完整构建并暂存授权范围内的素材 |
| Android | `build-android-incremental.sh` | 已暂存素材后的 UI/原生桥接迭代 |
| 手表 | `prepare.mjs --project harmonywatch --round-project harmonywatch/round` | 模板暂存、身份和权限配置；`entry` 为方表、`round` 为 466×466 圆表（`--round-project` 可选），本机 peer.js 保持忽略 |
| 手表 | `build-test.ps1 -DevEcoRoot <目录>` | 无预填计划的普通 release 构建（仅 `entry`）；`-Forensics` 为退出取证变体 |
| 手表 | `build-local.ps1 -DevEcoRoot <目录> [-Module entry\|round\|all]` | 编译、SDK Terser ES5 优化、48 KB 检查、可用环境下的原生启动检查及 BIN/HAP 生成；默认同时产出方表与圆表 HAP |
| 语言 | `build-locales.mjs` | 生成共享压缩译文；12 种语言原文由哈希回归保护 |
| 身份 | `watch-peer-identity.mjs` | 公开证书提取包名与 Base64 EC 公钥身份，校验证书摘要 |
| 签名 | `sign-local.sh` | 从本机 key-info、证书和 Profile 签名并校验 BIN/HAP |
| 校验 | `check-size.mjs`、`check-bundles.mjs`、`check-lite-config.mjs` | 48 KB、资源与权限检查 |
| 校验 | `optimize-lite-bundles.mjs`、`check-lite-equivalence.mjs` | 编译和打包 JS 同步优化，保留 eval 的 ViewModel 返回值，比较语言与休息显示；`check-lite-radio.mjs` 验证编译产物异步 SDK 初始化、接收注册和 hello 发送；`check-lite-heart.mjs` 验证编译产物已移除原生心率和权限入口 |
| 校验 | `verify-lite-bin.py`、`verify-hap.py` | 固定叶证书、Profile、分块摘要及容器检查 |
| 诊断 | `capture-preview.mjs`、`prepare-start-preview.mjs`、`prepare-ui-preview.mjs`、`check-rest-motion.ps1` | 原生预览、合成离线休息/训练/结束场景与圆环弧端检查 |
| 诊断 | `prepare-exit-probe.mjs`、`prepare-link-probe.mjs` | 退出和通信对照构建，结果记录在进度文档 |

Android 脚本需要 JDK 21、Android SDK 与 Gradle 缓存；手表脚本使用 DevEco Studio 自带工具。参数和环境变量见各脚本开头。签名私钥、密码、调试 Profile、设备身份 JSON 均留本地，复制示例配置后填入自己的值。

在 WSL 中检出到 Windows 挂载盘时，`HARMONY_ANDROID_ASSET_CACHE=<目录>` 会把约 244 MB、13,281 个 Web 资源复制到该目录，并以 `-PharmonyAssetsDirectory` 交给 Gradle，避免逐文件扫描挂载盘；资源缓存目录由脚本在每次构建后删除子目录。

华为服务申请材料及其生成工具随本机资料保管。面向源码版的 Android APK 和手表 HAP 构建、签名与校验步骤见[自签名打包指南](../../docs/harmony/SELF_SIGNING_ZH.md)。

基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym)；本版本为第三方华为手表 / HarmonyOS 适配。许可见 [LICENSE](../../LICENSE)、[NOTICE](../../NOTICE.md) 与各素材/SDK 声明。

2026-11-15：当前休息圈恢复系统 progress 秒级更新。`check-rest-motion.ps1` 保留供 11-14 平滑圈试验回溯；`prepare-ui-preview.mjs --scene finish` 可检查全宽“继续训练”按钮。

`prepare-ui-preview.mjs --scene zero-weight` / `decimal-weight` / `bodyweight` 检查零值、小数重量和徒手标签布局；`long-numbers` 检查长数字，`debug` 检查通信诊断页。`exercise` / `rest-offline` / `ended` 用于当前无心率训练、离线休息与结束页。

HA6 已取消华为心率功能，移除旧 heart-error / heart-auth / heart-debug 场景。`check-lite-heart.mjs` 保留原文件名，当前检查编译 app 无原生心率模块、FA 模块、权限请求函数及公开采集入口，并验证启动不触发原生调用。Lite 配置只保留 VIBRATE 权限。HA4 已实机卡死撤回，HA5 恢复正常操作后由当前无心率版本接续。
