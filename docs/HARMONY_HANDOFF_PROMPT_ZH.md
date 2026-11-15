# openGym 华为手表项目交接记录

开发范围、优先级和验收要求见 [用户开发要求](HARMONY_USER_REQUIREMENTS_ZH.md)。

请接手本项目，先阅读本文件、项目 AGENTS.md 和 CLAUDE.md，再根据用户的新要求继续开发。本记录覆盖 2026-10-31 至 2026-11-15，汇总开发进度、网页操作、当前产物、清理结果和接续工作。最新进度见下一节；缺陷明细见 [未解决缺陷清单](HARMONY_OPEN_BUGS_ZH.md)。

## 2026-11-15 接续：心率动态授权验证

用户确认没有健康数据／心率授权弹窗，结束页实机结果暂未确认。新增延迟 FA Context 授权流程：训练页关闭再开启心率后请求 `READ_HEALTH_DATA`，仅成功授权后订阅；缺少接口、拒绝与 15 秒超时分别反馈错误。启动不加载 FA 模块；取消等待后忽略迟到回调，避免停止未启动的传感器。手表 152、手机页面 8 项通过；编译前后授权成功/拒绝/缺失门禁、原生启动与缺失场景通过。

app 49,140 B，仅余 12 B；页面余 413 B。FIT 5 Pro 的 FA Context 实际支持仍待安装验证，真实心率采样尚未成功。测试步骤、诊断码及最新交付见[缺陷进度](HARMONY_OPEN_BUGS_ZH.md)。

## 2026-11-15 接续：结束页、重量数字与 E602

用户已实机回传 E602、结束页闪回“练完了吗”、训练主页面重量数字消失。B21 已用真实页面/控制器回归复现并修正空闲提醒优先级；继续训练会重置提醒时间。B22 已改为固定数字框、独立单位框和宽高自适应字号；0 kg、102.5 kg、徒手 8 次原生截图通过，实机待复测。B19 实机完整原文已取得：`E602: permission not declared`。签名 BIN 已有 `module.reqPermissions.READ_HEALTH_DATA`；下一步核实设备权限识别及 FIT Lite 可用的运行时授权入口。新包支持长按训练/休息页心率文字 2 秒进入 debug。

手表 146、手机页面 8 项通过；新包 `/sdcard/haps/openGym-HuaweiWatch-finish-weight-signed.hap` 已签名推送并核对哈希。app/page 为 48,026 / 48,739 B。安装、完整哈希、证据路径和接续步骤见[缺陷进度](HARMONY_OPEN_BUGS_ZH.md)。用户随后返回“有了”和错误原文；结束页与授权弹窗反馈待补充，真实心率采样尚未成功。

## 2026-11-15 最新：徒手数字自适应与心率原始错误诊断

用户反馈徒手动作次数数字与“次数”标签重叠，并确认心率一直“不可用”；回忆有一项健康服务需上架才能申请。此次处理两条独立问题。

- B20 数字重叠：原徒手字号上限 84 px，而数字文本框仅 76 px 高；原计算只考虑宽度。现为重量、次数、计时数字同时计算宽度与高度上限；数值行 72 px，加 4 px 间距，标签占独立 28 px。计时大数值按 82 px 行高计算。长数字必要时可缩至原字号一半以下，避免宽度溢出。原生“8”及九位长次数场景已检查，数字与标签分离。整页当前仍为 408×480，其他屏幕的整体布局适配继续见兼容性记录。
- B19 心率失败：用户已确认持续不可用，真实采集仍未成功。旧 fail 回调丢弃 data/code，当前已保留原始错误码和最多 64 字符说明；训练/休息心率行显示 `E<原始代码>`，JS 调用异常显示 `EJS`。采样统计与已有记录保留规则继续使用；本轮诊断阶段。
- 编译回归增加实际 app.js 的传感器成功与失败回调检查，压缩前后都验证注入样本 128 与原始错误码 201。201 为自动测试输入；用户随后回传真实设备错误码 E602，详见本页最新进度。

### 权限核验

用户回忆的上架条件推测对应 Health Service Kit。华为[个人开发者接入资质说明](https://developer.huawei.com/consumer/cn/doc/HarmonyOS-Guides/health-application-qualifications/)当前要求个人应用上架华为应用市场；该服务用于后续运动健康数据、系统运动与热量等接入。

当前代码实际调用手表本地 `@system.sensor.subscribeHeartRate`，本机 SDK `@system.sensor.d.ts` 要求 `ohos.permission.READ_HEALTH_DATA`。实际 stable-controls 签名 BIN 已声明该权限及 inuse 场景；本机签名 Profile 的 permissions 字段为空。设备已返回 E602，完整回调文字与本地授权状态待核对；Health Service Kit 申请工作继续保持原后续优先级。手机侧 Wear Engine 人体传感器 SENSOR 是第三条链路，见[官方申请说明](https://developer.huawei.com/consumer/cn/doc/connectivity-guides/applying-wearengine-0000001050777982/)。

权限核验本机证据：`harmonywatch/artifacts/PROFILE_HEART_PERMISSION_20261115.json`。心率入口、保存范围和诊断读法见[心率说明](harmony/HEART_RATE_GUIDE_ZH.md)。本轮验证：手表 145 项、手机页面 8 项通过；实际编译产物的 Wear Engine 握手和心率成功/失败回调均通过。普通徒手次数、九位长数字、模拟心率错误码三种原生场景无 JS 异常。数字编辑页也在进入及每次加减后按宽高重新计算字号。

新包 `openGym-HuaweiWatch-number-fit-heartdiag-signed.hap` 为 685,186 B，SHA-256 `9682cf22612cc2c3597ff0433cbc433647c5109529380f1b1bbc804dca196212`；已签名、核验 BIN 和 HAP 内容，推送至原测试手机 `/sdcard/haps/`，设备哈希一致。生产包未含预览注入的训练状态与模拟心率错误。app 48,026 B、页面 48,933 B，分别余 1,126 B、219 B。用户随后安装并回传 E602、结束页闪回和主页面重量数字缺失，后续修正见本页最新进度。

证据：`harmonywatch/artifacts/BUILD_20261115_FIT_HEART.json`、`TEST_20261115_FIT_HEART_WATCH.log`、`TEST_20261115_FIT_HEART_PHONE.log`、`SIGN_20261115_FIT_HEART.log`、`ui-bodyweight-20261115-preview/`、`ui-long-numbers-20261115-preview/`、`ui-heart-error-20261115-preview/`。

## 2026-11-15 最新调整：恢复秒级圆环、停用表冠旋转、突出继续训练

用户报告点击结束训练后的“继续训练”不够明显，平滑圆环有明显问题并要求暂停；另要求先停用旋转控制动作，并追问心率记录位置。

- “继续训练”改为结束页独立、全宽的绿色主按钮；保存与丢弃下移为普通按钮，加一组入口保留。
- 平滑圆环暂停：移除 canvas 自绘和 100 ms 动画时钟，恢复系统 progress 圈与秒级倒计时；±15 秒、暂停/继续和跳过保留。
- 停用表冠旋转监听、动作切换及旋转调数值；动作仍可滑动切换，数值使用屏幕加减按钮。表冠按键继续由系统处理。
- 心率说明已补充：[开关、实时读数与记录入口](harmony/HEART_RATE_GUIDE_ZH.md)。手机“显示心率”控制可见性；手表开关控制前台训练采集。手机已保存组心率位于“统计 → 历史 → 训练详情”，标签为平均 / 最高；当前休息心率虽保存，手机详情尚未展示，也没有独立华为心率曲线页。
- 修正训练中关闭心率时清空全部样本的代码路径：停止采集后保留本次已有样本，供结束汇总使用。真实设备采样成功状态仍待用户返回训练页读数，B19 继续开放。

本轮验证：手表 142 项、手机页面 8 项通过；原生启动、结束页与离线休息页均通过，编译 app/page 中已核对无表冠监听注册、无 canvas 自绘路径。app 47,796 B、页面 48,569 B，分别余 1,356 B、583 B。

已签名产物 `harmonywatch/artifacts/openGym-HuaweiWatch-stable-controls-signed.hap` 为 685,186 B，SHA-256 `6c7d2e60f928fc1ff9eee02fb4d612f91ac931d7d4e4d01e53599296ea73ac3e`；Profile、签名 BIN、HAP 容器及编译 JS 包含关系核验通过。原测试手机已连接，新 HAP 已推送到 `/sdcard/haps/openGym-HuaweiWatch-stable-controls-signed.hap`，设备文件 SHA-256 与上述产物一致；待用户用应用调测助手覆盖安装。手机继续使用已安装的 controls APK。交付核验记录：`harmonywatch/artifacts/DELIVERY_20261115_STABLE_CONTROLS.json`。

证据：`harmonywatch/artifacts/BUILD_20261115_STABLE_CONTROLS.json`、`TEST_20261115_STABLE_CONTROLS_WATCH.log`、`TEST_20261115_STABLE_CONTROLS_PHONE.log`、`SIGN_20261115_STABLE_CONTROLS.log`、`ui-finish-20261115-preview/`、`ui-rest-20261115-preview/`。

## 2026-11-15 交付：手机新版已安装，手表包已推送

原测试手机已重新连接。`openGym-HuaweiWatch-controls-debug.apk` 通过 ADB 覆盖安装返回 Success；直接读取实际已安装 base.apk 的 SHA-256 为 `83f5ff87ef49ea829524e3c197262f359375cebbdeff8f46de696c1baf88ef68`，与已校验产物一致，版本为 versionCode 31 / versionName 1.4.4。

手表包已推送到原测试手机 `/sdcard/haps/openGym-HuaweiWatch-controls-signed.hap`；设备文件 SHA-256 为 `a112d71b60200a0ce441c90227f162694e9c5fffe33806e91ec0382ea5055a6f`，与本机一致。手表侧仍需通过应用调测助手覆盖安装 HAP，随后验证 B15–B19：离线休息布局、手机结束训练时是否退表盘、圆环推进、加组往返和真实心率读数。B13/B14 通信恢复保留此前实机通过记录。

安装核验记录：`harmonywatch/artifacts/INSTALL_20261115_CONTROLS.json`。本次为已验证产物的设备交付；自动测试沿用本轮手表 141、手机相关 119、原生队列 3 项通过记录。

## 2026-11-14 追加：休息布局、远端结束、圆环、加组与心率反馈

用户新增反馈：休息页控件和离线“已存在手表上，稍后同步”提示超出屏幕；训练页“结束训练”被截为“结束…”；手机完成训练后手表退表盘，重开先显示旧休息，等一会才显示“已在手机上结束”。用户要求取消锁定、休息圈平滑推进，并询问加一组；另反馈看不到心率采集效果，要求完整 Apple Watch / 华为功能对比表。

| 编号 | 本轮处理 | 当前验证 |
|---|---|---|
| B15 休息页溢出、结束文字截断 | 原内容声明高度 516 px 超过 480 px；现压缩圆环与提示、移除锁定，结束文字框扩大 | 已检查原生离线休息页、训练页截图，控件与“结束训练”文字完整；其他型号待验证 |
| B16 手机结束后退表盘、旧休息迟到 | 手机新增优先小消息 `workoutEnd`，越过等待确认的完整快照；原生取消未发动画帧并保留正在发送队首；手表先刷新结束页，再等待持久化与确认，清空显示图片后延时串行删帧 | 延迟存储、消息顺序和队列回归已通过；实际退表盘根因及改善待真机复测 |
| B17 圆环一秒一跳 | 改为 100 ms 按毫秒 deadline 更新；原 progress 控件小数仍按整数绘制，改用 Lite canvas 自绘圆弧与端点，数字继续 ceil 到秒 | 11-15 用户反馈明显问题，已回退系统进度圈；平滑方案暂停 |
| B18 手表加一组 | 当前动作追加目标组，去除完成/心率/努力度；单侧计时成对追加；绝对组数事件幂等，旧快照与事件确认后继续保护未回传新组 | 手表离线加组、单侧计时、旧快照、手机去重追加回归通过；跨端实机待验收 |
| B19 心率采集不可见 | 训练页顶部与休息页显示可点击心率文字，可直接切换采集；状态包含关、测量中、暂无数据、不可用、当前 bpm；汇总仍为平均/峰值 | 传感器回调、真实样本值显示、15 秒失效与错误状态自动测试通过；真机传感器读数待确认 |
| R4 锁定取消 | 移除华为应用锁屏、各处入口与操作拦截；恢复旧存档时丢弃锁定标记 | 旧锁定存档仍可完成组的回归通过；Apple 原版 Water Lock 见功能表 |

新增[完整功能对比表](harmony/WATCH_FEATURE_COMPARISON_ZH.md)，覆盖计划、各类组、编辑、休息、离线同步、动画、心率、系统运动、通知、常亮、组件、语言和设备兼容性。Apple 列为源码核验，华为列分实现与实机状态；原作者与上游来源保留。

手机新版 `openGym-HuaweiWatch-controls-debug.apk` 已构建，240,572,537 B，SHA-256 `83f5ff87ef49ea829524e3c197262f359375cebbdeff8f46de696c1baf88ef68`；Gradle 8 分 15 秒，209 任务中 6 执行。包内已核对新增结束控制、帧队列清理、加组处理；用户指定使用原测试手机并稍后重新连接，覆盖安装待进行。

最终验证：手表 141 项、手机同步/训练相关 119 项、原生队列 3 项通过。原生启动与结束汇总通过；离线休息页连续 12 秒抓到 119 帧，弧端 53 个不同位置，无 JS 异常。心率预览注入 128 bpm 样本验证布局，真实传感器读数待真机确认。app 49,096 B、页面 49,092 B，距离 49,152 B 上限分别余 56 B、60 B。

手表包 `openGym-HuaweiWatch-controls-signed.hap` 已完成签名、Profile、BIN 分块与容器校验；689,283 B，SHA-256 `a112d71b60200a0ce441c90227f162694e9c5fffe33806e91ec0382ea5055a6f`。HAP 内 BIN 与签名单独文件一致，包含本次 app/page 字节。手机 APK 签名仍为已登记的 F67F…E1AE。用户指定继续使用原测试手机，最新回复为稍后重新连接；本轮 APK 覆盖安装与 HAP 推送待该手机连接后执行。

本机证据：`harmonywatch/artifacts/BUILD_20261114_LAYOUT_END.json`、`BUILD_20261114_LAYOUT_END_ANDROID.json`、`TEST_20261114_LAYOUT_END_WATCH.log`、`TEST_20261114_LAYOUT_END_PHONE.log`、`TEST_20261114_LAYOUT_END_QUEUE.log`、`SIGN_20261114_LAYOUT_END.log`、`RING_MOTION_20261114_FINAL.json`。下一步安装两端新包，确认结束训练是否仍退表盘、手机/手表加组往返、休息圈与暂停、心率实际读数。原生工具新增 `prepare-ui-preview.mjs`（独立副本、合成训练/离线休息/结束场景）和 `check-rest-motion.ps1`（按 JPEG 弧端位置检查亚秒变化）；生产包保留真实存储和通信。

## 2026-11-14 此前实机确认：启动与通信恢复（B13 / B14）

用户确认 `boot-return` 包正常打开、原有 Full Body 计划可显示；调试页为 `sdk:? rx:off tx:-`，后面没有错误文字。这是修正前的读数。安装 SDK 回调修正包后，用户回复“好了”，确认本轮通信恢复；B13 启动黑屏与 B14 通信初始化回归均已通过实机反馈。修正后的具体 sdk/rx/tx 数值尚未回传。

已定位到构建后的实际代码：SDK 原始版本查询传入有效 `complete` 回调，二次 Terser 压缩后变成 `complete:function(){}`。回调无法写入客户端版本，SDK 就绪等待超时，接收器未注册，手机发送返回 206。旧 training-fix 包保留有效回调。逐项关闭优化验证后，`reduce_vars=false` 保留回调；SDK 源文件保持原始字节。

构建流程已关闭 `reduce_vars`，新增实际编译 app.js 的异步通信门禁：延迟返回版本 402，再验证接收器注册与 hello 发送 207。旧故障产物在同一门禁得到 `sdk:? rx:off tx:-` 并超时；修正后压缩前、后均为 `sdk:402 rx:ok tx:207`。手表 133 项通过，原生启动 2 帧、3197 可见像素、无 JS 异常。app 47,743 B、页面 49,097 B；每份上限 49,152 B，页面余量 55 B。

修正包 `/sdcard/haps/openGym-HuaweiWatch-sdk-callback-signed.hap` 已签名校验并通过 ADB 推送，手机端文件哈希一致；大小 685,186 B，SHA-256 `591b5dd463742ce7279711b7735ce65bc4c62635ce333e591470dece99f2a90e`。HAP 内 BIN 与独立签名 BIN 一致，BIN 包含本次编译 JS。用户随后回复“好了”，本轮通信恢复已确认。对应代码提交为 `c97c781e9`。

手机继续使用已安装的合并版 APK。本轮已核验实际 APK 签名、已授权权限、保存的 112 字符 Lite 对端身份与手表配置一致；修正前手机接收器已注册，收到 0 条、发送 206；修正后用户确认恢复。证据：`harmonywatch/artifacts/BUILD_20261114_SDK_CALLBACK.json`、同名 `.log`、`TEST_20261114_SDK_CALLBACK_WATCH.log`、`SIGN_20261114_SDK_CALLBACK.log`、`PHONE_STATUS_20261114_BOOT_RETURN_206.json`。签名、身份配置和设备日志保留本地。

接续顺序：使用已确认恢复通信的 SDK 回调修正包，复测手机开始训练时手表自动进入与震动、双向 ±15 秒和暂停/继续，再继续 B3/B5/B6/B7/B8 的训练稳定性与计时测试。

## 2026-11-14 启动黑屏排查记录（B13，后续实机已确认打开）

用户覆盖安装 `openGymFIT-merged-signed.hap` 后，打开应用立即黑屏，并回报 206。已覆盖恢复到 `openGymFIT-training-recovery-signed.hap`（与此前 training-fix 字节相同），用户确认可以打开；此后用户安装 boot-return 包并确认正常打开，详见最新进度。

原生 Lite 预览器已复现 `TypeError: wrong type of argument`。已定位：Terser 的默认语句压缩丢弃了顶层 IIFE 的完成值，压缩后 app/page 的求值结果由 ViewModel 对象变成 boolean；旧等价检查仅比较构造参数，漏掉加载器实际消费的返回值。

修正为 `compress.expression=true`，并要求 bundle 求值结果等于刚创建的 ViewModel；新增回归已先失败、修正后通过。发布构建在预览器及配置可用时执行原生启动检查，失败即停止打包。官方选项说明见 [Terser expression](https://terser.org/docs/options/)。

修正版手表 131 项通过；原生启动 2 帧、可见像素 3197、无 JS 异常。app 47,574 B、页面 49,045 B，均低于 49,152 B。手机 APK 继续使用已安装的合并版；修正版 `openGym-HuaweiWatch-boot-return-signed.hap` 已签名推送到 `/sdcard/haps/`，设备文件 SHA-256 与本机一致：`3b644308467bdc78dbcae23a8d00ba13319715d98b9038942423c6e4b19e3a8b`。实机随后确认正常打开，通信仍为 206；当前修正见 B14。证据：`harmonywatch/artifacts/BUILD_20261114_BOOT_RETURN.json`、`BOOT_RETURN_NATIVE_PREVIEW.log`、`TEST_20261114_BOOT_RETURN_WATCH.log`。

## 此前交付与验收（SDK 回调修正轮次）

| 事项 | 当前状态 | 依据 |
|---|---|---|
| 本轮代码与上游同步 | 已合并上游 main `68dad18f8` 并推送 GitHub | 合并提交 `e515ee44f`，随后安装记录提交 `9b71c53dc` |
| 手机 APK | 合并版已 ADB 覆盖安装 | `openGym-HuaweiWatch-merged-debug.apk`；versionCode 31、versionName 1.4.4，安装时间 16:12:27 |
| 手表 HAP | SDK 回调修正版通信恢复已获用户确认 | `/sdcard/haps/openGym-HuaweiWatch-sdk-callback-signed.hap` |
| 基础通信 | SDK 回调修正后用户确认通信恢复 | 用户反馈“好了”；具体新读数尚未回传 |
| 自动验证 | 手机/服务端沿用合并回归；SDK 回调修正版完成新增验证 | 手机 7862、服务端 804、MCP 138；手表 133，原生启动通过 |
| B1 / B2 | 退出与计划保存恢复已由用户验收 | 恢复表冠与通信的普通包退出正常；Full Body 计划正确，重开仍在 |
| B9 动作导航 | 已由用户确认两端一致 | training-fix 实机反馈 |
| 本轮新功能 | 代码完成，待合并版实机验收 | 接收震动、双向休息控制、128×128 动画、滚动提示与心率开关状态 |
| 训练稳定性 | 继续验证 | 偶发退表盘、图像消失、震动效果、1–2 秒计时差异；关闭动画后暂未观察到退出 |

项目面向圆表、方表等华为手表，FIT 5 Pro 为已验证型号。其他型号与运行时见 [兼容性](harmony/COMPATIBILITY_ZH.md)。README、仓库描述、目录索引已更新，源码入口与原作者署名保留；签名、身份 JSON、安装包和设备日志保持本地。

当前安装包、哈希、完整测试及后续验证见 [本轮改进记录](HARMONY_IMPROVEMENTS_20261114_ZH.md)。下文按历史轮次保留排查过程；本轮状态见文首追加记录。

### 最新追加（2026-11-14，训练中回归排查）

B1/B2 的前述验收为按冠退出、计划下发及退出重开恢复。用户随后在真实训练中新增 B3–B7：休息结束不震动、演示图过小/偶发消失、首次加重量偶发退到表盘、完成组后长卡顿或黑屏退表盘。黑屏后等一段时间仍能进应用看到休息；手动跳过休息可进入下一动作，但再完成仍卡住，自然到期有时停在旧已完成动作。另补 B8：手机休息倒计时比手表快约 1–2 秒。完整现象见缺陷清单，当前优先定位完成持久化、同步回调及休息状态推进。

用户已取消“休息结束系统通知”。手机后台转发、NOTIFY 入口与排程代码已移除；前台倒计时、休息振动、常亮继续保留并验证。

### 本轮产物、整理与上游同步

完整记录见 [2026-11-14 改进与验证](HARMONY_IMPROVEMENTS_20261114_ZH.md)。第二版 APK `openGym-HuaweiWatch-training-v2-debug.apk`、HAP `openGymFIT-training-v2-signed.hap` 已构建验签；用户回复手机稍后连接，尚未安装第二版。手表/手机/原生队列共 298 项通过。

项目目标为圆表、方表等华为手表，FIT 5 Pro 为已验证型号。README、兼容性、目录索引已按此更新；公开进度纳入源码，签名和本机证据继续忽略。上游 main `68dad18f8`（310 个上游提交）已合并，冲突已解决；合并后服务端 804、手机界面 7862、手表 130 项通过，合并版 APK 已安装。细节见[缺陷进度](HARMONY_OPEN_BUGS_ZH.md)与[改进记录](HARMONY_IMPROVEMENTS_20261114_ZH.md)。

### 第二轮反馈与新增需求（2026-11-14，代码已完成，待实机验收）

用户已覆盖安装 training-fix：两端动作现在一致；图片变大但希望更大；偶发退出到表盘仍存在；休息震动偏弱。手表只显示两个计划，底部心率开关缺少状态。关闭动作动画后暂未发现退出，仍需继续验证。

新需求 B10：手表加减 15 秒、暂停/继续与手机双向同步，手机修改尽快送达。新需求 B11：手机点开始后唤起手表并进入训练界面，新任务收到后长震确认。代码已接入，手表 130、手机 166、原生队列 2 项通过；第二版手表已完成 48 KB 构建与签名（app 47,277 B、页面 49,017 B），手机也已构建验签。ADB 未连接，用户回复稍后连接，真机仍使用下表 training-fix。修改点及验证清单见 [缺陷进度第二轮](HARMONY_OPEN_BUGS_ZH.md)。

### 第一版训练修复交付（2026-11-14，历史记录）

| 产物 | 状态 | SHA-256 |
|---|---|---|
| `openGym-HuaweiFit-training-fix-debug.apk`，241,904,171 B | ADB 覆盖安装 Success，旧通知清理已执行 | `4561f2b41cfd4476801a3903d34687f2ed3f4c4e44664e8e5398c52a2327fc41` |
| `openGymFIT-training-fix-signed.hap`，685,186 B | 已签名校验并推送 `/sdcard/haps/`，待用户覆盖安装、真实训练复测 | `7f8d9b7cf01039a3f60e66c6af96529b625185f4857a649706ef10207d7ef589` |

代码已完成：取消手机系统通知与手表 relay；动画显示 96×96、整组持久化和替换时保留旧动画；保存队列合并；手机快照请求串行；旧快照保护已完成组/已关闭休息；编辑空状态保护；共享休息 deadline 与 ceil 倒计时；navigate 跨端动作位置事件。首个前台长震先于休息关闭时的存档工作发出。

自动测试：手表 122 项、手机训练/同步/计时 100 项通过。新 HAP app.js 49,112 B、页面 49,031 B，余量分别 40 B、121 B，保留 12 种语言；普通诊断保留待回传数/动画数、show/hide、sdk/rx/tx 和最后错误。新 APK 的 136 个 Web 文件逐字节核对，原通知实现类已移除。手机实际旧通知配置为 `retired=true`，升级清理已执行。

B3–B9 的马达反馈、实际卡顿/黑屏、图像稳定性、动作位置和双端倒计时仍待真机复测。已请用户安装新 HAP 后试 2–3 组（含加重量、自然休息到期），用户已反馈偶发退出、震动偏弱、图片希望更大；两端动作一致。直接读取到手机前台震动设置 `restHaptics=false`，现已保留其他偏好并改为 true，证据 `PHONE_SET_REST_HAPTICS_20261114.json`；后台系统通知仍为移除状态。系统时钟偏移尚未做专门校准，1–2 秒差异的实测结果继续记录 B8。

证据：`harmonywatch/artifacts/BUILD_20261114_TRAINING.json`、`README_20261114_TRAINING.md`、`VERIFICATION_20261114_TRAINING_CONTENTS.json`、`PHONE_RETIRED_NOTIFICATIONS_20261114.json`。下文 Full Body 验收为前一轮组合的通过记录。

### B1 修复内容

根因：平台退出顺序为 `onHide → onDestroy`，页面的 `onDestroy` 内又调用一次 `onHide`，清理执行两次。修复为 `onHide` 入口的可见性守卫 `if (!this.visible) return`，编译页面增加 24 B。回归测试在 `frontend/harmony/tests/`，手表端共 115 项通过。

定位过程是五轮对照包：关闭 Wear Engine（复现）→ 再关闭表冠监听（复现）→ 最小静态页（正常）→ 原 app.js 配静态页（正常）→ 完整页面加单次清理守卫（正常）。真机通过的完整包归档为 `openGymFIT-exit-full-verified-signed.hap`。

同轮改动：移除启动阶段两条无消费方的 `pingPeer()` 调用；普通构建关闭逐步取证写盘，保留空闲页长按 2 s 的 debug 页。

### B2 修正前读数（2026-11-13）

手机端（ADB 经 WebView 调试口读取桥接状态，2026-11-13 21:05）：

| 字段 | 值 | 含义 |
|---|---|---|
| `managerGranted` | true | DEVICE_MANAGER 实际已授权 |
| `deviceName` / `p2pCapability` | HUAWEI WATCH FIT 5 Pro-A11 / 2 | 设备已发现，能力枚举 2 为未知 |
| `lastPingCode` | 202 | 手表应用探测：运行中 |
| `watchVersion` | 1000000 | 手机读到手表应用版本 |
| `receiverRegistered` | true | 手机接收器已注册 |
| `receivedPackets` | 0 | 未收到任何手表消息 |
| `lastSendCode` | 206 | `helloRequest` 发送失败 |

手表端 debug 页：`sdk:402 rx:ok tx:206`，最近错误“连接中断，已保存的记录稍后重试”。

结论：配对、权限、应用探测、版本读取、双端接收器注册均通过；消息发送在双向都失败。用户此前看到的“已注册通信”是接收器注册成功，当时训练数据尚未进入发送流程；本轮新增主动握手后，发送失败才显示为 206。

已验证后仍为 206 的改动：

1. 手机接收器就绪后发送 `helloRequest`，手表收到后重发 hello；未应答时至少间隔 15 s 重试。
2. 手机在“已连接、未应答”期间保留接收器，换接收器前先等待注销成功。
3. 手表 `config.json` 的 `module.metaData.customizeData` 增加 `supportLists`（手机包名:证书指纹），由 `prepare.mjs` 生成。
4. 前台通信自检包 `openGymFIT-link-probe-signed.hap`：客户端创建、注册、发送移到页面 `onShow` 之后，结果 `402 / rx:ok / tx:206 / 收到 0`。
5. 手机 Wear Engine SDK 由 5.0.2.306 升到 5.0.3.304（`frontend/android/app/build.gradle`）。
6. 手机端增加 `checkPermission(DEVICE_MANAGER)` 核验与手表应用探测（`HuaweiWatchPlugin.java` 的 `managerGranted`、`probeWatch()`），设置页显示连接权限、设备、通信能力、探测码和版本。

已核对一致的身份：手机 APK 实际签名 F67F…E1AE；手机保存的手表身份 `host.msknet.opengym.fit` / E829…6691 与签名 HAP 证书一致；手机 APP ID `119569911`。运行环境：华为运动健康 17.0.10.300（允许后台），HMS Core 6.16.4.362。

### B2 手机指纹根因（2026-11-13 发现，11-14 修复验证）

原始短文本自检包结果：用户在进度文档中记录仍为 206；官方示例短文本同样发送失败，后续优先修正身份配置。

手机侧 `setPeerFingerPrint` 填入的手表指纹格式有误。华为[如何获取应用指纹](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/wearengine_faq-9)规定：HarmonyOS 5.0 及之后的 Lite Wearable 应用，指纹为 `应用包名_base64Encode(公钥)`，公钥取签名叶证书的 EC 未压缩点（65 字节，`04` 开头）；[手机侧 P2P 指南](https://developer.huawei.com/consumer/cn/doc/connectivity-guides/phone-send-message-0000001051059209)注明该指纹最长 127 位。此前填的是叶证书 SHA-256（64 位十六进制 E829…6691），Android 对端采用该证书 SHA-256 格式。手表为 HarmonyOS 7.0.0.017，适用新格式。

| 方向 | 值 | 状态 |
|---|---|---|
| 手表 → 手机身份（手表侧配置） | 包名 `host.msknet.opengym.phone` + APK 证书 SHA-256 F67F…E1AE | 格式正确，保持 |
| 手机 → 手表身份（手机侧配置） | `host.msknet.opengym.fit_BJc8JAa9rJKfqzas/d1BzWZrBv8+ECYLetB9fK0Zo1azvpUTL6izrUJNzYsYQI0ozMEMOOpYF9GmMB/ppUEBC4c=` | 由 `harmonywatch/signing/opengym-fit-leaf.cer` 算出，共 112 字符；2026-11-14 已从手机 SharedPreferences 核验迁移成功 |

推导命令：`openssl x509 -in opengym-fit-leaf.cer -noout -pubkey | openssl pkey -pubin -outform DER`，取末尾 65 字节做 base64，前面拼 `包名_`。包名探测（202）与版本读取只用包名，所以此前能通过；指纹只在消息收发时校验，与全部读数相符。

### 2026-11-14 手机端修正

用户新增的公钥指纹发现已按官方文档与本地公共证书复核。这里的 Base64 是公钥编码，手机 CPU 架构保持现有构建配置。

- `scripts/harmony/watch-peer-identity.mjs` 从签名叶证书提取 P-256 公钥，生成 `包名_Base64(04 || X || Y)`；同时核对证书 SHA-256 与公开身份文件，保留 Base64 大小写、`+`、`/`、`=`。
- `build-android.sh` 与 `build-android-incremental.sh` 共用上述推导值，分别注入 Vite 默认值和原生 BuildConfig；`watchCertificateSha256` 继续用于证书核验与精确识别旧配置。
- `WatchPeerIdentity.java` 校验新格式、包名前缀及 127 字符上限；`HuaweiWatchPlugin.configure()` 原先只接受 64 位十六进制，已替换。
- 原生 `load()` 只迁移“构建登记的同一包名 + 同一旧证书 SHA-256”，保留其他自定义身份和已有授权。这样覆盖安装后，旧 SharedPreferences 会更新为同一证书的公钥身份；训练存档保持。
- 手机设置页改为“手表应用指纹（包名与公钥）”，连接操作原样传递大小写敏感的 Base64 值。
- 已复现旧原生正则拒绝新的 112 字符身份；公钥推导测试 2 项、原生格式/迁移测试 2 项、手机设置/同步回归 33 项通过。Android 构建成功，前端 5.33 s、Gradle 4 min 38 s；结果记录在 `harmonywatch/artifacts/*20261114_PEER*`。

### 2026-11-14：训练状态存储失败

用户普通训练包读数为 `sdk:402 rx:ok tx:207`，错误“存储失败，记录尚未同步”。重新注册手机接收器后直接读到 `installed=true`、`receivedPackets=1`、`lastSendCode=207`、`communicationError=""`、`watchError=[]`，证据 `PHONE_RECONNECT_20261114.json`。计数由新手机进程重新开始，与之前的累计 13 条分开记录。协议 hello 已通过，计划卡在手表落盘。

已核实的平台限制：[`@system.storage.set`](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-system-storage/) 单值必须小于 128 字节。旧 runtime 直接将完整训练状态 JSON 存入 `opengym-fit-v1`，正常计划超过该上限；[`@system.file.readText`](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-system-file/) 单次读取最多 4096 字节。

本轮新增 `common/state-storage.js`，由普通与离线 runtime 共用：

- 原 KV key 存短索引，状态文本先 URI 编码为 ASCII，按最多 4096 字符分块读写；中文/emoji 的 UTF-8 字节边界保持完整。
- 两份状态文件交替写入；先删除并写入非活动文件，全部成功后再提交短索引。半写入或索引提交失败时保留上一份完整状态。
- 旧 JSON 状态继续可读，第一次成功保存后迁移；读取到索引对应文件缺失/截断时进入错误路径保护数据。
- `snapshotAck` 与训练事件发送仍在落盘成功之后；保留 B1 单次清理和前台常亮。

新增 4 项测试覆盖大 Unicode 状态、重启读取、文件半写入/索引失败、短状态覆盖、旧 JSON 迁移、截断保护，以及真实 controller 在落盘成功后才确认快照。手表 119 项全部通过；新 HAP 已构建、验签并推送至手机 `/sdcard/haps/openGymFIT-state-file-signed.hap`，哈希已核对。SHA-256 `fb2b1892e46cc74f06a538bab19a8f67cabe3a5b7d59206e6a22769be12eb0b8`，685,185 B。app.js 为 49,029 B（余 123 B），页面 48,865 B（余 287 B），保留 12 种语言。用户已确认新包能显示计划，后续手机排序修正版安装后也确认按冠退出重开仍保留正确 Full Body 计划。

存档格式更新：旧 HAP 直接解析 KV JSON，无法读取新的文件索引。成功迁移后的后续构建需保留 `state-storage.js`，同步复测使用新 `state-file` 包。`-Forensics` 的其他取证键仍沿用 KV，部分缓冲可达 200 字符；普通包已剥离这些写入，后续启用取证前需另行适配容量。

### 2026-11-14：旧 PPL 优先于当前 Full Body

用户反馈：手表显示 Push Day / Pull Day / Leg Day，手机后来已改为 Full Body。已通过手机调试口只读取计划名称和日程字段：计划库仍有旧 PPL、两个“新训练日”和 Full Body A/B/C；周一、三、五分别安排 Full Body A/B/C，轮换队列为 null、无正在进行的训练。2026-11-14 是周六，手机无今日安排，手表展示其他可用计划。

已复现的缺口：`buildReady()` 原先按计划库顺序截取 `others`，旧 PPL 在前；`fitSnapshot()` 超预算时会先压到 3 个 others，当前 Full Body 可能排到后面或被裁掉。本轮改为优先下发周计划、轮换队列和未来日期安排中仍在使用的计划，其余保留计划随后排列，手机计划库保持原样。

另有独立缓存缺口：`readyFor()` 原先未把 `S.queue` 纳入缓存键，单独切换/重排轮换队列时仍会复用旧“今日”快照。本轮补齐 queue 依赖。两条回归已先复现失败：休息日列表首三项仍为 PPL、仅改 queue 后今日计划仍未更新；修正后手机设置/同步/语言回归 37 项通过，APK 已完成构建、签名核验和 ADB 覆盖安装。此次用户数据 queue=null，直接对应的是其他计划的排序问题。

### 上一轮 Full Body 真机结果（2026-11-14）

用户确认：**“Full Body 正确，重开后仍在”**。已完成手机公钥身份迁移、双端通信、手表大状态文件存储、当前计划优先级与轮换队列缓存修正。上一轮已验收组合如下：

| 设备 | 已安装版本 | SHA-256 |
|---|---|---|
| Android | `openGym-HuaweiFit-plan-priority-debug.apk`，241,904,171 B | `673c1ab328b18a6405e65a0ef259bb275a4f2f36a59e99cec11bf813c7aee55a` |
| FIT | `openGymFIT-state-file-signed.hap`，685,185 B | `fb2b1892e46cc74f06a538bab19a8f67cabe3a5b7d59206e6a22769be12eb0b8` |

安装后的原生读数：`paired=true`、`installed=true`、`receiverRegistered=true`、`receivedPackets=4`、`lastSendCode=207`、`managerGranted=true`、`communicationError=""`。完整证据为 `PHONE_STATUS_20261114_PLAN_FINAL.json`；探测码为最近一次单独探测结果，消息与用户操作另行记录。

测试与构建：手表 119 项、手机设置/同步/语言 37 项、公钥推导 2 项、原生指纹/迁移 2 项通过；新 APK 的 136 个 Web 构建文件与包内逐字节一致，签名仍为登记的 F67F…E1AE。手表已完成官方验签、固定叶证书/Profile/分块摘要校验，签名 BIN 中两份 JS 与编译输出一致。

### 接续验证

1. 保持上述 APK/HAP 组合，验证训练组数/重量记录回传、去重与 ACK，随后验证断连后补传；先保留本地未确认记录。
2. 验证动作帧传输、手表实际渲染与缓存清理；训练素材继续遵守独立许可。
3. NOTIFY 休息结束系统通知已由用户取消；后续验证手表应用内休息到期提示和振动。
4. 页面与 app 的体积余量分别为 121 B、40 B；新增手表功能前先核对两份 bundle。

### 2026-11-14 安装后读数

ADB 覆盖安装成功；签名证书 SHA-256 仍为 F67F…E1AE。已核验 APK 的 DEX 和 Web 资源均含新公钥身份，迁移类与素材 NOTICE 均在包内。手机实际保存值从 E829…6691 自动更新为上述 112 字符身份，`authorized=true` 保留。

首次原生状态：接收 1 条、应用探测 201、发送 206。随后读数为接收 13 条、探测 202、发送 207、通信错误为空，hello 当时尚未解析；证据 `PHONE_STATUS_20261114_PEER_LATEST.json`。

用户确认手表运行普通训练页。手机进程后续重启，重新注册接收器后读到 `installed=true`、接收 1 条、发送 207、无 `watchError`，证据 `PHONE_RECONNECT_20261114.json`。用户同步报告手表 `402 / ok / 207` 和存储失败。文件存储包与计划优先级手机更新后，用户已确认正确 Full Body 显示和退出重开恢复，最终结果见上一节。


### 当前安装与工程状态

| 位置 | 内容 |
|---|---|
| 手机已安装 APK | `openGym-HuaweiFit-training-fix-debug.apk`（`4561f2b4…fc41`），ADB 覆盖安装 Success；保留身份/计划修复，新增训练同步与通知移除 |
| 手表当前/待测 | 之前 state-file 包已验收 Full Body/重开恢复；新 `openGymFIT-training-fix-signed.hap`（`7f8d9b7c…f589`）已推送，待训练复测 |
| 手机 `/sdcard/haps/` | 新 `state-file` HAP 已推送并核对哈希；旧 `link-fix`、`link-probe`、`link-raw`、`exit-once` 留作历史对照 |
| 备用 APK | `openGym-HuaweiFit-link-sdk306-debug.apk`，SDK 5.0.2.306 的上一版，`e2d822c4…6cb9` |
| `harmonywatch/` 源码 | 普通模式，已包含双文件存储及训练回归修复，122 项测试通过 |
| `harmonywatch/entry/build/` | 当前为训练修复普通包的编译输出；JS 已逐字节核对签名 BIN，HAP 内 BIN 与发布 BIN 相等 |
| `frontend/android/.../app-sideload-debug.apk` | 2026-11-14 训练修复输出，与已归档/已安装 training-fix APK 一致 |

ADB：`/mnt/d/dev/Android/Sdk/platform-tools/adb.exe -s f16fc84a`。读取手机桥接状态：先 `adb forward tcp:19223 localabstract:webview_devtools_remote_<pid>`，再用 DevEco 自带 node 运行 `harmonywatch/artifacts/PHONE_STATUS_20261113.mjs`。每次手机进程重启后重新读取 pid 并建立转发，保持 openGym 前台；旧 pid 或 WebView 暂停会造成工具连接失败。当前临时转发已清理，后续复测需重新建立。

### 本轮新增构建入口

- `scripts/harmony/sign-local.sh --bin-in … --bin-out … --hap-out …`：本机签名并校验 BIN/HAP。
- `scripts/harmony/prepare-exit-probe.mjs --project harmonywatch [--minimal | --static-page]`：退出对照包。
- `scripts/harmony/prepare-link-probe.mjs --project harmonywatch [--raw]`：前台通信自检页；`--raw` 发送官方示例短文本。
- `scripts/harmony/build-android-incremental.sh`：只改前端或已有原生桥接时使用，保留已暂存的 exercise-media，公钥版 Gradle 4 min 38 s、计划版 3 min 55 s；首次或媒体变更仍用 `build-android.sh`。
- 对照包或自检包构建后，运行 `node scripts/harmony/prepare.mjs --project harmonywatch` 恢复普通工程。

最新训练修复与安装记录：`harmonywatch/artifacts/BUILD_20261114_TRAINING.json`。前一轮计划排序与安装记录：`harmonywatch/artifacts/BUILD_20261114_PLAN.json`、`README_20261114_PLAN.md`、`INSTALL_20261114_PLAN.log`、`TEST_20261114_PLAN_PHONE.log`。本轮文件存储记录：`harmonywatch/artifacts/BUILD_20261114_STORAGE.json`、`SIGNING_20261114_STORAGE.log`、`TEST_20261114_STORAGE_WATCH.log`。手机指纹记录：`harmonywatch/artifacts/BUILD_20261114_PEER.json`、`README_20261114_PEER.md`、`PHONE_PEER_20261114_BEFORE.json` / `AFTER.json`、`PHONE_STATUS_20261114_PEER.json`。11-13 对照包记录保留在 `BUILD_20261113_LINK.json`；新 APK 哈希已加入 `SHA256SUMS.txt`。下文“当前交付物”“当前验证”“接续工作”为 2026-11-03 的记录，与本节不一致处以本节为准。

## 项目与环境

这是 Duarte Santos（DuarteSantos8）的 [openGym](https://github.com/DuarteSantos8/openGym) 的第三方华为 FIT / HarmonyOS 适配，代码沿用 AGPL-3.0-or-later。应用介绍、致谢、源码和交付说明保留原作者和上游来源；训练素材许可见 NOTICE.md。

仓库：`D:\LEARNING\vibeproject\openGym-harmonywatch\openGym-harmonywatch`。
WSL：`/mnt/d/LEARNING/vibeproject/openGym-harmonywatch/openGym-harmonywatch`。

| 项目 | 当前情况 |
|---|---|
| 电脑 | Windows 11 + WSL Ubuntu 26 |
| IDE | DevEco Studio 26.0.0.851，`E:\Program Files\Huawei\DevEco Studio` |
| 手机 | 一加 Ace 3，Android 16，已安装 openGym Android APK，登录 NAS 自部署服务 |
| 手表 | HUAWEI WATCH FIT 5 Pro，NKI-B29，HarmonyOS 7.0.0.017，API 26 |
| 手表应用 | 开发者中心名称 opengym，包名 `host.msknet.opengym.fit` |
| 手机应用 | openGym Phone，包名 `host.msknet.opengym.phone`，APP ID `119569911` |
| 工程 | `harmonywatch/`，Lite Wearable FA JS，HML + CSS + JS |
| SDK | target API 26，Compatible SDK 6.1.1(24) |
| 使用方式 | 个人签名、调测助手侧载、自用测试 |

当前维护 Android 配套端和华为轻量手表。Wear Engine 申请选择两类穿戴；当前工程及实拍设备为 FIT 5 Pro，其他智能穿戴型号待适配。开发者中心的 opengym1 是测试应用。

## 当前交付物

项目内安装包集中在 `harmonywatch/artifacts/`：

| 文件 | 用途 | SHA-256 |
|---|---|---|
| `openGymFIT-controls-fix-signed.hap` | 当前日常测试包，内置三套 PPL、15 个动作 | `27754a4c10f1f35f15cfbe4594db485bd7d00e9a52e602ee20e303766f70b707` |
| `openGymFIT-first-launch-signed.hap` | 无预填计划的首次启动场景 | `ae1d81898488d6250958a14179ff504d83d35637c85d26052fe9eb627e0e2a8a` |
| `openGym-HuaweiFit-personal-debug.apk` | Android 配套端，含华为通信及休息通知代码 | `65f61a0f8e7ca0923ed5df69e64c82b9e8c45d4180352a9c60bdaec238bee61c` |

两个手表包使用相同包名和签名身份，覆盖安装保留本地存档。2026-11-03 已按当前源码（含 11-02、11-03 的交互修正与语言默认值改动）重新编译并重签，哈希随签名时间变化（见 `harmonywatch/artifacts/BUILD_20261103.json`）。首次启动包在无存档时显示“尚未同步”和手机同步提示；PPL 包可离线测试训练流程。项目外 D:\Downloads 曾放过交付副本；本次清理范围为项目目录，当前文件选择以上表为准。

## 2026-10-31：开发与操作

1. 修复安装错误 46 对应的权限元数据缺项，补齐 reason、usedScene.abilities 和 when=inuse，把权限结构检查接入源码、BIN 和 HAP 检查流程。
2. 修复首次启动说明裁切、待同步文字重叠，给文本和容器设置明确尺寸；保留与手机一致的中文动作名称、较大的数字层级和小数显示。
3. 接入前台持续亮屏：页面显示时请求 setKeepScreenOn(true)，隐藏和销毁时释放。实际 FIT 常亮时长和盖屏行为待复测。
4. 使用本分支自绘 PNG 实现完成、返回、开始、旗帜、停止、心率、离线和加减图标。
5. 接入休息结束通知链路：手表提前发送截止时间 → Android AlarmManager → Wear Engine NotifyClient → 手表模板通知。包括取消、延长替换、事件去重、过期丢弃和目标设备绑定。
6. 手机 HUAWEI FIT 设置增加独立的“休息结束系统通知”开关、测试通知和精确闹钟设置入口。连接请求 DEVICE_MANAGER；开启通知请求 DEVICE_MANAGER 和 NOTIFY。
7. 建立带 PPL、无计划两种测试构建和空存储启动预览，手机继续使用现有 NAS 服务。

Android 通知实现已进入提交 1851faded（2026-10-31）。既有记录为 4 项 Android Gradle 通知规则测试、6 项手机设置/同步测试通过；证据见 REST_NOTIFICATIONS_VERIFICATION.json、ANDROID_VERIFICATION.json。

## 2026-11-01：开发与操作

### 手表交互及退出清理

- 表冠累计相对角度达到 24° 才步进，单事件最多一步，两次有效步进至少相隔 250 ms，有效步进请求短振。
- 重量编辑提供独立的 -1、+1、-0.1、+0.1 按键，保留已有两位小数。
- 前台休息结束显示全屏提示，在 0、2、4 秒请求长振，每 10 秒重复；确认、隐藏、销毁或结束训练时取消。
- 页面隐藏/销毁时停止页面时钟、心率、表冠监听和提醒。清理 SDK 就绪轮询和迟到的通信、存储回调；已排队训练记录继续落盘。
- 修复原生结束训练页 TypeError: Expected a function，使用 Lite 兼容的手工占位符格式化；抓帧检查增加 JS 异常判断。
- 构建并验证当前两个 HAP，保留 12 种语言，生成工程最终恢复为 PPL 模式。

用户报告过按冠后界面和上下键暂时无响应，随后熄屏，再按冠恢复表盘。生命周期修复已有自动测试和原生隐藏/重显场景覆盖；该型号退出卡顿仍待安装当前包复测，并采集相应设备日志。

### Wear Engine 材料及网页

当前材料统一位于：
`harmonywatch/artifacts/outputs/opengym-wearengine-resubmission-20261031/`。

- 用途表：openGym-WearEngine-usage-20261031.xlsx。
- 授权表：openGym-WearEngine-authorization-20261031.xlsx。
- 权限为 DEVICE_MANAGER、NOTIFY，各有用途说明；授权表包含连接、开启通知、授权结果、测试和关闭通知的步骤。
- 11 张配图：3 张手机真机图、5 张 FIT 真机图、3 张流程图；P04/P05/U01 展示回传确认、通知授权和双端提醒流程。
- 两份 Excel、配套说明和流程图已统一为直接描述功能、展示内容和进度的文字，保留原作者与许可。
- 华为网页已保存手表应用介绍、备注和手机应用介绍、新版本说明；Wear Engine 功能说明已核对。2026-11-13 审批通过，待真机验证。
- 授权表曾打开为空白，根因是工作簿窗口被保存为 visibility="hidden"。已在 Excel 恢复显示并保存，关闭重开正常，单元格和 3 张嵌图保持一致。后续 Excel 自动化保存需检查窗口可见状态和实际显示内容。

Wear Engine 已于 2026-11-13 审批通过，DEVICE_MANAGER 与 NOTIFY 均开通。实际计划下发、记录回传、动画传输、NOTIFY 授权、通知声音/振动和后台时效仍待双端真机验证。

### Agent 配置及清理

本次清理删除项目内 910 个旧生成文件，270,827,905 字节（约 258.28 MiB）：旧申请目录、材料备份、旧修复包与重复 HAP 别名、历史诊断/预览、旧 Android APK 输出及临时 BIN/HAP。逐项清单为 `harmonywatch/artifacts/CLEANUP_20261101.json`。

当前三个安装包、两份申请表、原始手机/手表截图、当前原生场景和验证记录、签名材料及离线文档保留。源码、依赖和当前构建缓存保留。项目内安装包及申请表的清理前后 SHA-256 一致。

### 工作树回退与恢复（已完成）

Git 记录显示 2026-11-01 16:00:42 执行过 reset 到 HEAD，之后一度只剩 84 项测试。用户确认没有主动回退，并要求恢复更改。

已从本机原始会话日志按顺序重放交互、生命周期、语言压缩、结束页和抓帧检查补丁，恢复新增 crown 模块、交互测试及两份材料工具脚本，再重新生成译文并暂存 PPL 工程。恢复后 94 项测试全部通过，release 构建成功；编译 app.js、页面 index.js 的 SHA-256 与保留的 11:33 签名包记录逐字节一致。工作树继续保留恢复后的修改。

恢复结果见 harmonywatch/artifacts/SOURCE_RECOVERY_20261101.json；项目外另存恢复补丁。旧生成物清理结果保持完成，当前安装包和申请表哈希保持一致。

## 2026-11-02 至 2026-11-03：后续修正

- 表冠：步进后的锁定从 250 ms 提到 450 ms，锁定期间到达的角度直接丢弃，一次转动只跳一格；取消逐格震动（平台只提供通知式短/长震）。表冠按压卡顿（U13）改用空闲页长按 2 秒打开的 debug 页取证，显示最近 7 条 show/hide 时间戳。
- 休息结束前台提醒改为两轮、每轮在 0、2、4 秒各请求一次长振，约 14 秒后自动停止；触摸或转表冠立即停止。
- 手机 HUAWEI FIT 设置页的包名与指纹输入框改为标签在上、深色输入框在下的统一布局（U16）。
- 材料截图统一为简体中文界面（U18）。动作名英文括号改为按语言决定默认值：`zh`、`zh-TW` 默认不显示，其他语言保留，设置页仍可逐语言手动开关（U17）；手机发送给手表的是格式化后的名称，默认值改动同时覆盖手表快照。
- 空闲页的取证入口和心率开关在首个状态到达前不再抛异常。
- 两个手表变体按当前源码重新编译并重签，通过 hap-sign-tool verify-app、verify-hap.py 和 verify-lite-bin.py 全套校验，HAP 内可执行文件哈希与发布 BIN 相等；手表测试 95 项通过。构建记录见 `harmonywatch/artifacts/BUILD_20261102.json` 与 `BUILD_20261103.json`。

## 当前验证

2026-11-03 重新执行：

```bash
node --test frontend/harmony/tests/*.test.js
node scripts/harmony/check-size.mjs
```

结果：95 项通过，0 失败。PPL app.js 为 49,071 B，页面 index.js 为 49,092 B；每文件上限 49,152 B，余量分别 81 B、60 B。首次启动包 app.js 为 47,068 B。

现存 2026-11-01 原生预览覆盖训练、重量编辑、休息提示、结束、隐藏后重显及两种启动场景，记录为无 JS 异常。实际马达反馈、持续亮屏和系统通知声音待 FIT 复测。

当前包哈希与既有 HAP/BIN 记录一致。既有签名检查包含固定叶证书 CMS、Profile、分块摘要和权限结构，payload/Profile/CMS 签名/trailer 四种篡改检查通过。清理时再次按哈希核对保留文件。

主要证据位于 harmonywatch/artifacts：

- CONTROLS_VERIFICATION.json、CONTROLS_BIN_VERIFICATION.json。
- STARTUP_SCENARIOS_VERIFICATION.json、TEST_PLAN_BUILD.json、FIRST_LAUNCH_BUILD.json。
- ANDROID_VERIFICATION.json、REST_NOTIFICATIONS_VERIFICATION.json。
- SIGNING_VERIFICATION.json、SHA256SUMS.txt。
- 当前申请目录的 VERIFICATION.json。

## 源码及构建入口

模板源码：`frontend/harmony/watch/entry/src/main/js/default/`。
DevEco 编译源码：`harmonywatch/entry/src/main/js/MainAbility/`。
修改交互时核对两处及 prepare.mjs 的暂存结果；生成工程当前带测试 PPL，模板正常初始 ready 为 null。

关键模块：

- common/crown.js：表冠阈值、节流和触感请求。
- common/controller.js、runtime.js、sdk-ready.js：通信、存储、平台生命周期。
- pages/index/index.js、index.hml、index.css：页面、编辑按钮和休息提醒。
- frontend/harmony/tests/interaction-fixes.test.js：本轮交互与生命周期回归。
- frontend/android/app/src/main/java/ch/duartesantos/opengym/HuaweiWatchPlugin.java：Android Wear Engine 桥接。
- 同目录 WatchRestAlerts.java、WatchRestAlertReceiver.java：手机定时和手表通知。
- frontend/src/views/HuaweiWatchSettings.jsx：手机连接与通知设置。
- frontend/src/lib/watch-sync.js：手机训练同步。

Windows 构建：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\harmony\build-test.ps1 -DevEcoRoot "E:\Program Files\Huawei\DevEco Studio"
```

个人测试包不再预存训练计划，初始状态由手机快照填充；退出流水取证追加 `-Forensics`。`-FirstLaunch` 与 `--builtin-plan` 已移除。

构建入口执行 release 优化、48 KB 检查和 Lite BIN/HAP 打包；侧载交付继续使用本机已有证书、Profile 和签名流程。目标设备类型为 liteWearable，requiredDeviceType 与之匹配。

Android 构建入口为 scripts/harmony/build-android.sh，使用 JDK 21、个人包名和登记 APP ID。私钥、密码保留在本机既有位置。该工程若曾在 Windows 侧构建，Gradle 增量状态会记下 D:\ 路径，回到 WSL 重编会以 mergeSideloadDebugResources 空指针失败；先执行 :app:clean 或删除 frontend/android/app/build 再构建。

当前 HEAD 为 1851faded；表冠、独立小数按钮、长振和退出清理等后续修改仍在工作树。实际差异通过 git status、git diff 查看。最近两天涉及手表模板、DevEco 工程、Android 桥接、手机设置/同步、测试和构建工具；NAS 服务及后端 API 沿用现有实现。

## 接续工作

按用户最新需求选择对应工作：

1. 安装当前 PPL 包，复测表冠单步/短振、四个重量按键、休息长振及确认取消、按冠退出。若仍卡顿，收集调测助手同一时段日志。
2. 服务和用户授权完成后，验证计划、动画、事件确认/去重、断连重试及记录补传。
3. 验证 NOTIFY 开关、授权、测试通知、精确闹钟、取消/延长及后台送达；记录真实声音、振动和勿扰设置。
4. 系统力量训练、热量、华为运动健康写入和离开应用后的独立准时提醒处于后续阶段；表盘组件、Smart Stack 已取消。
5. 材料直接维护当前 resubmission-20261031 目录。scripts/harmony/update-wearengine-materials.py 是早先的一次性生成工具，仍含旧文案和旧输出目录，后续使用前需更新。申请提交和应用发布由用户另行安排。
6. harmonywatch/artifacts/appgallery-screenshots/ 是暂未使用的商店素材（当前完全不上架）；其中动作库列表仍是 2026-11-03 之前的“中文 (English)”格式，将来上架前需按新默认重新生成。
