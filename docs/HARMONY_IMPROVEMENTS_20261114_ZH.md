# 2026-11-14 改进与验证记录

基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym)；本版本为第三方华为手表 / HarmonyOS 适配，代码沿用 AGPL-3.0-or-later。

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
- `frontend/src/lib/harmony-page.test.js` 的 mock 补齐 `keepScreenOn` 并在 `onInit` 后调用 `onShow`；`44e01244e` 已将粗调步进改为固定 ±1（细调 `editFineBy(0.1)`），用例期望由 22 更正为 21。
- 华为设置页 CSS 类由 `.hw-*` 改为 `.watch-*`，避免与 Halloween 主题的 `.hw-*` 前缀冲突。
- `app-icons.mjs --check` 对文本产物按换行归一比较，PNG 仍逐字节比较；慢盘测试使用 30 s 超时与 6 个 vitest worker。

合并后验证：服务端 804 项、手机界面 7862 项（655 个文件）、手表 130 项全部通过；`build-nudge-copy`、`build-wrapped-copy`、`build-coach-assets` 的 `--check` 均一致。

手机 APK 使用 `HARMONY_ANDROID_ASSET_CACHE` 将 244 MB/13,281 个 Web 资源暂存到 WSL 缓存后构建，Gradle 34 分 5 秒、209 个任务，`BUILD SUCCESSFUL`。核对结果：包名 `host.msknet.opengym.phone`、versionCode 31、versionName 1.4.4、minSdk 24、targetSdk 36；23 项权限；v2 签名，调试证书 SHA-256 `f67feedf…eb48e1ae`；14048 个 zip 条目、12 个 dex，包含 HuaweiWatchPlugin 与 Wear Engine 类；包内无 keystore、身份 JSON、`.map` 或私钥标记。证据见 `harmonywatch/artifacts/BUILD_20261114_INTEGRATED.json` 与同名 `.log`。

| 产物 | 大小 | SHA-256 | 状态 |
|---|---|---|---|
| `openGym-HuaweiWatch-merged-debug.apk` | 240,344,553 B | `e748bf42b9e4020aa968edba1b9c5948fa3e71c817a70a6b8c6b4460d77e84c5` | 已 ADB 覆盖安装（versionCode 31）；桥接 paired/installed/receiverRegistered 均为 true |
| `openGymFIT-merged-signed.hap` | 685,185 B | `972ce55f2aa2d062f6a67e1b1627d5d0a21063f59da781cfa607c482d859b6fb` | 已签名验签并推送 `/sdcard/haps/`，待手表覆盖安装 |

合并提交 `e515ee44f` 已推送到 `origin/main`。推送前复核暂存内容：无 keystore、调试身份 JSON、私钥、令牌或 `.map`；包内仅含公开的 `huawei_app_id`。`.gitattributes` 随合并提交纳入版本管理。

### 列表与心率说明补充（2026-11-14）

用户反馈两行计划列表难以识别可滚动。已增加“上下滑动选择计划”提示和计划数量；列表高度保留下一项局部露出，指示可继续滚动。实际显示待安装复测。

底部“心率”是训练期间的应用心率采集开关，开关状态显示为“心率：开 / 关”。开启后在训练中订阅手表心率传感器，关闭停止应用采集；当前心率值在训练页顶部显示。空闲页按钮显示开关状态，空闲期间不持续采集。

界面仅保留功能名称、状态与操作提示；取消装饰箭头和装饰性文案。
