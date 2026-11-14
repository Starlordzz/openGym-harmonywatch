# 缺陷修复与验证进度

更新：2026-11-14。基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym) 开发；本版本为第三方华为 FIT / HarmonyOS 适配，沿用 AGPL-3.0-or-later。

## 2026-11-14 最新进度：启动恢复，通信回归修正待实机验证（B14）

用户确认 `boot-return` 包正常打开、原有 Full Body 计划可显示；调试页为 `sdk:? rx:off tx:-`，后面没有错误文字。B13 启动黑屏已通过本轮实机复测；当前阻塞是 B14 通信初始化回归。

已定位到构建后的实际代码：SDK 原始版本查询传入有效 `complete` 回调，二次 Terser 压缩后变成 `complete:function(){}`。回调无法写入客户端版本，SDK 就绪等待超时，接收器未注册，手机发送返回 206。旧 training-fix 包保留有效回调。逐项关闭优化验证后，`reduce_vars=false` 保留回调；SDK 源文件保持原始字节。

构建流程已关闭 `reduce_vars`，新增实际编译 app.js 的异步通信门禁：延迟返回版本 402，再验证接收器注册与 hello 发送 207。旧故障产物在同一门禁得到 `sdk:? rx:off tx:-` 并超时；修正后压缩前、后均为 `sdk:402 rx:ok tx:207`。手表 133 项通过，原生启动 2 帧、3197 可见像素、无 JS 异常。app 47,743 B、页面 49,097 B；每份上限 49,152 B，页面余量 55 B。

修正包 `/sdcard/haps/openGym-HuaweiWatch-sdk-callback-signed.hap` 已签名校验并通过 ADB 推送，手机端文件哈希一致；大小 685,186 B，SHA-256 `591b5dd463742ce7279711b7735ce65bc4c62635ce333e591470dece99f2a90e`。HAP 内 BIN 与独立签名 BIN 一致，BIN 包含本次编译 JS。等待用户覆盖安装后确认 sdk/rx/tx 和手机 206 是否恢复。

手机继续使用已安装的合并版 APK。本轮已核验实际 APK 签名、已授权权限、保存的 112 字符 Lite 对端身份与手表配置一致；手机接收器已注册，收到 0 条、发送 206。证据：`harmonywatch/artifacts/BUILD_20261114_SDK_CALLBACK.json`、同名 `.log`、`TEST_20261114_SDK_CALLBACK_WATCH.log`、`SIGN_20261114_SDK_CALLBACK.log`、`PHONE_STATUS_20261114_BOOT_RETURN_206.json`。签名、身份配置和设备日志保留本地。

接续顺序：先验证新包通信；恢复后复测手机开始训练时手表自动进入与震动、双向 ±15 秒和暂停/继续，再继续 B3/B5/B6/B7/B8 的训练稳定性与计时测试。

## 2026-11-14 启动黑屏排查记录（B13，后续实机已确认打开）

用户覆盖安装 `openGymFIT-merged-signed.hap` 后，打开应用立即黑屏，并回报 206。已覆盖恢复到 `openGymFIT-training-recovery-signed.hap`（与此前 training-fix 字节相同），用户确认可以打开；此后用户安装 boot-return 包并确认正常打开，详见最新进度。

原生 Lite 预览器已复现 `TypeError: wrong type of argument`。已定位：Terser 的默认语句压缩丢弃了顶层 IIFE 的完成值，压缩后 app/page 的求值结果由 ViewModel 对象变成 boolean；旧等价检查仅比较构造参数，漏掉加载器实际消费的返回值。

修正为 `compress.expression=true`，并要求 bundle 求值结果等于刚创建的 ViewModel；新增回归已先失败、修正后通过。发布构建在预览器及配置可用时执行原生启动检查，失败即停止打包。官方选项说明见 [Terser expression](https://terser.org/docs/options/)。

修正版手表 131 项通过；原生启动 2 帧、可见像素 3197、无 JS 异常。app 47,574 B、页面 49,045 B，均低于 49,152 B。手机 APK 继续使用已安装的合并版；修正版 `openGym-HuaweiWatch-boot-return-signed.hap` 已签名推送到 `/sdcard/haps/`，设备文件 SHA-256 与本机一致：`3b644308467bdc78dbcae23a8d00ba13319715d98b9038942423c6e4b19e3a8b`。实机随后确认正常打开，通信仍为 206；当前修正见 B14。证据：`harmonywatch/artifacts/BUILD_20261114_BOOT_RETURN.json`、`BOOT_RETURN_NATIVE_PREVIEW.log`、`TEST_20261114_BOOT_RETURN_WATCH.log`。

## 合并版手机与此前交付（历史状态）

合并版手机 APK 已安装（versionCode 31，versionName 1.4.4），桥接配对、应用应答、接收器注册均正常，发送 207。手表包 `/sdcard/haps/openGymFIT-merged-signed.hap` 已推送，设备 SHA-256 为 `972ce55f2aa2d062f6a67e1b1627d5d0a21063f59da781cfa607c482d859b6fb`，与本机一致；待手表覆盖安装后验收新增功能。

代码、上游合并、README 与仓库描述已推送 GitHub。合并后验证：手机 7862、服务端 804、手表 130、MCP 138 项通过。下一步是新任务唤起与一次震动、双向休息控制、列表滚动提示、心率开关状态，以及训练中偶发退表盘和计时差异的实机回归。

## 当前状态

| 编号 | 现象 | 影响 | 状态 |
|---|---|---|---|
| B1 | 按冠后整表卡死，随后黑屏、与手机断连，恢复类似软重启 | 整表与连接中断 | 已修复；用户确认恢复表冠与通信的普通包退出正常 |
| B2 | 原通信 206、计划存储失败及旧 PPL 优先 | 计划同步 | 已修复；用户确认 Full Body 正确，按冠退出重开后仍在 |
| B13 | 合并版打开立即黑屏 | 应用无法进入 | boot-return 已由用户确认正常打开、计划可显示 |
| B14 | 启动恢复后手机 206，手表 sdk:? rx:off tx:- | 双向通信未启动 | 已修正压缩丢失 SDK 版本回调；新包已推送，待实机验收 |
| R1 | 手表页面 JS 接近 48 KB 上限 | 新增功能受构建体积限制 | 当前页面余 55 B；app 余 1,409 B |
| R2 | 手机转发休息结束系统通知 | 用户取消 | 通知入口、后台发送与手表 relay 已移除；保留本地前台震动 |
| R3 | 训练记录回传、动画、断连补传待真机验证 | 后续端到端验收 | 当前已验证计划下发、显示及退出重开恢复 |

## 2026-11-14 新一轮训练中缺陷（排查中）

用户在 Full Body 同步与重开恢复通过后报告：

| 编号 | 实际现象 | 当前状态 |
|---|---|---|
| B3 | 休息结束后不震动 | 查到手机 restHaptics=false，已改为 true；到期竞态修复已部署，待下一次自然到期复测 |
| B4 | 动作演示图太小 | 已交付 96×96；第二版 128×128 已构建，待安装 |
| B5 | 偶发首次点击添加重量无效，随后退到表盘 | 待定位 |
| B6 | 手表上的动作演示图有时消失 | 待定位 |
| B8 | 手机休息倒计时比手表快约 1–2 秒 | 已修正共享截止时间与 ceil 取整，待真机复测 |
| B9 | 休息结束后在手表切到下一动作，手机没有跟随 | 用户确认两端动作一致，真机通过 |
| B7 | 点击完成后会卡住，可能黑屏退到表盘；稍后仍可进入应用，显示休息阶段。休息自然结束仍停在上一个已完成动作，且不震动；再次完成可能再黑屏。休息时手动跳过能正常进入下一个动作，再完成仍卡住一段时间才进入休息 | 优先排查完成记录持久化、同步与状态推进的调用顺序 |

用户同轮明确取消“休息结束系统通知”：移除手机转发/后台 Wear Engine NOTIFY 链路，保留手表应用内倒计时、前台震动与常亮。代码移除已完成，升级会取消旧排程；新 APK 已安装、新 HAP 已签名推送。B3 的本地震动属于保留范围。

### 本轮修正与验证状态

- 动画显示由 32×32 扩大至 96×96；新一组帧未收齐时继续显示上一组完整动画，提交新路径后再清旧帧。
- 每帧完整存档改为动画接收完整后保存一次；慢存储期间合并等待中的保存，保留全部未确认事件，持久化完成后再发出确认/事件。
- 手机只保留一份进行中的快照请求，后续状态合并后发送；普通状态探测刷新不再触发整组动画重传。
- 旧快照保留时间戳较新的完成组，并忽略已在手表关闭的旧休息截止时间。
- 加重量/完成/滑动增加空状态保护；编辑缓存被刷新清空时可以重新初始化。
- 手机按手表完成时刻对齐休息截止时间，两端倒计时使用 ceil，已到期快照保留 deadline 供手表本地提示。
- 新增 navigate 事件，手表跳过/结束休息和切换动作后通知手机更新位置；前台首个长震立即发出。

自动回归通过：手表 122 项，手机/同步/训练/计时相关 100 项。修复版已完成构建和校验，APK 已 ADB 安装、HAP 已推送手机。用户已补充：偶发退表盘、震动偏弱、图片希望更大、列表只露出两项；两端动作一致。随后直接读到手机 `restHaptics=false`，已保留其他设置并将该项改为 true（`PHONE_SET_REST_HAPTICS_20261114.json`）；旧通知配置 `retired=true`。B3–B9 的实际训练卡顿、马达反馈、图像显示和跨端状态继续验证。

## 2026-11-14 第二轮反馈与接续（当前开发中）

用户已安装训练修复 HAP：两端动作切换一致（B9 真机通过）；96×96 图片有所改善，期望再扩大。偶发退表盘仍在，休息震动仍偏弱。关闭“显示动作动画”后用户反馈“暂时没发现退出，还需要进一步验证”，动画与退出的因果关系待验证。

| 编号 | 新反馈 / 需求 | 当前进度 |
|---|---|---|
| B3 | 休息结束震动不明显 | 候选代码增加为两轮各 4 次 long；实际马达效果待真机验证。Lite 接口仅提供 long/short |
| B4 / B6 | 图片还想更大，持续显示待验证 | 候选代码 128×128；动画刷新间隔 125→250 ms 降低更新频率；退出仍需开/关动画对照 |
| B10 | 手表 +15 秒未同步手机；手机 +15 秒延迟；手表缺 −15 秒及暂停 | 候选代码增加双向绝对休息状态、−15 秒、暂停/继续；手机优先小消息通道，保留当前发送队首；新增顺序号避免旧快照恢复旧休息 |
| B11 | 手机开始后手表自动进入训练界面，并震动表示收到 | 候选代码在新手机训练调用一次 ping 唤起；等待 hello 后发快照；手表新任务落盘后一次 long，重复快照/页面重显不重复提示 |
| B12 | 计划只看到两个；底部“心率”含义不清 | 列表容器高度 96 px、每行 48 px，休息日仍只露出两行；候选代码休息日列表 240 px，心率按钮标注开/关 |

第二版 `training-v2` 手表已构建、签名；手机也已构建验签。自动测试手表 130、手机 166、原生队列 2 项通过；app 47,277 B、页面 49,017 B。ADB 当前未连接，用户回复稍后连接；当前真机安装包仍是 training-fix，第二版实机验收待进行。构建记录为 `harmonywatch/artifacts/BUILD_20261114_TRAINING_V2.json`。12 种原有语言文案的解压哈希逐一保持一致，新控制文案复用手机现有翻译。

## B1 表冠退出后整表卡死和断连

用户最新描述：按表冠后应用画面先卡住，继而整表无响应、黑屏，与手机的连接也会断开，恢复过程类似软重启。此前报告的持续时间约 20 s；设备是否发生系统重启及故障日志待核实。KSO 常亮默认模式与 KSO-OFF 模式均复现。

2026-11-13 用户确认：trace5 上仍会黑屏。去掉 15 s 定时器中的周期性 ping 后，退出故障仍存在。

旧取证记录：

- 页面退出步骤 `k c r d x p` 两轮分别为 24/24/29/23/22/39 ms 与 23/23/28/23/23/33 ms，`h` 标记带 `J184`、`J69`。
- app 流水在 `321101:F1` 后停止，无 `F2`、`T1/T2`、`NP10/NP25`。
- trace5：`harmonywatch/artifacts/openGymFIT-trace5-signed.hap`，676,994 B，SHA-256 `75f8924c7a90935e5cb66b54b2908a196139d27fdf16c9e7c5aabc5f979104ce`。

旧流水来源为新增调试代码，用户已质疑其可靠性；原始设备日志和阻塞位置尚未核实。

本轮代码与构建：

- 移除启动阶段剩余的两条 `pingPeer()` 调用和未被业务读取的安装探测结果。在线状态继续取自实际消息与发送结果。
- 交付普通构建，关闭逐步取证写盘；保留空闲页长按 2 s 查看简要状态和 show/hide 时间线的入口。
- SDK 集成回归验证注册与 hello 发送过程中原生 `detect` 调用为零。页面隐藏、销毁、计时器、心率与表冠清理已有自动测试覆盖。

另已生成 `openGymFIT-exit-offline-signed.hap`：与普通包共用应用身份及存档格式，关闭 Wear Engine 初始化与通信。已核对其执行 BIN 无 `@system.wearengine` 导入和版本探测调用；用于空闲页按冠退出的对照测试。用户确认该离线对照包仍发生整表卡死、黑屏与手机断连。Wear Engine 关闭后故障仍可复现。

下一轮对照包 `openGymFIT-exit-no-crown-signed.hap`：沿用离线构建，只去掉表冠旋转监听的注册和清理；其余页面、计时器与常亮逻辑相同。已核对执行 BIN 无 `setMonitorForCrownEvents`、`clearMonitorForCrownEvents` 和 Wear Engine 符号。构建入口为 `scripts/harmony/prepare-exit-probe.mjs`；用户确认仍发生整表卡死、黑屏和手机断连。

第三轮为 `openGymFIT-exit-minimal-signed.hap`：同一包名和签名，只含一页静态文字；无应用导入、生命周期处理、计时器、存储和原生接口调用。编译 app.js 626 B、页面 JS 1,355 B；用户确认退出正常。

第四轮 `openGymFIT-exit-static-page-signed.hap`：保留原离线 app.js、初始化、存储和销毁，页面替换为同一静态文字页。app.js 37,786 B、页面 JS 1,355 B；用户确认退出正常。

第五轮 `openGymFIT-exit-once-signed.hap`：沿用完整页面、离线且关闭表冠监听的对照条件，新增 `onHide` 重复调用保护。回归测试已复现并修复 `onHide → onDestroy → onHide` 重复清理；用户确认退出正常。已逐字节核对：与失败的无表冠监听对照包相比，app.js 完全相同，编译页面仅增加 24 B 的 `if (!this.visible) return` 守卫。普通包已包含修复，并恢复表冠与 Wear Engine；用户确认普通包退出正常。该真机通过版本归档为 `openGymFIT-exit-full-verified-signed.hap`。

平台退出顺序为 `onHide → onDestroy`，页面原有的 `onDestroy` 再次调用 `onHide`，形成重复清理。新增可见性守卫使清理只执行一次。依据：[华为 Lite 页面生命周期](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-lite-framework-lifecycle/)。

页面重复清理已通过回归测试与真机对照验证。恢复表冠与 Wear Engine 的普通包已真机退出正常。

## B2 手机到手表计划同步（已修复）

2026-11-13 用户给出的手机状态为：**“手表已连接 手表应用未应答 身份已配置”**。手表安装 trace5，空闲页显示“尚未同步”；手机同步开关已开启。

当前状态含义：手机发现了已连接设备，并保存了应用身份；当前桥接实例尚未记录到手表的 `hello`。发送、传输、身份校验和接收处理环节仍需用新包读数定位。`installed` 也会在重新发现设备或传输失败后清零。

已复现的代码缺口与修复：

1. 手表先打开、手机接收器后就绪时，旧协议仅等待手表再次主动发送 hello。本轮在手机接收器注册完成后发送 `helloRequest`；手表收到后重发 hello。尚未应答时，手机状态检查按至少 15 s 的间隔重试请求。
2. 旧手机 `status()` 在已连接、未应答时反复注销和注册接收器。本轮保留已注册接收器，等待应答；需要更换接收器时，先等待注销成功，再注册。
3. 手机设置页订阅 `watchState`，应答状态实时更新；退出页面后清理订阅，包括迟到的订阅注册结果。
4. 设置页增加接收器状态、累计接收消息数、最近发送返回码和通信错误。诊断读数可通过“刷新状态”重新读取。

官方 SDK 集成测试已覆盖：首次 hello 发送失败 → 手机请求应答 → 手表重发 hello → 训练计划快照落盘 → 回传 `snapshotAck`。手机设置页、现有训练同步与 Huawei 重试测试通过。首轮普通包真机复测：用户确认退出正常；点击手机“授权并连接”后返回 `Wear Engine send failed: 206`，手机仍显示手表已连接、应用未应答、身份已配置。

已通过 ADB 核验：实际手机安装包签名为登记的 F67F…E1AE，手机保存的手表身份为 `host.msknet.opengym.fit`、E829…6691，与签名 HAP 一致。

后续补齐：

- `prepare.mjs` 在 `module.metaData.customizeData` 中生成名为 `supportLists` 的条目，值为真实手机包名与证书指纹，长度 90 字符；保留运行时身份设置。源码、BIN 和运行时 peer.js 的身份值已核对。官方 FAQ 将 config.json 中的手机身份配置列为 206 排查项，见[华为 FAQ](https://developer.huawei.com/consumer/cn/doc/connectivity-guides/faq-0000001050818031/)。
- 手表调试页新增 `sdk:版本 rx:ok/wait/off tx:结果` 与最近错误。用户回报 `sdk:402 rx:ok tx:206`，最近错误为“连接中断，已保存的记录稍后重试”：手表 SDK 就绪、接收器注册完成，发送仍失败。
- 已更新并签名普通 HAP，再次推送至手机 `/sdcard/haps/openGymFIT-link-fix-signed.hap`；手机 APK 沿用已安装版本。

运行条件核验：手机华为运动健康 17.0.10.300 正在运行，允许后台运行；HMS Core 6.16.4.362 已安装。Wear Engine 官方接入文档接受裸 APP ID，P2P 收发属于 DEVICE_MANAGER，未查到要求手机和手表属于同一 AGC 项目的条款。

下一轮前台通信自检：`openGymFIT-link-probe-signed.hap` 使用相同包名、证书、静态信任声明与消息格式，将客户端创建、注册和 hello 发送放在页面前台 `onShow` 之后，验证页面前台中的基础收发。该诊断包的训练数据由恢复后的普通包处理。

诊断读数：

- 接收器未就绪：检查注册错误、配对与授权。
- 接收器已就绪、接收 0 条：双向通道和双方包名/签名身份待核对；同时记录最近发送结果。
- 已收到消息但应用未应答：检查消息格式、分包完整性与 hello 解析。
- 应用已应答但计划未更新：检查手机快照发送、手表落盘与确认链路。
- 返回码 207 为 SDK 通信发送成功，206 为发送失败；训练计划的业务确认通过 `snapshotAck` 完成。依据：[华为 Lite 点对点消息 API](https://developer.huawei.com/consumer/en/doc/connectivity-References/point-to-point-message-0000001052164296/)。

2026-11-13 后续结果：

- 前台通信自检包：用户回报 `402 / rx:ok / tx:206 / 收到 0`，前台初始化未恢复通信。该包当时未带常亮；用户要求保留前台常亮，普通包常亮已确认正常。
- 手机 Wear Engine SDK 由 5.0.2.306 升到 5.0.3.304 后，结果仍为 206、接收 0 条。上一版 APK 留存为 `openGym-HuaweiFit-link-sdk306-debug.apk`。
- 手机端增加 `checkPermission(DEVICE_MANAGER)` 核验与手表应用探测。ADB 读数：`managerGranted: true`、`lastPingCode: 202`（应用运行中）、`watchVersion: 1000000`、`p2pCapability: 2`、`receiverRegistered: true`、`receivedPackets: 0`、`lastSendCode: 206`。
- 用户此前看到的“已注册通信”对应接收器注册成功；主动握手加入后，发送失败才显示为 206。

### 2026-11-14：手机侧公钥指纹修正

用户更新交接文档后，已复核身份格式错误：HarmonyOS 5.0+ Lite Wearable 对端指纹应为 `应用包名_Base64(公钥)`；修正前手机保存了叶证书 SHA-256，原生 `configure()` 也只接受 64 位十六进制。官方依据：[如何获取应用指纹](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/wearengine_faq-9)、[手机侧 P2P 指南](https://developer.huawei.com/consumer/cn/doc/connectivity-guides/phone-send-message-0000001051059209)。

已从本地公开叶证书复算公钥，与用户文档提供的值一致，共 112 字符：

```text
host.msknet.opengym.fit_BJc8JAa9rJKfqzas/d1BzWZrBv8+ECYLetB9fK0Zo1azvpUTL6izrUJNzYsYQI0ozMEMOOpYF9GmMB/ppUEBC4c=
```

本轮修正：两条 Android 构建脚本统一从证书生成新默认值；原生校验接受大小写敏感的公钥身份；原生启动时精确迁移本应用的旧 SHA-256 设置；手机输入框同步改为新格式。手表侧的手机身份仍使用 Android APK 证书 SHA-256。

用户在交接文档中补充：原始短文本包仍为 206。修正 APK `openGym-HuaweiFit-peer-key-debug.apk` 已构建、校验签名并通过 ADB 安装。手机旧 SHA-256 设置自动迁移为 112 字符公钥身份，原授权保留。安装后首次读数为接收 1 条、探测 201、发送 206；后续复读已为发送 **207**、收到 **13 条**、探测 202、通信错误为空。基础双向收发恢复；`installed=false`，用户回报可收到消息但没有训练计划；用户确认手表运行普通训练页；重新注册后手机 `installed=true`、发送 207、接收 1 条（新进程计数）、无解析错误；hello 已通过。手表普通包回报 `402 / ok / 207` 和“存储失败，记录尚未同步”，计划卡在手表持久化。接手顺序与安装状态见 [最新交接进度](HARMONY_HANDOFF_PROMPT_ZH.md)。

### 2026-11-14：快照持久化修正

官方 [`@system.storage`](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-system-storage/) 限制单值小于 128 字节。旧实现整份 JSON 写一个 KV，计划状态会超过限制。已加入 `common/state-storage.js`：状态写入双文件，KV 只保存短索引；分块大小最多 4096 B，全部写入成功后提交索引，旧文件在失败时保留。旧 JSON 可读并在成功保存时迁移；快照确认仍等待持久化完成。

手表 119 项回归通过，包括大中文/emoji 状态、断写/提交失败保护、重启读取、截断报错及 controller 的持久化确认顺序。新 HAP `openGymFIT-state-file-signed.hap` 已构建、验签并推送至手机 `/sdcard/haps/`，SHA-256 `fb2b1892e46cc74f06a538bab19a8f67cabe3a5b7d59206e6a22769be12eb0b8`；用户已确认计划出现，最终复测也通过正确 Full Body 的退出重开恢复。存档迁移后继续使用包含新文件适配器的版本；旧 JSON 解析包无法读取新索引。证据见 `harmonywatch/artifacts/BUILD_20261114_STORAGE.json`。详细接手步骤见交接文档。

### 2026-11-14：计划显示内容不一致

用户改用文件存储包后已显示计划，但仍是最早的 PPL，期望为后来设置的 Full Body。手机实际仍保留 8 套计划，当前周计划为 Full Body A/B/C，周六无今日安排。旧 `buildReady()` 按库中顺序列出其他计划，PPL 优先；快照缩减到 3 项时还会挤掉后面的当前计划。

手机侧已改为优先发送当前周计划、轮换队列和未来安排中的计划；同时修复 `readyFor` 漏掉 `queue` 缓存依赖的问题。两项均已通过修正前的失败回归定位，修正后的手机回归 37 项通过，新 APK 已验签并通过 ADB 覆盖安装。本次用户 queue=null，对应的是列表优先级问题。手机计划库与日程保持原样。

### 最终验证

用户确认：**“Full Body 正确，重开后仍在”**。公钥身份、hello、计划下发、文件落盘、当前计划优先级和按冠退出重开恢复均通过本轮真机验证。

手机当前安装 `openGym-HuaweiFit-plan-priority-debug.apk`（SHA-256 `673c1ab328b18a6405e65a0ef259bb275a4f2f36a59e99cec11bf813c7aee55a`）；手表为 `openGymFIT-state-file-signed.hap`（`fb2b1892…0b8`）。最终原生状态 `paired=true installed=true receiverRegistered=true receivedPackets=4 lastSendCode=207 managerGranted=true`，通信错误为空。证据见 `BUILD_20261114_PLAN.json` 与 `PHONE_STATUS_20261114_PLAN_FINAL.json`。

## R1 页面 JS 体积余量

本轮训练修复 release 构建：`app.js` 49,112 / 49,152 B（余 40 B），页面 `index.js` 49,031 / 49,152 B（余 121 B），保留 12 种语言。

首次普通构建页面超限 131 B；已将简要调试信息组装移到 app 层并删除重复赋值。`check-size.mjs` 与全部 bundle 检查通过。HAP 内执行 BIN 与发布 BIN 相同，两个 JS bundle 与 BIN 内字节逐一匹配。

## R2 已取消的系统通知

Wear Engine DEVICE_MANAGER 与 NOTIFY 于 2026-11-13 获批。2026-11-14 用户取消休息结束系统通知，当前客户端使用 DEVICE_MANAGER 完成 P2P，通知转发实现已移除；其他智能穿戴型号仍待适配。

## 当前训练修复包与复测

- 手机：`openGym-HuaweiFit-training-fix-debug.apk`，SHA-256 `4561f2b41cfd4476801a3903d34687f2ed3f4c4e44664e8e5398c52a2327fc41`，已 ADB 覆盖安装。
- 手表：`/sdcard/haps/openGymFIT-training-fix-signed.hap`，SHA-256 `7f8d9b7cf01039a3f60e66c6af96529b625185f4857a649706ef10207d7ef589`，已推送并核对哈希。
- 当前自动验证为手表 122 项、手机 100 项通过；用户已反馈偶发退出、震动偏弱、图片希望更大；两端动作一致；已将实际关闭的前台震动开关开启。
- 复测重点：连续完成 2–3 组，加重量后页面保持；自然休息到期发长震并进入下一组/动作；手机跟随切换；96×96 图像持续显示；卡顿/黑屏是否复发；手机与手表计时差异。
- 构建、源码哈希、签名和安装证据：`harmonywatch/artifacts/BUILD_20261114_TRAINING.json`。

## 前一轮计划同步测试包与复测

- 手表 11-13 诊断版本：`harmonywatch/artifacts/openGymFIT-link-fix-signed.hap`，普通构建、无预填计划，沿用本地存档；已推送至手机 `/sdcard/haps/` 并核对 SHA-256，首轮普通包已安装且退出正常；补齐静态身份与通信诊断的新包已再次推送，已覆盖安装；用户确认手表端 `sdk:402 rx:ok tx:206`。
- 手机当前版本：`harmonywatch/artifacts/openGym-HuaweiFit-plan-priority-debug.apk`，2026-11-14 ADB 覆盖安装成功；含公钥身份迁移和计划优先级/缓存修复，签名与构建资源核验通过。
- 退出第一轮对照：`harmonywatch/artifacts/openGymFIT-exit-offline-signed.hap`，关闭 Wear Engine；用户确认仍复现。
- 退出第二轮对照：`harmonywatch/artifacts/openGymFIT-exit-no-crown-signed.hap`，在离线包基础上移除表冠旋转监听；用户确认仍复现。
- 退出第三轮对照：`harmonywatch/artifacts/openGymFIT-exit-minimal-signed.hap`，最小静态文字空壳；用户确认退出正常。
- 退出第四轮对照：`harmonywatch/artifacts/openGymFIT-exit-static-page-signed.hap`，原离线应用初始化与静态文字页面；用户确认退出正常。
- 退出第五轮：`harmonywatch/artifacts/openGymFIT-exit-once-signed.hap`，完整页面、离线、无表冠监听，新增单次清理保护；用户确认退出正常。
- 前台通信自检：`harmonywatch/artifacts/openGymFIT-link-probe-signed.hap`；用户确认 `tx:206`、收到 0。
- 原始短文本自检：`harmonywatch/artifacts/openGymFIT-link-raw-signed.hap`，SHA-256 `267c6ba63cfbf3ff60c22018ed4e3f473002ee840a15776107e98390d43a7e13`；用户在交接文档中记录仍为 206。
- 手机 11-13 诊断版本（已被 peer-key 替换）：`openGym-HuaweiFit-link-fix-debug.apk`，SHA-256 `e2c9de4d553df47c938b8c7864c5b90d878469a01ab5cef3e3f352f97aa835c8`，SDK 5.0.3.304，含权限核验与应用探测。
- 最新 APK：241,904,171 B，SHA-256 `673c1ab328b18a6405e65a0ef259bb275a4f2f36a59e99cec11bf813c7aee55a`；完整证据见 `harmonywatch/artifacts/BUILD_20261114_PLAN.json`，指纹迁移历史见 `BUILD_20261114_PEER.json`。11-13 对照包记录保留在 `BUILD_20261113_LINK.json`。
- 11-14 自动测试：手表 119 项、手机设置/同步/语言 37 项、公钥推导 2 项、原生指纹/迁移 2 项通过。通信发送与 hello 已真机通过；用户已验证正确计划显示、退出重开恢复；训练记录回传、动画和断连补传待验证。

复测步骤：

1. 覆盖安装本轮手机 APK 与手表 HAP，打开华为运动健康，确认手表已连接。
2. 手机打开 openGym，进入“设置 → HUAWEI FIT”，点“授权并连接”；同时保持手表 openGym 打开。
3. 观察 60 s 内手表是否出现手机训练计划。若仍未同步，点“刷新状态”，记录两条完整状态行及通信错误。
4. 在手表空闲页和训练页分别按表冠退出，记录黑屏时长、黑屏前最后画面、恢复后落在应用还是表盘，并注明手机 openGym 当时是否在运行。

前一轮复测使用 `openGymFIT-state-file-signed.hap`，包含双文件状态存储、单次清理修复、表冠旋转监听和 Wear Engine 通信；手机保持已安装的 plan-priority APK。

### 列表与心率说明补充（2026-11-14）

用户反馈两行计划列表难以识别可滚动。已增加“上下滑动选择计划”提示和计划数量；列表高度保留下一项局部露出，指示可继续滚动。实际显示待安装复测。

底部“心率”是训练期间的应用心率采集开关，开关状态显示为“心率：开 / 关”。开启后在训练中订阅手表心率传感器，关闭停止应用采集；当前心率值在训练页顶部显示。空闲页按钮显示开关状态，空闲期间不持续采集。

界面仅保留功能名称、状态与操作提示；取消装饰箭头和装饰性文案。

## 2026-11-14 上游合并与回归

上游 `DuarteSantos8/openGym` 的 `main` `68dad18f8` 已合并进本分支（基线 `5fdb229fe`，310 个上游提交，冲突 0 处）。合并未改动华为手表应用、Android 桥接和训练同步的产品行为；本轮修正集中在生成物换行比较、vitest 收集范围、测试 mock 与一处 CSS 类名前缀冲突。

| 范围 | 命令 | 结果 |
|---|---|---|
| 服务端 | `cd api && node --test` | 804 / 804 通过 |
| 手机界面与同步 | `cd frontend && npm test` | 655 个文件、7862 / 7862 通过 |
| 手表逻辑、协议、存储与交互 | `node --test frontend/harmony/tests/*.test.js` | 130 / 130 通过 |
| 生成物一致性 | `build-nudge-copy.mjs`、`build-wrapped-copy.mjs`、`build-coach-assets.mjs` 的 `--check` | 三者一致 |

合并版手机 APK `openGym-HuaweiWatch-merged-debug.apk`（240,344,553 B，SHA-256 `e748bf42b9e4020aa968edba1b9c5948fa3e71c817a70a6b8c6b4460d77e84c5`）已构建；包名、versionCode 31、versionName 1.4.4、23 项权限、v2 签名、14048 个 zip 条目和包内无密钥/身份文件均已核对。构建与核对证据见 `harmonywatch/artifacts/BUILD_20261114_INTEGRATED.json`。

该 APK 已于 16:12 安装到手机；B3–B7 的震动、黑屏、退表盘与卡顿，B8 的双端计时差异，B10 的双向休息控制，B11 的唤起与接收震动，B12 的列表与心率显示，仍以真机复测结果为准。

### 合并版安装与桥接状态（2026-11-14 16:12）

合并版 APK 已通过 ADB 覆盖安装：`versionCode 31`、`versionName 1.4.4`、`lastUpdateTime 16:12:27`。启动后读取应用桥接状态：

`paired=true installed=true receiverRegistered=true managerGranted=true activated=true configured=true lastSendCode=207 lastPingCode=201 receivedPackets=3 watchVersion=1000000 communicationError=""`，设备 `HUAWEI WATCH FIT 5 Pro-A11`，`transport=huawei`。

手表端按合并后源码重建并签名：`openGymFIT-merged-signed.hap`，685,185 B，SHA-256 `972ce55f2aa2d062f6a67e1b1627d5d0a21063f59da781cfa607c482d859b6fb`；app `47,564 / 49,152 B`、页面 `49,035 / 49,152 B`。已推送 `/sdcard/haps/` 并在设备上核对哈希一致。手表端覆盖安装后按上文复测步骤验证。
