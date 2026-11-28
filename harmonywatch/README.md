# DevEco 手表工程

此目录保留可构建的 HarmonyOS Lite Wearable FA JS 工程。正式修改入口为 [`frontend/harmony/watch/`](../frontend/harmony/watch/)；运行 `prepare.mjs` 或 `build-test.ps1` 同步模板到 `entry/src/main/js/MainAbility/` 后编译。

`entry/` 为 408×480 方形表 HAP（`distroFilter.screenShape = rect`），`round/` 为 466×466 圆形表 HAP（`circle`）；两者共享同一套 HML/JS，圆表差异只存在于暂存阶段追加的 `round.css`、空闲列表高度与数字拟合尺寸 `FIT` 常量。AppGallery 按屏幕形态分发对应模块。`round/src/main/js` 由 `prepare.mjs --round-project harmonywatch/round` 生成，不入库。

- 构建入口与环境：[脚本索引](../scripts/harmony/README.md)。
- 多型号目标与已验证设备：[兼容性](../docs/harmony/COMPATIBILITY_ZH.md)。
- 当前安装包与待办：[进度](../docs/HARMONY_OPEN_BUGS_ZH.md)。
- 本机安装包、日志和证据：`artifacts/`，Git 忽略。
- 私钥、Profile、身份 JSON、实际 `build-profile.json5` 留在本地；示例配置可提交。

基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym)；本版本为第三方华为手表 / HarmonyOS 适配。原许可、署名和 SDK/素材声明继续保留。
