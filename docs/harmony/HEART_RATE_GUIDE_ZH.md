# 华为心率功能状态与开发者平台权限

更新：2026-11-15。华为端心率功能已按用户要求移除。当前手机 HUAWEI WATCH 设置没有“显示心率”，手表没有心率开关、实时读数或汇总心率行；生产运行时没有原生心率采集及 FA 动态授权调用。训练、休息提醒、常亮、重量调整和既有历史记录保留。

## 华为开发者平台的申请条件

| 能力 | 官方平台要求 | 本项目状态 |
|---|---|---|
| Health Service Kit 运动健康数据 | 个人开发者应用须上架华为应用市场；未上架应用暂不开放数据。申请访问的数据还须经过资质和数据权限审核 | 当前个人自用侧载路线，未接入 |
| Health Service Kit 实时心脏数据 | 经华为运动健康转发，需申请实时心脏数据读权限 `HEALTHKIT_EXTEND_REALTIME_HEART_READ` | 未接入 |
| Wear Engine 人体传感器 `SENSOR` | 读取 ECG、PPG、HR 的能力受限开放，仅限专业研究机构。个人开发者可申请设备基础信息、消息通知 | 未申请 SENSOR；现有计划和训练通信使用 DEVICE_MANAGER 下的 P2P 消息 |
| 手表本地 `@system.sensor.subscribeHeartRate` | Lite API 列出 `ohos.permission.READ_HEALTH_DATA`；FIT 5 Pro 当前固件是否另需平台 ACL／专门开通，公开资料尚未核实 | 旧包已声明权限，实机仍返回 `602: permission not declared`；当前已移除 |

官方来源（核查日期 2026-11-15）：

- [Health Service Kit 开发者申请资质](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V14/health-application-qualifications-V14/)，个人开发者接入资质审核要求。
- [Android Health Service Kit 申请 FAQ](https://developer.huawei.com/consumer/cn/doc/hmscore-guides/apply-kitservice-0000001050707556/)。
- [获取实时心脏数据](https://developer.huawei.com/consumer/cn/doc/hmscore-guides/extended-obtaining-real-time-heart-data-0000001050163997/)，实时数据流程与权限。
- [申请 Wear Engine 服务](https://developer.huawei.com/consumer/cn/doc/connectivity-guides/applying-wearengine-0000001050777982/)，个人开发者范围与 SENSOR 限制。
- [Lite Wearable 传感器 API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references-V3/lite-wearable-system-sensor-0000001222566847-V3/)，权限列表与心率订阅。

用户记得的“只有上架才能申请”条件对应 Health Service Kit。旧实现实际使用手表本地传感器；E602 的设备权限识别原因仍未查明。历史 V2 权限表曾将 READ_HEALTH_DATA 标记为需 ACL，当前通用权限表列为 normal / user_grant；当前 FIT 固件与这些版本文档的对应关系待核实。来源：[历史 V2 表](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V2/permission-list-0000001544464017-V2/)、[当前权限表](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/permissions-for-all-user/)。

## 当前交付

- 手机 APK：`harmonywatch/artifacts/openGym-HuaweiWatch-no-heart-debug.apk`，已通过 ADB 覆盖安装，保留原应用数据。
- 手表 HAP：`/sdcard/haps/openGym-HuaweiWatch-no-heart-signed.hap`，已推送手机；需用应用调测助手覆盖安装手表，实机验收待反馈。
- 手表调试标记：HA6。实际签名 BIN 不含原生传感器模块、FA 权限模块、权限请求函数或 READ_HEALTH_DATA 声明；仅保留 VIBRATE 权限。
- 回归：手表 146 项、手机相关 27 项通过；Android 构建、原生启动、通信、签名校验和训练／休息／结束页原生预览通过。

## 故障与恢复记录

旧本地采集返回 `E602: permission not declared`。HA2 返回 FA 接口不可用；HA3 补充导出结构诊断；HA4 尝试直接 Context 权限函数后，用户确认关闭再开启心率会卡死。HA4 已撤回，安装文件隔离为 `HA4-WITHDRAWN.hap.disabled`。HA5 删除原生入口后，用户确认“已恢复正常操作”。

用户随后要求没有可用权限就取消心率，并明确询问华为开发者平台。当前已完成平台条件核查和功能移除，B19 以功能取消关闭；HA4 的原生调用约定仍未查明。当前开发继续处理训练稳定性、同步和布局。

## 已有数据

旧训练记录中的 `set.hr`、`set.restHr` 和未确认的同步事件保留；共享历史详情仍兼容已有组心率标签。当前华为版本不新增心率采样，也没有独立心率曲线。恢复旧存档时移除 `sensorEnabled`；华为快照固定 `show.hr=false`，其他平台共享设置保持兼容。

源码：[手机设置](../../frontend/src/views/HuaweiWatchSettings.jsx)、[华为快照](../../frontend/src/lib/watch-sync.js)、[手表页面](../../frontend/harmony/watch/entry/src/main/js/default/pages/index/index.js)、[原生运行时](../../frontend/harmony/watch/entry/src/main/js/default/common/runtime.js)、[构建门禁](../../scripts/harmony/check-lite-heart.mjs)。

基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym)；本版本为第三方华为手表适配。进度见[缺陷清单](../HARMONY_OPEN_BUGS_ZH.md)。
