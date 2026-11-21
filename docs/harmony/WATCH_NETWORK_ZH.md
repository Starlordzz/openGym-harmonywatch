# 华为轻智能手表经手机联网

更新：2026-11-21。范围：HUAWEI WATCH GT、FIT 等 Lite Wearable 及第三方应用联网路径；当前项目设备为 HUAWEI WATCH FIT 5 Pro。

## 结论

GT / FIT 类轻智能手表可以经手机联网，但开放给第三方应用的是受限 HTTP 请求通道，不是完整 IP 网络。应用调用 `@system.fetch`；论坛 FIT 4 实机测试和 `btproxy` 说明显示，请求经蓝牙交由已配对手机的华为运动健康转发到互联网。正式 Lite Wearable 开发指南没有展开转发实现，但明确以 GT / FIT 等运动表为对象列出 `fetch` 请求失败条件，说明这条路径存在，同时给出地区、配对手机和报文大小的硬限制。

不能把该能力表述为“手表已支持独立联网”或“手表可直接访问任意网络”：

| 路径 | 对 GT / FIT 的结论 | 依据 |
|---|---|---|
| `@system.fetch` 经蓝牙代理 | 存在；受地区、手机平台及报文大小限制 | 官方 Lite 开发指南；论坛 FIT 4 实测 |
| `@ohos.net.http`、Socket 等通用网络接口 | 未找到 Lite Wearable 可用证据；社区实测导入后对象为 `undefined` | 通用 API 设备标签未列 Lite Wearable；论坛问题记录 |
| WLAN / eSIM 独立联网 | 代表性 FIT / GT 规格页未列 WLAN、eSIM，未找到第三方应用使用证据 | FIT 4、FIT 5 Pro、GT 4、GT 5 官方规格 |
| Wear Engine 手机↔手表 P2P | 当前项目已使用并有既有实机验证 | 仓库源码与既有实机记录；本身不提供互联网出口 |

## 官方限制

华为 Lite Wearable 开发指南的“轻量级智能穿戴网络请求大小限制问题”原文列出三类失败原因：

1. WATCH GT5 及更早运动表版本与 iOS 手机配对，无法发起 `fetch` 请求。
2. 欧洲地区运动表均无法发起 `fetch` 请求。
3. `fetch` 请求携带数据过大，例如请求头超过 2 KB，或传输层单包数据超过 7 KB。

前两项是地域和手机平台限制，第三项是报文边界。官方只给出请求头与传输层单包的阈值，不能据此推导请求体或响应体的总上限。项目当前只支持 Android，因此第 1 项不构成目标场景限制；第 2 项会影响欧洲地区使用；第 3 项要求接口设计保持小请求、短响应。

正式指南没有把 `fetch` 描述成“蓝牙代理上网”，但论坛支持材料称该机制为 `btproxy`，并给出 FIT 4 的实机测试：

- 设备 FIT 4（SYA-B19），HarmonyOS 5.1.0，Huawei Health 15.1.6.310，Android，手机连接 Wi-Fi，手表与手机蓝牙连接。
- 论坛支持人员称相同配置下普通请求可用；断开蓝牙后返回 `-6`，解释为连接超时。
- 支持答复要求华为运动健康应用在后台运行且不被 Android 电池优化限制。

该记录属于论坛支持答复，不是正式 API 文档；但设备、版本、成功条件和失败码具体，且与 `btproxy` 指南、正式指南的限制条目相互吻合。`btproxy` 指南另称单请求不超过 6 KB，与正式指南的“请求头 2 KB / 传输层单包 7 KB”口径不同，本文以正式指南为准。

## 联网链路

```text
手表应用 @system.fetch
        │
        │ 蓝牙
        ▼
已配对 Android 手机（实测经华为运动健康）
        │
        │ 手机 Wi-Fi / 移动数据
        ▼
远端 HTTPS 服务
```

该链路依赖手机、蓝牙和华为运动健康。它不等同于手表自行完成 DNS、TCP/TLS 与 HTTP；应用只能使用系统提供的 `fetch` 形态，不能据此认为 Socket、WebSocket 或任意后台网络任务可用。

## 型号与证据边界

| 对象 | 独立 WLAN / eSIM | `fetch` 经手机 | 说明 |
|---|---|---|---|
| HUAWEI WATCH FIT 5 Pro | 规格页未列 | 未找到该型号单独说明，项目尚未真机验证 | 当前目标设备；官方规格只列 NFC、蓝牙 6.0、GNSS |
| HUAWEI WATCH FIT 4 | 规格页未列 | 论坛支持称 Android + 蓝牙实测可用 | 型号 SYA-B19，HarmonyOS 5.1.0 |
| HUAWEI WATCH GT 5 | 规格页未列 | 正式限制条目覆盖 GT5 及更早型号 | 仅明确 iOS 配对和欧洲地区限制 |
| HUAWEI WATCH GT 4 | 规格页未列 | 社区用户报告曾可用、后续失败 | 只能作线索，未作为能力依据 |
| HUAWEI WATCH 3/4/5/6、Ultimate 等 | 支持蓝牙借用手机网络，部分支持 WLAN / eSIM | 不适用本结论 | 华为官方“手表连接网络”页的适用产品不包含 FIT / GT |

FIT 5 Pro 与 FIT 4 同属 Lite Wearable，但型号、HarmonyOS 版本和华为运动健康版本均不同。正式指南按“运动表”概括，未逐一列出 FIT 5 Pro；在真机验证完成前，只能记为“同运行时存在可用路径，目标型号待验证”。

## 对当前项目的影响

当前手表端没有使用 `@system.fetch`，也没有声明 `ohos.permission.INTERNET`；`config.json` 仅申请振动权限。训练计划、训练状态和心率事件均通过 Wear Engine P2P 与 Android 应用交换，离线训练不依赖互联网。该设计继续成立。

可选的两种实现方式：

| 方案 | 优点 | 代价与风险 |
|---|---|---|
| 手表直接 `@system.fetch` | 请求路径短；无需自定义转发协议 | 受欧洲地区、iOS 配对、报文大小和华为运动健康后台状态限制；FIT 5 Pro 待实测 |
| 手表经 Wear Engine 交给 Android 应用转发 | 复用现有通道；网络策略和凭据集中在手机端；不受 `fetch` 的欧洲限制 | 需要新增请求/响应消息类型、超时、重试和并发控制；依赖手机应用在运行 |

训练同步仍应使用现有 Wear Engine 通道。只有在天气、远端计划、账号类短请求等明确需要互联网的功能上，才值得增加 `fetch` 适配器；不要为了“能联网”替换已经验证的同步链路。若请求涉及鉴权，不要把长期密钥固化在 HAP 中，使用短期、最小权限令牌并校验服务端响应。

## FIT 5 Pro 验证项

1. 在手表 HAP 中声明网络权限并调用 `@system.fetch`，请求自建的小型 HTTPS 端点；记录 API、HarmonyOS、华为运动健康和 Android 版本。
2. 保持蓝牙与华为运动健康后台连接，分别测试手机 Wi-Fi、移动数据；再关闭蓝牙、停止华为运动健康，应能复现失败并记录错误码。
3. 构造接近 2 KB 的请求头和接近 7 KB 的传输单包，确认边界及失败表现；不要把结果外推为响应体上限。
4. 在中国大陆与欧洲地区分别验证；正式指南明确欧洲地区运动表不可发起 `fetch`。
5. Android 端确认华为运动健康未被电池优化或后台限制，并验证应用退到后台后的请求稳定性。
6. 若请求由 openGym 自己发起，比较现有 Wear Engine 转发方案的成功率、延迟和功耗，再决定是否保留 `fetch` 路径。

验证通过前，项目文档与界面不应显示“支持手表直接联网”。验证失败时保留现有离线与手机转发设计，不增加降级占位逻辑。

## 来源

检索日期：2026-11-21。

| 编号 | 来源 | 用途 |
|---|---|---|
| L1 | [轻量级智能穿戴应用开发](https://developer.huawei.com/consumer/cn/doc/lite-wearable-guides/lite-wearable-bpta-guide#section629020275119)，更新 2026-08-20 | 支持 GT / Fit 等；`fetch` 的地区、iOS、2 KB / 7 KB 限制 |
| L2 | [@system.fetch（数据请求）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-system-fetch) | `fetch` 参数与设备标签；当前页面未列 Lite Wearable，文档存在分层缺口 |
| L3 | [华为智能手表连接网络](https://consumer.huawei.com/cn/support/content/zh-cn15818703/) | 全智能 WATCH 系列的蓝牙借网、WLAN、eSIM 行为；适用产品不含 FIT / GT |
| L4 | [HUAWEI WATCH FIT 5 Pro 规格参数](https://consumer.huawei.com/cn/wearables/watch-fit5-pro/specs/) | 数据连接仅列 NFC、蓝牙、GNSS |
| L5 | [HUAWEI WATCH FIT 4 规格参数](https://consumer.huawei.com/cn/wearables/watch-fit4/specs/) | 数据连接仅列 NFC、蓝牙、GNSS |
| L6 | [HUAWEI WATCH GT 5 规格参数](https://consumer.huawei.com/hk/wearables/watch-gt5/specs/) | 连接仅列蓝牙、GNSS |
| L7 | [HUAWEI WATCH GT 4 规格参数](https://consumer.huawei.com/de/wearables/watch-gt4/specs/) | 连接仅列 NFC、蓝牙 |
| F1 | [Http request to fetch data on Lite wearables](https://forums.developer.huawei.com/forumPortal/en/topic/0201190810572199108) | FIT 4 经蓝牙联网的论坛支持测试、权限答复、错误码 `-6` |
| F2 | [Sports Watch btproxy Capability Development Guide](https://forums.developer.huawei.com/forumPortal/en/topic/0205201442076523096) | 论坛 `btproxy` 说明；非正式文档，单请求 6 KB 口径未被采用 |
| P1 | `harmonywatch/entry/src/main/config.json` | 当前仅申请振动权限 |
| P2 | `harmonywatch/entry/src/main/js/MainAbility/common/runtime.js` | 当前通过 Wear Engine P2P 通信 |

基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym)；本版本为第三方华为手表 / HarmonyOS 适配。
