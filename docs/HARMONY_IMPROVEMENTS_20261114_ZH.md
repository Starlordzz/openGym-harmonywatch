# 2026-11-14 改进与验证记录

基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym)；本版本为第三方华为手表 / HarmonyOS 适配，代码沿用 AGPL-3.0-or-later。

## 2026-11-15 最新：取消华为心率，核实开发者平台条件

用户要求没有可用权限就取消心率，并明确所问是华为开发者平台。已核实：Health Service Kit 个人开发者应用须上架华为应用市场；Wear Engine SENSOR 原始 ECG／PPG／HR 仅向专业研究机构受限开放。旧实现使用本地 Lite 传感器；其 E602 的具体设备权限原因仍未确定。官方来源、三条链路和版本差异见[心率权限说明](harmony/HEART_RATE_GUIDE_ZH.md)。

当前 HA6 已移除手表心率开关、训练／休息／汇总读数、原生采集及动态授权入口和 READ_HEALTH_DATA 声明；手机华为设置移除“显示心率”，华为快照固定隐藏。恢复旧存档时清除 sensorEnabled；既有历史心率字段与未同步事件保留。重量居中、训练、休息震动、常亮与离线同步继续保留。B19 按用户决定取消；HA5 已获“已恢复正常操作”的实机确认，HA4 继续隔离，后续开发以无心率版本为基线。

手表 146 项、手机相关 27 项通过；Android 构建、原生启动、通信、功能移除门禁及签名检查通过。训练、离线休息与结束页原生预览通过。app 47,701 B、page 47,307 B，各余 1,451 / 1,845 B（48 KiB 上限）。新 APK 已通过 ADB 覆盖安装原测试手机；HAP 已推送 `/sdcard/haps/openGym-HuaweiWatch-no-heart-signed.hap`，需调测助手覆盖安装后实机复测训练操作。

HAP 681,090 B，SHA-256 `b24bd495d392feb32ef027e92bbae75b626300b4a06b780731fad3761983fd38`。构建与测试证据为本地 `harmonywatch/artifacts/*20261115_NO_HEART*`、`SIGN_20261115_NO_HEART.log`、`DELIVERY_20261115_NO_HEART.json`、`ui-*-no-heart-preview/`。原生权限和心率探测已停止，剩余任务为 B20／B21 布局与结束操作、B3–B9 训练稳定性和休息同步实机验收。

以下为历史排查记录；当前状态以本节及[缺陷状态表](HARMONY_OPEN_BUGS_ZH.md#当前状态)为准。

## 2026-11-15 接续：HA5 恢复，HA4 撤回

用户确认 HA4 关闭再开启心率直接卡死（B23）。HA5 已删除运行时原生心率与 FA 权限入口，旧开启配置和手动切换只返回 PAUSED；训练、常亮及已实机通过的重量居中保留。HA4 的 HAP 已在本机和手机更名为 WITHDRAWN.hap.disabled。

151 项回归、原生启动/debug、通信和恢复门禁通过；签名 BIN 已验证不含两个原生模块及权限请求函数。恢复包 `/sdcard/haps/openGym-HuaweiWatch-HA5-recovery-signed.hap` 已推送并核对哈希，用户已确认“已恢复正常操作”，恢复验证通过。页面与 HA2 同字节，app/page 余 1,090 / 68 B。

历史阶段心率尚未修复；当前已按用户要求取消，平台核查与无心率版本见本页最新进度。用户版本原文 `26.0.0 hm7`，本机 Js SDK 26.0.0.105 / API 26。详情见[缺陷进度](HARMONY_OPEN_BUGS_ZH.md)。

## 2026-11-15 HA4（已撤回）：直接权限对象适配

HA3 用户返回字段原文 `verifypermissionrequestpermsissionsfromuser`。本地以 verifyPermission / requestPermissionsFromUser 直接导出的对象复现相同 K 列表；HA4 已兼容直接 Context、getContext() 与默认导出。真实授权和采样仍待 HA4 结果。

155 项手表回归、压缩前后五条对象/授权链路、原生启动与 debug 通过。新包 `/sdcard/haps/openGym-HuaweiWatch-HA4-signed.hap` 已签名推送并核对哈希；app/page 余 14 / 68 B。重量已实机确认正常，页面与 HA2 同字节。用户版本原文 `26.0.0 hm7`，本机 Js SDK 26.0.0.105 / API 26；完整证据见[缺陷进度](HARMONY_OPEN_BUGS_ZH.md)。

## 2026-11-15 接续：HA3 导出兼容诊断

重量居中已由用户确认通过。HA2 的 `FA permission API unavailable` 仍需排除模块导出形式：新增回归复现 `{ default: api }` 会被误判，HA3 已解析默认导出，缺少接口时输出 `K:` 的 Context／模块字段。实际固件支持与传感器权限链路仍待确认。

154 项手表回归、压缩前后四种导出/授权分支与原生启动/debug 通过；页面字节与 HA2 相同。新包 `/sdcard/haps/openGym-HuaweiWatch-HA3-signed.hap` 已签名推送并核对哈希，app/page 余 15 / 68 B。等待 HA3 诊断；用户回传版本原文为 `26.0.0 hm7`，真实采样仍待修复，详见[缺陷进度](HARMONY_OPEN_BUGS_ZH.md)。

## 2026-11-15 接续：HA2 居中与稳定诊断

上一版实机无授权弹窗、未见授权诊断，重量数字偏移。HA2 已改为数字居中、单位单独定位；原生零值和小数笔画中心为 111 / 111.5 px，目标 112 px。新增回归复现心率错误被连接错误覆盖，现独立保留诊断；debug 跨状态刷新保持，长按动作名称可进入，点击关闭。状态行带 `HA2`，下方为 WAIT / OK / SENSOR 或原始失败码及文字。

手表 153、手机页面 8 项通过；原生启动、居中和稳定 debug 场景通过。新包 `/sdcard/haps/openGym-HuaweiWatch-HA2-signed.hap` 已签名推送并核对设备哈希；app/page 为 49,124 / 49,084 B，仅余 28 / 68 B。用户已安装 HA2 并回传 `FA permission API unavailable`，重量显示正常。B22 实机通过；HA2 未获取到 FA Context 授权入口，HA3 补充默认导出兼容后继续核对实际模块结构。真实心率采样和结束页实机效果仍待确认。完整交付、证据与测试步骤见[缺陷进度](HARMONY_OPEN_BUGS_ZH.md)。

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

手表包 `openGym-HuaweiWatch-controls-signed.hap` 已完成签名、Profile、BIN 分块与容器校验；689,283 B，SHA-256 `a112d71b60200a0ce441c90227f162694e9c5fffe33806e91ec0382ea5055a6f`。HAP 内 BIN 与签名单独文件一致，包含本次 app/page 字节。手机 APK 签名仍为已登记的 [本机证书摘要已省略]。用户指定继续使用原测试手机，最新回复为稍后重新连接；本轮 APK 覆盖安装与 HAP 推送待该手机连接后执行。

本机证据：`harmonywatch/artifacts/BUILD_20261114_LAYOUT_END.json`、`BUILD_20261114_LAYOUT_END_ANDROID.json`、`TEST_20261114_LAYOUT_END_WATCH.log`、`TEST_20261114_LAYOUT_END_PHONE.log`、`TEST_20261114_LAYOUT_END_QUEUE.log`、`SIGN_20261114_LAYOUT_END.log`、`RING_MOTION_20261114_FINAL.json`。下一步安装两端新包，确认结束训练是否仍退表盘、手机/手表加组往返、休息圈与暂停、心率实际读数。原生工具新增 `prepare-ui-preview.mjs`（独立副本、合成训练/离线休息/结束场景）和 `check-rest-motion.ps1`（按 JPEG 弧端位置检查亚秒变化）；生产包保留真实存储和通信。

## 2026-11-14 此前实机确认：启动与通信恢复（B13 / B14）

用户确认 `boot-return` 包正常打开、原有 Full Body 计划可显示；调试页为 `sdk:? rx:off tx:-`，后面没有错误文字。这是修正前的读数。安装 SDK 回调修正包后，用户回复“好了”，确认本轮通信恢复；B13 启动黑屏与 B14 通信初始化回归均已通过实机反馈。修正后的具体 sdk/rx/tx 数值尚未回传。

已定位到构建后的实际代码：SDK 原始版本查询传入有效 `complete` 回调，二次 Terser 压缩后变成 `complete:function(){}`。回调无法写入客户端版本，SDK 就绪等待超时，接收器未注册，手机发送返回 206。旧 training-fix 包保留有效回调。逐项关闭优化验证后，`reduce_vars=false` 保留回调；SDK 源文件保持原始字节。

构建流程已关闭 `reduce_vars`，新增实际编译 app.js 的异步通信门禁：延迟返回版本 402，再验证接收器注册与 hello 发送 207。旧故障产物在同一门禁得到 `sdk:? rx:off tx:-` 并超时；修正后压缩前、后均为 `sdk:402 rx:ok tx:207`。手表 133 项通过，原生启动 2 帧、3197 可见像素、无 JS 异常。app 47,743 B、页面 49,097 B；每份上限 49,152 B，页面余量 55 B。

修正包 `/sdcard/haps/openGym-HuaweiWatch-sdk-callback-signed.hap` 已签名校验并通过 ADB 推送，手机端文件哈希一致；大小 685,186 B，SHA-256 `591b5dd463742ce7279711b7735ce65bc4c62635ce333e591470dece99f2a90e`。HAP 内 BIN 与独立签名 BIN 一致，BIN 包含本次编译 JS。用户随后回复“好了”，本轮通信恢复已确认。对应代码提交为 `对应历史提交`。

手机继续使用已安装的合并版 APK。本轮已核验实际 APK 签名、已授权权限、保存的 112 字符 Lite 对端身份与手表配置一致；修正前手机接收器已注册，收到 0 条、发送 206；修正后用户确认恢复。证据：`harmonywatch/artifacts/BUILD_20261114_SDK_CALLBACK.json`、同名 `.log`、`TEST_20261114_SDK_CALLBACK_WATCH.log`、`SIGN_20261114_SDK_CALLBACK.log`、`PHONE_STATUS_20261114_BOOT_RETURN_206.json`。签名、身份配置和设备日志保留本地。

接续顺序：使用已确认恢复通信的 SDK 回调修正包，复测手机开始训练时手表自动进入与震动、双向 ±15 秒和暂停/继续，再继续 B3/B5/B6/B7/B8 的训练稳定性与计时测试。

## 2026-11-14 启动黑屏排查记录（B13，后续实机已确认打开）

用户覆盖安装 `openGymFIT-merged-signed.hap` 后，打开应用立即黑屏，并回报 206。已覆盖恢复到 `openGymFIT-training-recovery-signed.hap`（与此前 training-fix 字节相同），用户确认可以打开；此后用户安装 boot-return 包并确认正常打开，详见最新进度。

原生 Lite 预览器已复现 `TypeError: wrong type of argument`。已定位：Terser 的默认语句压缩丢弃了顶层 IIFE 的完成值，压缩后 app/page 的求值结果由 ViewModel 对象变成 boolean；旧等价检查仅比较构造参数，漏掉加载器实际消费的返回值。

修正为 `compress.expression=true`，并要求 bundle 求值结果等于刚创建的 ViewModel；新增回归已先失败、修正后通过。发布构建在预览器及配置可用时执行原生启动检查，失败即停止打包。官方选项说明见 [Terser expression](https://terser.org/docs/options/)。

修正版手表 131 项通过；原生启动 2 帧、可见像素 3197、无 JS 异常。app 47,574 B、页面 49,045 B，均低于 49,152 B。手机 APK 继续使用已安装的合并版；修正版 `openGym-HuaweiWatch-boot-return-signed.hap` 已签名推送到 `/sdcard/haps/`，设备文件 SHA-256 与本机一致：`3b644308467bdc78dbcae23a8d00ba13319715d98b9038942423c6e4b19e3a8b`。实机随后确认正常打开，通信仍为 206；当前修正见 B14。证据：`harmonywatch/artifacts/BUILD_20261114_BOOT_RETURN.json`、`BOOT_RETURN_NATIVE_PREVIEW.log`、`TEST_20261114_BOOT_RETURN_WATCH.log`。

## 合并版交付记录（B13 启动修正见上节）

上游 main `68dad18f8` 已合并并推送。手机合并版已于 16:12 ADB 安装，手表合并版已推送到 `/sdcard/haps/openGymFIT-merged-signed.hap`；16:30 复核设备文件哈希一致，手表覆盖安装和新功能实机验收待进行。

本轮代码已完成：手机开始训练请求唤起手表，新训练落盘后进入训练界面并长震一次；手表 ±15 秒、暂停/继续双向同步；128×128 演示图、可滚动计划列表提示与“心率：开 / 关”。偶发退表盘、震动强度感受和两端计时差异仍需实机结果。

合并后手机 7862、服务端 804、手表 130、MCP 138 项通过。README 仅保留项目说明、功能、兼容状态、构建、目录和许可；项目面向圆表、方表等华为手表。

## 本轮功能

- 手机端修正 HarmonyOS 5.0+ Lite 对端身份为“包名_Base64(EC 公钥)”，精确迁移旧证书 SHA-256 配置。双向通信和 Full Body 计划保存恢复已由用户确认。
- 双文件持久化替代超出 128 B 的 KV 状态；保存合并、快照串行、动画整组保存与旧帧保留，减少重复写入。
- 手表切换/跳过休息通过 navigate 事件通知手机。用户确认两端动作一致。
- 新增训练接收反馈：手机开始时一次 ping 请求唤起，hello 确认后发送快照；手表新任务落盘后进入训练页并长震一次，重复快照/页面重显不重复震动。
- 新增手表休息 −15 秒、+15 秒、暂停/继续，绝对休息状态回传手机；手机优先控制消息保留当前发送队首，session/rev 防止旧快照覆盖新休息。完整快照继续承担恢复。
- 动画 96×96→128×128，页面刷新间隔 125→250 ms；休息日列表 96→220 px，并增加滚动提示、数量及下一项局部露出，心率开关显示开/关。
- 休息结束前台提示增加为两轮、每轮 4 次 long，触摸/表冠/隐藏可停止。系统通知转发已移除，旧排程升级清理；前台常亮保留。
- SDK 自带 Terser 优化 ES5 JS；校验编译和打包文件一致、ViewModel 属性、原 12 种语言和休息显示，随后执行 48 KB 门禁。

## 自动验证与实机状态

本轮手表 130、手机相关 166、原生发送队列 2 项通过。原 12 种语言逐份展开哈希保持一致，新控件复用手机翻译。编译 app.js 47,277 B、页面 49,017 B；每份上限 49,152 B。签名、Profile、BIN 分块摘要及包内容核验通过。

| 产物 | SHA-256 | 状态 |
|---|---|---|
| `openGym-HuaweiWatch-training-v2-debug.apk` | `c178d32c4ae978a666a207e29c6a9184e0d476eb4ea8a3f2d6ff0c80976576c3` | 已构建验签，手机稍后连接后安装 |
| `openGymFIT-training-v2-signed.hap` | `6a4ad945061a84f0ec06651850ca73b34162f542bd45c69854c61ae90ba4518a` | 已签名；手机稍后连接后推送 |

以上产物位于本机 `harmonywatch/artifacts/`。当前真机仍为 training-fix；新版实际唤起、接收震动、休息控制、图像布局和稳定性待验收。此前偶发退表盘仍开放；关闭动画后暂未观察到退出，继续做对照。手机与手表计时差异的实测、时钟偏移校准待确认。

## 目录与项目说明

README 改为 Android + 华为手表项目说明；圆表、方表等华为手表均为适配目标，当前已验证 FIT 5 Pro，其他型号及运行时见[兼容性记录](harmony/COMPATIBILITY_ZH.md)。AGENTS.md、CLAUDE.md 同步定位。

增加 `docs/harmony/` 文档索引与兼容性记录、`scripts/harmony/README.md` 脚本索引、`harmonywatch/README.md` 工程说明；保留现有需求/进度入口与构建路径。清理根目录空 `file_system/` 和只有空日志的 `.hvigor/`，补充忽略规则。安装包、设备日志、身份 JSON、签名和申请资料保持本地；公开进度文档纳入源码。

## 上游与发布

已获取 `DuarteSantos8/openGym` 的 `main`：`68dad18f8`，相对当前基线 `5fdb229fe` 有 310 个上游提交。合并已完成并推送，冲突已解决。

合并后的修正：

- 生成物与测试比较前统一换行符：`api/coach/prompts/*.md`、`nudge-copy.js`、`wrapped-copy.js` 在 CRLF 检出下不再误报过期；新增 `.gitattributes`（`* text=auto eol=lf`，SDK vendor 目录保留原始字节），使 Linux、WSL 与 Windows 检出的文本字节一致。
- `frontend/vite.config.js` 显式声明 vitest 的 `include`（`src/**`、`scripts/**`）：`harmony/tests/` 是 `node:test` 套件，不再被 vitest 收集成无测试的失败文件。7862 项 vitest 全部保留，文件数由 674 降为 655，差额正好是 19 个 `node:test` 文件。
- `frontend/src/lib/harmony-page.test.js` 的 mock 补齐 `keepScreenOn` 并在 `onInit` 后调用 `onShow`；`对应历史提交` 已将粗调步进改为固定 ±1（细调 `editFineBy(0.1)`），用例期望由 22 更正为 21。
- 华为设置页 CSS 类由 `.hw-*` 改为 `.watch-*`，避免与 Halloween 主题的 `.hw-*` 前缀冲突。
- `app-icons.mjs --check` 对文本产物按换行归一比较，PNG 仍逐字节比较；慢盘测试使用 30 s 超时与 6 个 vitest worker。

合并后验证：服务端 804 项、手机界面 7862 项（655 个文件）、手表 130 项全部通过；`build-nudge-copy`、`build-wrapped-copy`、`build-coach-assets` 的 `--check` 均一致。

手机 APK 使用 `HARMONY_ANDROID_ASSET_CACHE` 将 244 MB/13,281 个 Web 资源暂存到 WSL 缓存后构建，Gradle 34 分 5 秒、209 个任务，`BUILD SUCCESSFUL`。核对结果：包名 `host.msknet.opengym.phone`、versionCode 31、versionName 1.4.4、minSdk 24、targetSdk 36；23 项权限；v2 签名，调试证书 SHA-256 `f67feedf…eb48e1ae`；14048 个 zip 条目、12 个 dex，包含 HuaweiWatchPlugin 与 Wear Engine 类；包内无 keystore、身份 JSON、`.map` 或私钥标记。证据见 `harmonywatch/artifacts/BUILD_20261114_INTEGRATED.json` 与同名 `.log`。

| 产物 | 大小 | SHA-256 | 状态 |
|---|---|---|---|
| `openGym-HuaweiWatch-merged-debug.apk` | 240,344,553 B | `e748bf42b9e4020aa968edba1b9c5948fa3e71c817a70a6b8c6b4460d77e84c5` | 已 ADB 覆盖安装（versionCode 31）；桥接 paired/installed/receiverRegistered 均为 true |
| `openGymFIT-merged-signed.hap` | 685,185 B | `972ce55f2aa2d062f6a67e1b1627d5d0a21063f59da781cfa607c482d859b6fb` | 已签名验签并推送 `/sdcard/haps/`，待手表覆盖安装 |

合并提交 `对应历史提交` 已推送到 `origin/main`。推送前复核暂存内容：无 keystore、调试身份 JSON、私钥、令牌或 `.map`；包内仅含公开的 `huawei_app_id`。`.gitattributes` 随合并提交纳入版本管理。

### 列表与心率说明补充（2026-11-14）

用户反馈两行计划列表难以识别可滚动。已增加“上下滑动选择计划”提示和计划数量；列表高度保留下一项局部露出，指示可继续滚动。实际显示待安装复测。

底部“心率”是训练期间的应用心率采集开关，开关状态显示为“心率：开 / 关”。开启后在训练中订阅手表心率传感器，关闭停止应用采集；当前心率值在训练页顶部显示。空闲页按钮显示开关状态，空闲期间不持续采集。

界面仅保留功能名称、状态与操作提示；取消装饰箭头和装饰性文案。
