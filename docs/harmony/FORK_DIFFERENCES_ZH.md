# 与上游 1.4.5 的差异

比较基线为 Duarte Santos 的 openGym `v1.4.5`（`2d70e026e`）。本表覆盖本分支需要维持或复核的差异，供后续合并上游时逐项判断。[上游发布记录](https://github.com/DuarteSantos8/openGym/releases/tag/v1.4.5)

| 模块 | 本分支与上游的差异 | 下次同步时关注 |
| --- | --- | --- |
| 手表平台 | 增加 `frontend/harmony/watch/` 的 Lite Wearable 手表界面、训练与离线存储，以及 `harmonywatch/` 的 DevEco 工程。已验证型号为 FIT 5 Pro。 | 上游手表实现可以作为交互和数据参考。圆屏、其他硬件与 Lite 运行时限制需要单独验证。 |
| Android 桥接 | `HuaweiWatchPlugin` 连接 Wear Engine，处理应用身份、双端 P2P、动作帧和持久化事件队列。 | 合并时核对插件注册、SDK 版本、双端签名指纹与 `DEVICE_MANAGER` 权限。 |
| 训练同步 | Android 使用华为桥接。公共同步代码保留上游稳定组 ID 和事件处理，并接收手表的加组、动作跳转、暂停与恢复等消息。 | `setDone`、`addSet`、休息和结束训练要同时验证新版客户端与已安装 HAP，尤其是断线和重复消息。 |
| 手机设置 | 「设置 → 连接 → 手表」包含华为手表设置；部分中文动作可显示英文原名。 | 本地化和设置页改动一起合并，保留华为入口、语言行为、署名和上游链接。 |
| 自托管服务 | `api/server.js`、接口定义、API/Web 镜像构建和 Compose 与上游 1.4.5 一致。`api/` 的 fork 差异在 Windows 换行兼容的检查脚本和测试。 | Android 华为适配可继续连现有 1.4.5 服务。出现实际 API、数据格式或部署差异时，再决定是否升级 NAS。 |
| 签名与更新 | fork 的更新检查指向自己的 GitHub Release。APK/HAP 使用用户登记的包名和自己的签名，公开 Release 提供源码与校验文件。 | 先确认应用包名、签名和数据升级策略。华为 Profile 按用途和设备办理。 |
| 平台维护 | 保留上游协议及相邻平台源码，当前维护与发布范围为 Android 和华为手表。 | Apple 平台的安装与使用见上游文档。上游新功能进入公共代码时，复查 Android 和华为回归。 |

自主构建见 [Agent 自签打包](AGENT_PACKAGING_ZH.md)。机型验证见[兼容性记录](COMPATIBILITY_ZH.md)。
