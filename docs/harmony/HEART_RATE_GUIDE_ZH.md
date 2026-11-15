# 华为手表心率：开关、显示与记录位置

更新：2026-11-15。当前版本使用手表传感器采集前台训练心率。用户已确认真实设备一直显示“不可用”，当前正在定位采集失败原因；已有自动回归和注入样本预览。

## 两个开关的区别

| 入口 | 作用 |
|---|---|
| 手机“设置 → HUAWEI WATCH / HUAWEI FIT → 显示心率” | 控制手表训练页、休息页是否显示心率文字；默认开启 |
| 手表空闲页“心率：开 / 关”，或训练页、休息页的心率文字 | 启停应用的训练心率采集；开启后，进入训练并保持应用前台才订阅传感器 |

空闲页开关本身没有 bpm 数值。空闲期间、应用隐藏后不持续采集。

## 手表在哪里看

- 训练页右上角：实时读数，例如“心率：128 bpm”。
- 休息页：下一动作提示下方的心率一行。
- 训练结束汇总：采到有效样本后显示“心率”，数值为保留样本的平均 / 最高心率。

读数位置还可能显示“关”“测量中”“暂无数据”“不可用”。“暂无数据”表示最近 15 秒没有有效的新样本；“不可用”表示订阅失败或已停止运行。用户目前已确认实机失败码 E602。诊断包会进一步显示 `E<原始错误码>`；`EJS` 表示调用出现 JS 异常。完整错误文字保留在应用最后错误中，可长按训练页、休息页的心率文字 2 秒进入 debug 查看；空闲页长按入口保留。

## 动态授权验证包

用户确认安装和开启心率时没有出现过健康授权弹窗。当前验证包接入运行时请求：进入训练页，先关闭心率再开启一次。设备提供 FA Context 授权入口时，会请求 `READ_HEALTH_DATA`；只有成功授权后才订阅心率。

- `EAUTHAPI`：授权入口缺失或异常。
- `EAUTHDENIED`：未获得成功授权结果。
- `EAUTHTIME`：15 秒内没有授权回调。

主页面较长代码可能显示省略号；长按心率文字 2 秒可查看 debug 中的完整“心率授权”代码和文字。FIT 5 Pro 是否支持该动态授权入口仍待实机验证；当前真实采样仍为 `E602: permission not declared`。官方流程见[Lite Wearable 申请授权](https://developer.huawei.com/consumer/cn/doc/lite-wearable-guides/request-permissions/)。

## 手机上在哪里看已保存记录

1. 打开“统计”。
2. 点右上角“历史”图标。
3. 点开一条已完成的训练记录。
4. 查看各动作的完成组；该组有有效心率时，组标签后显示 `♥ 132/151`，分别是平均 / 最高心率，单位 bpm。

当前保存与展示范围：

| 数据 | 保存与展示 |
|---|---|
| 每组训练心率 `set.hr` | 采到有效样本且完成该组后随训练记录同步，手机历史详情显示平均 / 最高 |
| 休息心率 `set.restHr` | 休息结束后回传保存；手机历史详情当前尚未展示此字段 |
| 本次训练平均 / 最高心率 | 手表结束汇总显示；当前华为结束事件未向手机发送训练级心率汇总 |
| 连续原始采样、独立心率列表或曲线 | 当前没有独立存档和查看页面 |
| 华为运动健康中的训练与心率写入 | 当前尚未启用 |

没有有效样本，或只开启开关而未完成训练组时，手机不会出现该组的心率标签。上述记录来自 openGym 自己的传感器与同步链路；手机健康平台的历史读数回填另有入口和实现。

## 2026-11-15 修正与待验证

关闭采集时保留当前训练已采样本，防止停止采集后训练汇总缺少已有心率；结束训练显示汇总后再释放样本。自动测试覆盖开启、有效 bpm、15 秒失效、错误状态和关闭后汇总保留。

用户已反馈“一直不可用”。旧回调未保留错误码，本轮诊断包新增原始失败码及错误文字；用户已安装诊断包并回传 **E602: permission not declared**。签名 BIN 已声明 `READ_HEALTH_DATA`，设备权限识别与运行时授权入口继续排查。最新包为 `/sdcard/haps/openGym-HuaweiWatch-finish-weight-signed.hap`，已推送并核对哈希。

用户回忆的上架要求推测对应 [Health Service Kit 个人开发者资质](https://developer.huawei.com/consumer/cn/doc/HarmonyOS-Guides/health-application-qualifications/)。当前采集使用本地 `@system.sensor`；实际签名包已声明 `READ_HEALTH_DATA`。设备返回 E602 和 `permission not declared`，动态申请验证包已构建，设备授权结果待回传；Health Service Kit 服务接入保持后续计划。

## 源码依据

- 手表[页面状态与传感器启停](../../frontend/harmony/watch/entry/src/main/js/default/pages/index/index.js)、[传感器回调与有效期](../../frontend/harmony/watch/entry/src/main/js/default/common/controller.js)。
- [组与休息心率统计](../../frontend/harmony/watch/entry/src/main/js/default/common/heart.js)、[训练汇总显示](../../frontend/harmony/watch/entry/src/main/js/default/common/view.js)。
- 手机[组心率标签](../../frontend/src/lib/heart-rate.js)、[历史训练详情](../../frontend/src/sheets.jsx)、[同步与补写](../../frontend/src/lib/watch-sync.js)。

基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym)；本版本为第三方华为手表适配。最新状态见[缺陷进度](../HARMONY_OPEN_BUGS_ZH.md)。
