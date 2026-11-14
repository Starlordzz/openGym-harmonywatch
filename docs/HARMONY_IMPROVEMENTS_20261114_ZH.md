# 2026-11-14 改进与验证记录

基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym)；本版本为第三方华为手表 / HarmonyOS 适配，代码沿用 AGPL-3.0-or-later。

## 本轮功能

- 手机端修正 HarmonyOS 5.0+ Lite 对端身份为“包名_Base64(EC 公钥)”，精确迁移旧证书 SHA-256 配置。双向通信和 Full Body 计划保存恢复已由用户确认。
- 双文件持久化替代超出 128 B 的 KV 状态；保存合并、快照串行、动画整组保存与旧帧保留，减少重复写入。
- 手表切换/跳过休息通过 navigate 事件通知手机。用户确认两端动作一致。
- 新增训练接收反馈：手机开始时一次 ping 请求唤起，hello 确认后发送快照；手表新任务落盘后进入训练页并长震一次，重复快照/页面重显保持安静。
- 新增手表休息 −15 秒、+15 秒、暂停/继续，绝对休息状态回传手机；手机优先控制消息保留当前发送队首，session/rev 防止旧快照覆盖新休息。完整快照继续承担恢复。
- 动画 96×96→128×128，页面刷新间隔 125→250 ms；休息日列表 96→240 px，心率开关显示开/关。
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

已获取 `DuarteSantos8/openGym` 的 `main`：`68dad18f8`，相对当前基线 `5fdb229fe` 有 310 个上游提交。合并已完成，冲突 0 处，暂存 1851 个文件。

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
| `openGym-HuaweiWatch-merged-debug.apk` | 240,344,553 B | `e748bf42b9e4020aa968edba1b9c5948fa3e71c817a70a6b8c6b4460d77e84c5` | 构建并核对完成，未安装到手机 |

合并提交 `e515ee44f` 已推送到 `origin/main`。推送前复核暂存内容：无 keystore、调试身份 JSON、私钥、令牌或 `.map`；包内仅含公开的 `huawei_app_id`。`.gitattributes` 随合并提交纳入版本管理。

### 列表与心率说明补充（2026-11-14）

用户反馈两行计划列表难以识别可滚动。已增加“上下滑动选择计划”提示和计划数量；列表高度保留下一项局部露出，指示可继续滚动。实际显示待安装复测。

底部“心率”是训练期间的应用心率采集开关，开关状态显示为“心率：开 / 关”。开启后在训练中订阅手表心率传感器，关闭停止应用采集；当前心率值在训练页顶部显示。空闲页按钮显示开关状态，空闲期间不持续采集。

界面仅保留功能名称、状态与操作提示；取消装饰箭头和装饰性文案。
