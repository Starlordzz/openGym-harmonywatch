# 本仓库 Apple Watch 功能清单

核验日期：2026-10-29。依据本仓库实际 Swift、SwiftUI 与手机同步代码；本轮为静态代码
核验，未运行 Apple Watch 真机测试。它是 iPhone 配套的训练执行与记录端。

## 1. 开始训练

- 手表选择今天的计划，或手机同步来的其他计划（最多 8 个其他计划）。
- 承接手机已经开始的训练；可设置手机开始训练时自动唤起 openGym Watch App。
- 已预同步的计划可以在手机不在旁时从手表开始。
- 默认开始前称重，可保存并开始、跳过或取消；初始值使用手机最近体重。
- Apple Health 开启时，在运动会话准备后显示 3–2–1 倒数，可立即开始或取消。
  Apple Health 关闭时，代码直接开始记组，不显示这段倒数。

来源：[IdleView](../frontend/ios/App/Watch/OpenGymWatchApp.swift#L260)、
[SessionStore.start/countIn](../frontend/ios/App/Watch/SessionStore.swift#L579)、
[buildReady](../frontend/src/lib/watch-sync.js#L131)。

## 2. 训练页面与记组

- 每个动作一页，滑动切换，显示当前组、组进度、动作名和可选的动作动画。
- 修改重量、次数；支持加减按钮和 Digital Crown 数字编辑器。
- 可显示上次记录、实时心率、训练时长及活动热量。
- 按动作自身步长调整重量，跟随手机的 kg/lb 单位。
- 长按完成按钮并确认可跳过组；跳过后仍可通过组圆点重新选择。
- 有氧动作可标记完成；有氧详细数值提示到 iPhone 记录，不提供完整腕上录入。

来源：[ExercisePage/ValueEditor](../frontend/ios/App/Watch/OpenGymWatchApp.swift#L350)、
[completeSet/skipSet](../frontend/ios/App/Watch/SessionStore.swift#L407)。

## 3. 特殊组型与强度

- 单侧动作左右分别完成，两侧之间不自动休息；双侧完成后计为完整一组。
- 相邻同组的超级组动作轮转，组内不休息，完成一轮后休息。
- 热身组有标识，可记录，但不计入工作组进度、摘要组数及训练量。
- 计时组可改目标秒数，开始后倒数，到时自动记组；可提前停止并记录实际时长。
- 根据手机资料记录 RPE 或 RIR；RPE 为 6–10、0.5 一档，RIR 为 5–0。
  有氧和热身组不显示强度评分，未主动评分时保留为空。

来源：[SessionCore.next/summary/Effort](../frontend/ios/App/WatchCore/Sources/WatchCore/SessionCore.swift#L333)、
[startHold/endHold](../frontend/ios/App/Watch/SessionStore.swift#L495)。

## 4. 组间休息与提醒

- 按动作休息时间或训练默认时间自动开始组间倒数。
- 显示圆环加倒数或纯倒数；可显示下一动作、组和目标。
- 可增加 15 秒，或跳过休息。
- 休息结束前台触觉提醒，后台通知；可关闭敲腕提醒。
- 闲置保护：20 分钟提醒是否结束，45 分钟自动结束，按最后记组时间收尾；
  正在休息或计时组时不触发该空闲结束逻辑。

来源：[RestView](../frontend/ios/App/Watch/OpenGymWatchApp.swift#L980)、
[startRest/checkIdle](../frontend/ios/App/Watch/SessionStore.swift#L687)、
[Idle](../frontend/ios/App/WatchCore/Sources/WatchCore/SessionCore.swift#L414)。

## 5. Apple 系统运动与健康数据

openGym 在自己的 Watch App 内创建 HKWorkoutSession 和 HKLiveWorkoutBuilder。
用户可以留在 openGym 的记组页面，同时运行系统认可的运动会话；这段代码没有另行
打开 Apple 原生 Workout（体能训练）App。

- 默认传统力量训练；支持根据计划映射走路、跑步、骑行/动感单车、椭圆机、爬楼机、
  划船、跳绳、HIIT、混合有氧、瑜伽、柔韧和其他运动类型。
- 这是健康记录类型映射，不代表提供这些项目的完整专业记录器；当前配置 locationType
  固定 indoor，检查到的该路径没有 GPS 轨迹记录。
- 实时心率；每组和休息阶段的平均/最高心率；整场平均/最高心率摘要。
- 读取并显示活动热量（kcal）；这里没有计算活动加静息的总热量。
- 保存训练时结束采集并写入 Apple Health；丢弃时不保存该健康运动记录。
- 手机和手表利用同步 ID 避免重复写同一场健康运动。
- 手机删除训练后，通知手表删除自己写入的健康运动及关联活动热量，带重试与确认。
- 运动会话后台运行及被系统终止后的恢复有实现路径，实际仍受系统和权限影响。
- 跟随 iPhone 的 Apple Health 总开关；健康不可用或权限不足时不能保证上述数据。

来源：[WorkoutManager.make/start](../frontend/ios/App/Watch/WorkoutManager.swift#L99)、
[end/calories](../frontend/ios/App/Watch/WorkoutManager.swift#L292)、
[健康删除同步](../frontend/ios/App/Watch/SessionStore.swift#L543)。

## 6. 结束与训练摘要

- 主动完成、丢弃或返回继续训练；手机结束的训练也会同步到手表收尾。
- 摘要显示训练名、时长、工作组数、训练量；有数据时显示平均/最高心率与活动热量。
- 与手机提供的历史最佳值比较，显示突破纪录的动作。
- PR 规则涵盖更重、同重量更多次数、辅助动作更轻、计时更长；没有历史最佳值不报 PR。
- 热身不计摘要训练量；计时和有氧不按重量乘次数累加训练量。

来源：[SummaryView](../frontend/ios/App/Watch/OpenGymWatchApp.swift#L1080)、
[SessionCore.summary/beatsBest](../frontend/ios/App/WatchCore/Sources/WatchCore/SessionCore.swift#L333)。

## 7. 离线与手机同步

- 手机发送当前训练、预备计划、语言、单位、设置和历史参考值。
- 手机不在旁时，可继续执行已缓存训练并开始已缓存计划。
- 操作在表端持久化，通过带 ID 的事件排队回传；重连后同步、确认、去重。
- 重启恢复本地训练，手表重装后手机重新下发当前状态。
- 动画由手机转换并传给手表；手表本身不从 NAS 下载动画，训练结束清理缓存。
- 有待同步记录且手机不可达时显示稍后同步提示。

来源：[SessionStore 本地保存/传输](../frontend/ios/App/Watch/SessionStore.swift#L143)、
[事件处理与重同步](../frontend/src/lib/watch-sync.js#L355)。

## 8. 手表交互、表盘与设置

- 动作页面滑动；Digital Crown 翻页或在数字编辑器中调值。
- 自动换页后的短暂防误触，按钮触觉反馈；有活动健康会话时可启用系统 Water Lock。
- 常亮降亮状态下，休息/计时组页面隐藏交互按钮。
- 表盘状态组件：显示今天计划、训练组进度、下一组目标或休息倒数，点击进入训练。
- 固定 openGym 启动入口组件；支持圆形、矩形、行内、角落等表盘样式。
- Smart Stack 根据休息/训练/计划状态设置相关性。
- 手机设置控制发送训练、自动打开、动画、心率、上次成绩、时长、热量、下一动作、
  休息样式和敲腕；语言和单位随手机资料。

来源：[LockButton/ExercisePager](../frontend/ios/App/Watch/OpenGymWatchApp.swift#L211)、
[Watch Widgets](../frontend/ios/App/WatchWidgets/OpenGymWidgets.swift#L165)、
[WatchSettings](../frontend/src/views/WatchSettings.jsx#L59)。

## 功能边界

- 计划创建和编辑、完整训练历史与统计、账户/NAS 登录等由手机端承担；手表执行手机
  同步的训练数据，当前手表源码未实现独立登录 NAS 或直接请求服务器。
- 表端“上次成绩”和结束摘要不等于完整历史浏览界面。
- iPhone 桌面小组件、锁屏 Live Activity、灵动岛属于另外的手机扩展目标，不应全部
  算成 Watch App 自身功能；Live Activity 可另有系统跨设备展示。
- 此清单描述已有 Apple Watch 代码。不能据此保证华为 Lite 平台具有相同权限和运行能力。
