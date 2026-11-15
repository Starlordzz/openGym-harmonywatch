# Apple Watch 与华为手表功能对比

更新：2026-11-15。Apple Watch 列依据本仓库保留的上游 Swift / WatchCore 源码核验；华为列依据当前 Android + Lite Wearable 源码、自动测试及用户实机反馈。原项目作者为 Duarte Santos（[DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym)）；本分支为第三方华为手表适配，当前开发维护 Android 与华为端。

“已实现”表示存在完整代码路径；“实机通过”表示用户已反馈对应操作正常；“本轮新增”表示本轮代码已接入、安装后仍待真机验收。华为已验证设备为 FIT 5 Pro，圆表、其他方表及不同运行时的验证状态见[兼容性记录](COMPATIBILITY_ZH.md)。

## 计划、训练与编辑

| 功能 | Apple Watch 原版 | 当前华为版 | 依据 |
|---|---|---|---|
| 配套手机 | iPhone、WatchConnectivity | Android、Wear Engine；连接权限由手机授权 | A1、H1 |
| 今日安排与其他训练计划 | 已实现 | 已实现；Full Body A/B/C 优先级和退出重开保存实机通过；列表可滚动 | A1、H2 |
| 首次无计划引导 | 提示打开手机应用同步 | 已实现，首次启动无预填演示计划 | A1、H2 |
| 手表独立启动已缓存计划 | 已实现 | 已实现，离线事件落盘后补传 | A2、H3 |
| 手机开始后同步训练界面 | 已实现，系统运动会话参与启动 | 已实现一次唤起请求、握手后下发；新任务落盘后长震一次，实际唤起待验证 | A2、H1、H4 |
| 开始前称重、保存或跳过 | 已实现 | 已实现，整数与小数位编辑 | A1、H2 |
| 开始倒计时 | HealthKit 开启时 3-2-1 | 已实现 3-2-1 | A2、H2 |
| 重量 / 次数 / 计时组 | 已实现 | 已实现 | A3、H3 |
| 徒手与附加重量 | 已实现 | 已实现 | A3、H2 |
| 有氧动作 | 引导在手机记录；系统运动另有类型映射 | 同样提示手机记录；系统有氧运动会话尚未接入 | A3、H2 |
| 单侧 L/R 组 | 已实现逐侧完成 | 已实现逐侧完成，单侧计时按独立行处理 | A3、H3 |
| 超级组轮转与组间休息 | 已实现 | 已实现 | A3、H3 |
| 热身组标记 | 已实现 | 已实现 | A3、H2 |
| RPE / RIR | 手机配置后可编辑 | 已实现努力度编辑与事件回传 | A1、H2、H4 |
| 上次记录、动作纪录 | 已实现 | 已实现，是否显示由手机设置控制 | A1、H2、H4 |
| 重量、次数、秒数编辑 | 点数字进入编辑页；表冠与加减键 | 已实现；重量提供 ±1 与 ±0.1 | A1、H2 |
| 表冠导航 | 动作分页与数值编辑 | 11-15 按用户要求停用旋转控制；动作保留滑动、数值保留屏幕按钮 | A1、H2 |
| 动作切换与手机位置跟随 | 已实现 | 已实现；用户确认两端动作一致 | A2、H4 |
| 跳过组、重新选择未完成组 | 已实现 | 已实现长按完成键跳过、点组圆点重新选择 | A1、H2、H3 |
| 手表加一组 | 当前 Watch 视图未提供追加组入口，手机可加 | 本轮新增当前动作加组；普通组复制目标，单侧计时成对追加；回传去重并保护未同步新组 | H2、H3、H4 |
| 手动结束、保存、丢弃、取消 | 已实现 | 已实现；结束文字完整，“继续训练”改为全宽主按钮 | A1、H2、H3 |
| 长时间无操作提醒 | 20 分钟询问、45 分钟自动结束 | 已实现相同阈值 | A2、H3 |

## 休息、屏幕与反馈

| 功能 | Apple Watch 原版 | 当前华为版 | 依据 |
|---|---|---|---|
| 休息数字 / 圆环样式 | 已实现；按系统时间线刷新 | 已实现；11-15 用户反馈明显问题，平滑方案暂停；恢复系统圆环与秒级倒计时 | A1、H2 |
| 下一动作提示 | 已实现 | 已实现；本轮缩紧休息页，离线提示出现时也保留控制区 | A1、H2 |
| 休息 +15 秒 / 跳过 | 已实现 | 已实现；双端操作待本轮复测 | A1、H2、H4 |
| 休息 −15 秒、暂停 / 继续 | 原版休息视图为 +15 秒和跳过 | 华为新增双向绝对休息状态；已覆盖顺序与暂停自动测试，真机待验收 | A1、H4 |
| 休息自然结束震动 | 前台触觉与本地通知 | 前台两轮各 4 次 long；强度由设备决定，用户仍反馈偏弱，待验证 | A2、H2 |
| 接收新训练确认震动 | 未核实独立的接收确认脉冲 | 华为新增持久化成功后一次 long；重复快照和重开不重复 | H4 |
| 后台休息系统通知 | 已实现 watchOS 本地通知 | 用户取消；手机 Wear Engine 通知转发已移除 | A2、H1 |
| 前台保持亮屏 | watchOS 系统常亮与降亮状态适配 | 已实现应用前台 keepScreenOn；用户确认常亮，盖屏/离开后行为待持续验证 | A1、H2 |
| 系统锁定 / Water Lock | HealthKit 会话运行时调用 watchOS Water Lock | 用户本轮取消华为应用内锁；入口与旧锁定状态影响已移除 | A1、H2、H3 |
| 计时组启动与提前停止 | 已实现 | 已实现，记录实际秒数 | A1、A2、H2 |
| 休息结束后自动启动计时组 | 已实现，可由手机设置 | 当前华为页面结束休息后提示下一组，自动启动尚未接入 | A2、H2 |
| 休息计时两端一致 | 使用共享截止时刻 | 已改为共享 deadline 与 ceil；原 1–2 秒差异待实机复测 | H4 |

## 同步、动画与恢复

| 功能 | Apple Watch 原版 | 当前华为版 | 依据 |
|---|---|---|---|
| 双向计划与训练记录 | WatchConnectivity 快照和事件 | Wear Engine 分片、确认、持久队列；通信和计划恢复实机通过 | A2、H1、H4 |
| 离线训练与重开恢复 | 本地持久化与连接后发送 | 双槽文件、短 KV 索引；Full Body 计划重开仍在实机通过，完整离线训练补传待验证 | A2、H3、H4 |
| 已保存、稍后同步提示 | 已实现 | 已实现；本轮缩紧离线休息页提示占位 | A1、H2 |
| 事件去重与迟到记录 | 已实现 | 已实现，先保存再确认；本轮扩展加组事件 | A2、H1、H4 |
| 手机结束后的手表汇总 | 已实现并标明在手机结束 | 已实现；用户报告退表盘、旧休息短暂恢复，本轮新增优先结束消息和提前刷新，稳定性待实机复测 | A1、H1、H4 |
| 动作演示动画 | 手机传 GIF，手表解码缓存 | Android 转最多 16 张 PNG；手表显示 128×128，整组收齐替换旧帧 | A2、H1、H5 |
| 动画传输控制 | 当前动作动画、非活动页面暂停 | 图片与控制共用队列；本轮结束训练优先、取消未发帧、延后串行清理手表文件 | H1、H4、H5 |
| 断连、失败与重试 | 本地队列与 WatchConnectivity 重试 | 已实现持久事件、hello、15 秒通信重试；实际断连恢复和训练稳定性待验证 | A2、H4 |
| 载荷限制 | 原版快照按通信层传递 | 活动训练数据优先；其他计划通常最多 8 个，48 KiB 预算紧时裁减 | H4 |

## 心率、系统运动与界面

| 功能 | Apple Watch 原版 | 当前华为版 | 依据 |
|---|---|---|---|
| 训练实时心率 | HealthKit 系统运动会话采样 | 应用直接订阅手表传感器；本轮把开关与读数放在训练页、休息页，实机读数待确认 | A4、H4 |
| 心率状态反馈 | 随 HealthKit 与权限状态显示 | 心率关 / 测量中 / 暂无数据 / 不可用 / 当前 bpm；点击文字切换，手机“显示心率”控制可见性 | H2、H4 |
| 组、休息阶段心率 | 已实现 | 已实现采样窗口与回传，端到端真实数值待验证 | A2、H4 |
| 汇总平均 / 最高心率 | 已实现 | 已实现，15 秒无新样本时当前读数失效 | A1、H4 |
| 系统运动会话 | HealthKit，力量训练及多种有氧类型 | 尚未接入华为系统运动会话 | A4、H6 |
| 热量与健康数据库写入 | HealthKit 活动能量与训练保存 | 热量和华为运动健康写入暂未启用 | A4、H6 |
| 后台会话恢复 | 已有 HealthKit 会话恢复路径 | 应用本地训练恢复已实现；退出应用后不持续采集心率 | A4、H2、H4 |
| 表盘组件 / Smart Stack | 动态训练组件、休息计时、今日计划与启动入口 | 用户已取消，当前无华为实现 | A5、H6 |
| 多语言 | 源码含 19 个 locale | 保留 12 种语言，其他回退英文；简繁中文与葡语地区映射已实现 | A2、H6 |
| 系统可访问性 | VoiceOver、Dynamic Type 等 SwiftUI 接口 | 固定 Lite 布局与点击控件；同等级读屏和动态字号尚未覆盖 | A1、H2 |
| 圆形与方形外观 | 随支持的 Apple Watch 屏幕布局 | 华为圆表与方表均为目标；当前固定 408×480 Lite 布局，FIT 5 Pro 已验证，其他屏幕待适配 | H2、兼容性记录 |

## 源码依据

- A1：[Apple Watch 页面](../../frontend/ios/App/Watch/OpenGymWatchApp.swift)，包括 LockButton、训练编辑、RestView、结束与汇总。
- A2：[Apple Watch SessionStore](../../frontend/ios/App/Watch/SessionStore.swift)，包括持久化、同步、计时、提醒、动画；[SessionCore](../../frontend/ios/App/WatchCore/Sources/WatchCore/SessionCore.swift) 包含训练推进和空闲阈值。
- A3：[Apple Watch Model](../../frontend/ios/App/WatchCore/Sources/WatchCore/Model.swift) 与 [SessionCore](../../frontend/ios/App/WatchCore/Sources/WatchCore/SessionCore.swift)。
- A4：[WorkoutManager](../../frontend/ios/App/Watch/WorkoutManager.swift)，HealthKit 会话、心率、能量与训练保存。
- A5：[OpenGymWidgets](../../frontend/ios/App/WatchWidgets/OpenGymWidgets.swift) 与 [WidgetState](../../frontend/ios/App/Watch/WidgetState.swift)。
- H1：[HuaweiWatchPlugin](../../frontend/android/app/src/main/java/ch/duartesantos/opengym/HuaweiWatchPlugin.java)，授权、消息、动画、优先结束控制；[WatchSendQueue](../../frontend/android/app/src/main/java/ch/duartesantos/opengym/WatchSendQueue.java)。
- H2：华为页面 [index.hml](../../frontend/harmony/watch/entry/src/main/js/default/pages/index/index.hml)、[index.js](../../frontend/harmony/watch/entry/src/main/js/default/pages/index/index.js)、[index.css](../../frontend/harmony/watch/entry/src/main/js/default/pages/index/index.css)。
- H3：[session.js](../../frontend/harmony/watch/entry/src/main/js/default/common/session.js)、[add-set.js](../../frontend/harmony/watch/entry/src/main/js/default/common/add-set.js)、[state-storage.js](../../frontend/harmony/watch/entry/src/main/js/default/common/state-storage.js)。
- H4：[watch-sync.js](../../frontend/src/lib/watch-sync.js)、[controller.js](../../frontend/harmony/watch/entry/src/main/js/default/common/controller.js)、[heart.js](../../frontend/harmony/watch/entry/src/main/js/default/common/heart.js)。
- H5：[WatchFrames](../../frontend/android/app/src/main/java/ch/duartesantos/opengym/WatchFrames.java)、[clips.js](../../frontend/harmony/watch/entry/src/main/js/default/common/clips.js)、[file-cleaner.js](../../frontend/harmony/watch/entry/src/main/js/default/common/file-cleaner.js)。
- H6：[HuaweiWatchSettings](../../frontend/src/views/HuaweiWatchSettings.jsx)、[Lite 配置](../../frontend/harmony/watch/entry/src/main/config.json)、[语言生成脚本](../../scripts/harmony/build-locales.mjs)。

最新缺陷、构建结果与用户反馈见[缺陷进度](../HARMONY_OPEN_BUGS_ZH.md)与[交接记录](../HARMONY_HANDOFF_PROMPT_ZH.md)。代码沿用 AGPL-3.0-or-later；训练图片、动画与 SDK 分别遵循 [NOTICE](../../NOTICE.md) 及各自声明。

心率的显示与已保存记录入口见[心率说明](HEART_RATE_GUIDE_ZH.md)。11-15 已停用平滑圆环和表冠旋转；此前实现记录保留在进度文档。
