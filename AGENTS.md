# 项目 Agent 约定

项目结构、构建和代码规范见 [CLAUDE.md](CLAUDE.md)。所有在本仓库工作的 Agent 均须遵守以下署名和许可要求。

## 原作者署名与鸿蒙适配说明

- 原项目为 **openGym**，原作者为 **Duarte Santos（GitHub：DuarteSantos8）**，上游仓库：<https://github.com/DuarteSantos8/openGym>。作者信息依据本仓库 [NOTICE.md](NOTICE.md)。
- 本项目是基于 openGym 的第三方华为 FIT / HarmonyOS 适配。说明成果时，应区分原项目及 Apple Watch 版的贡献与本分支新增的鸿蒙适配、Android 通信桥接贡献。
- 应用的“关于 / 致谢”入口、项目介绍及对外提供安装包的说明应明确标注原作者和上游来源。手表显示空间有限时，可用简短署名，并在配套手机应用或随包文档中提供完整来源。
- 推荐署名：**“基于 Duarte Santos 的 openGym 项目开发；本版本为第三方华为 FIT / HarmonyOS 适配。”** 同时提供上游仓库链接。
- 保留原有版权声明、[LICENSE](LICENSE)、[NOTICE.md](NOTICE.md) 及第三方素材 / SDK 的许可说明；代码沿用仓库声明的 AGPL-3.0-or-later。素材与 SDK 的许可范围分别按对应声明处理。
- 修改名称、图标、包名或界面时，继续保留原作者署名。适配者的署名作为新增贡献单独列出，不替换原作者，也不将本分支描述为原作者或华为官方发布的版本。
- 修改“关于 / 致谢”、项目介绍或打包分发说明后，完成检查时须确认原作者姓名、上游链接和第三方适配说明均保留且可访问。

## 平台支持范围：专注 Android + 华为轻鸿蒙手表（不再支持 iPhone / Apple Watch）

- **项目定位与改动原因**：
  - 本项目是针对华为轻智能手表（HarmonyOS Lite Wearable / HUAWEI WATCH FIT）深度定制的改进版 openGym。
  - 为了适配华为鸿蒙系统及 Wear Engine 通信协议，我们需要在移动端深度扩展专有通信桥接（`HuaweiWatchPlugin`）、实时心率合并、帧动画转码以及离线状态同步逻辑，原版官方并未提供这些功能。
  - 由于维护者没有苹果开发者账号（Apple Developer Account），无法在 iOS/watchOS 上进行签名、调试或发布应用。
  - 因此本分支**不再支持 iPhone 和 Apple Watch**，所有开发与维护重心聚焦于 **Android 客户端 + 华为鸿蒙轻手表端（`harmonywatch/` 与 `frontend/harmony/`）**。
- **后续 Agent 行为约束**：
  - 后续所有在本仓库工作的 Agent 均应将工作重心置于 Android 与华为鸿蒙手表的兼容性、功能完善与构建测试。
  - 不要尝试恢复或调试 iOS / watchOS 构建或发布流程；对于寻求 iPhone / Apple Watch 支持的用户，直接指引其使用原作者上游主仓库：<https://github.com/DuarteSantos8/openGym>。

## Fork 的发布身份、包名与签名

- 已核对上游的 LICENSE、NOTICE、README、手机开发与应用商店发布文档，未发现禁止 fork 使用自己的签名证书、新包名或个人开发者账号发布的条款；README 明确欢迎 fork，NOTICE 包含应用商店分发附加许可。后续 Agent 应据这些具体声明判断，不把原作者的发布配置当作 fork 的强制要求。
- 本分支可使用自己的开发者账号、签名及独立包名，例如 `host.msknet.opengym.fit`；也可使用自己的应用名称，并明确自己的身份是第三方适配维护者，同时遵守前述原作者署名要求。发布者身份、包名及签名的改变不免除 AGPL 义务，也不表示获得原作者或华为的官方背书。
- 上游 [APP_STORES.md](docs/APP_STORES.md) 中官方 APK 与商店版本共用包名、签名的说明，是为支持官方版本间切换及数据保留；不是要求 fork 使用原作者的包名或私钥。
- AGPL 本身不要求专门向原作者交一份代码、提交 PR 或转让修改部分的版权；对应源码须按下节要求向有权获取的接收者或网络交互用户提供。
- 上述结论针对已核对的仓库声明；名称或图标的商标使用、各应用商店规则及第三方素材 / SDK 的许可范围需分别判断。发布前按目标版本的声明复核，不将这里的记录解释为自动获得商标授权或通过商店审核。

依据：[上游 README](https://github.com/DuarteSantos8/openGym/blob/main/README.md)、[上游 NOTICE](https://github.com/DuarteSantos8/openGym/blob/main/NOTICE.md)、[上游发布文档](https://github.com/DuarteSantos8/openGym/blob/main/docs/APP_STORES.md)。

## 训练图片与动画的独立许可

- Gym visual 的训练图片、动画不属于 AGPL。按 [NOTICE.md](NOTICE.md) 及 [素材声明](catalogue/media/NOTICE.md)，非商业 openGym fork 可保留未经修改的 180 px 素材并附带原声明；商业 fork 或其他使用须自行取得相应许可。更高分辨率素材不在这项 fork 保留许可内。
- 更换包名、签名或以个人账号免费上架，本身不能证明属于上述非商业素材许可范围；新增素材用途、转换素材或准备分发时须核对对应授权，不能把代码的 AGPL 授权当成素材授权。

## AGPL-3.0 许可与对应源码

- 本项目沿用上游代码的 **GNU AGPL v3**；仓库包元数据声明为 **AGPL-3.0-or-later**。以 [LICENSE](LICENSE)、[NOTICE.md](NOTICE.md) 和各文件声明为准。署名只是其中一项要求。
- 对外提供修改版源码或 APK/HAP 时，按 AGPL 第 4–6 条保留版权、许可证及无担保声明，显著说明修改及相关日期，并使受该许可覆盖的整体衍生作品继续按 AGPL 授权；不能以“只是适配”或“免费分享”为由省略许可义务。
- 分发 APK/HAP 时，须按第 6 条适用方式向接收者提供该版本的完整对应源码，包括本分支实际修改、新增的受许可覆盖代码，以及必要的构建、安装脚本和说明。仅链接未经修改的上游仓库不能代替本版本源码；不要求为此上架应用商店。
- 如果修改版支持通过网络与用户交互，按第 13 条向所有通过网络与其交互的用户显著提供免费获取该版本对应源码的入口；不以是否收费或是否上架作为判断条件。
- 个人修改、自用且未向他人提供副本或网络交互服务时，不因此要求公开发布到 GitHub 或应用商店。后续使用方式变化时，按实际分发和网络交互情况落实上述要求。
- 第三方素材与 SDK 保留各自许可；上游 [NOTICE.md](NOTICE.md) 中的应用商店附加许可仅处理分发渠道，不免除对应源码等义务。新增依赖或对外分发前，应核对许可是否允许实际组合及分发方式。
- 交付分发版本前，确认许可证、修改说明、对应版本源码获取方式和必要构建说明齐全；不能把本文件中的约定当成已经完成应用界面或分发产物的合规检查。

条文依据：[GNU AGPL v3 正文](https://www.gnu.org/licenses/agpl-3.0.html)；[GNU 关于修改版网络服务的说明](https://www.gnu.org/licenses/gpl-faq.en.html#UnreleasedModsAGPL)。
