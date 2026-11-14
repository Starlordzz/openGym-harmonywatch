# FIT 休息提醒范围（2026-11-14）

用户已取消“休息结束系统通知”。当前保留手表应用内倒计时、到期提示、两轮长震、触摸/表冠停止提醒和前台常亮。手机原有的休息倒计时、提醒与训练功能继续使用。

已移除手机 HUAWEI FIT 的通知开关、测试通知、准时提醒入口、Wear Engine NOTIFY 授权及转发实现；手表删除 `restAlarm` 转发协议。升级与首次启动会清理旧 `opengym-watch-rest` 配置，并取消 request code 7301 的旧 PendingIntent。连接仅申请 DEVICE_MANAGER。

前台休息到期不震动及双端计时差异，当前跟踪在 [B3 / B8](HARMONY_OPEN_BUGS_ZH.md)。实现已补齐共享完成时间、截止时间及到期取整规则，并保留到期 deadline 供手表产生本地提醒；最新真机结果与包位置见 [交接进度](HARMONY_HANDOFF_PROMPT_ZH.md)。

2026-10-31 至 11-13 的通知方案、服务审批和已提交申请材料作为历史记录保留；相关构建记录在 `harmonywatch/artifacts/REST_NOTIFICATIONS_VERIFICATION.json` 等文件中。后续功能以当前用户需求和进度为准。

基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym) 项目开发；本版本为第三方华为 FIT / HarmonyOS 适配，代码沿用 AGPL-3.0-or-later，素材与 SDK 保留独立许可。
