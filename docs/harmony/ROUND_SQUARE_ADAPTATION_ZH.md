# 圆表与方表适配：开发流程

更新：2026-11-21。适用于 `harmonywatch/` 的 Lite Wearable（FA 模型、JS/ACELite）手表端。

## 结论

一个应用、两个 Entry HAP：方表 HAP 声明 `distroFilter.screenShape = ["rect"]`，圆表 HAP 声明 `["circle"]`，两者共用同一套页面模板，仅在暂存阶段替换 CSS 和页面常量；应用市场按屏幕形态向设备分发对应 HAP。

不在运行时判断形态、不维护两套页面 JS。Lite 页面包上限 48 KB，当前页面包已接近上限，增加运行时布局分支会直接超过设备限制。

依据：

- [轻量级智能穿戴应用开发 · 方表适配](https://developer.huawei.com/consumer/cn/doc/lite-wearable-guides/lite-wearable-bpta-guide)：新增 Entry，`deviceType` 保持 `liteWearable`，添加 `distroFilter.screenShape`，应用市场按 `distroFilter` 分发。
- [@system.device](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/js-apis-system-device)：`screenShape` 取值 `rect` / `circle`，Lite Wearable 12+；本方案不依赖该接口，仅作为后续排查信息。
- [影响应用兼容性的关键信息](https://developer.huawei.com/consumer/cn/doc/harmonyos-faqs/faqs-project-management-37)：`compatibleSdkVersion ≤ targetSdkVersion ≤ compileSdkVersion`；降低 `compatibleSdkVersion` 是让新构建安装到旧系统设备的正式做法。

## 形态与版本矩阵

| 项 | 方表（entry） | 圆表（round） |
|---|---|---|
| 设计画布 | 408×480 | 466×466 |
| `designWidth` | 408 | 466 |
| `autoDesignWidth` | false | false |
| `distroFilter.screenShape` | `rect` | `circle` |
| 主体安全区 | 368 px 垂直列 | 310 px 赤道核心列（顶底收窄至 260 px） |
| 最大内接正方形 | 408×480（全屏可用） | 329×329 px（中心 233, 233，半径 233 px） |
| 覆盖机型 | HUAWEI WATCH FIT 3 / FIT 5 Pro | HUAWEI WATCH GT 5 / GT 4 / GT 3 / WATCH 4 / WATCH 3 / Ultimate |
| 兼容机型 | — | GT 2 46mm（454×454，依 466 缩放 97.4%） |
| 运行时 | HarmonyOS Lite Wearable，API 12 | 同左 |

`screenWindow` 不写入 `distroFilter`：只按形态匹配，让同形态的不同分辨率共用同一 HAP；尺寸差异由 `designWidth` 等比缩放承担。若某型号出现溢出，再补 `screenWindow` 精确匹配，并单独验证。

## 圆表几何安全区与 UI 协调规范

1. **圆表几何约束**：
   - 466×466 屏幕中心为 (233, 233)，半径 $R = 233$ px。
   - 任意高度 $y$ 处的物理可见弦长为 $W(y) = 2 \times \sqrt{233^2 - (y - 233)^2}$。
   - $y \le 30$ 或 $y \ge 436$ 时可用宽度降至 228 px 以下，矩形直角元素在顶部或底部会发生严重截断。
2. **布局避让与内缩规则**：
   - **顶部避让**：页面顶部内边距设为 24~28 px，训练页标题与操作区限宽 240 px（标签 260 px）并居中对齐，杜绝表圈削角。
   - **底部避让**：页面底部内边距设为 24~28 px，底部跳过按钮限宽 210 px，双操作按钮（Save/Discard）容器限宽 268 px，进度点限宽 180 px。
   - **列表数值防切**：结算列表项数值向内留出 12 px 左右内边距，防止数字末尾触碰圆弧边框。
3. **视觉圆角与同心协调**：
   - 所有按钮、快调胶囊与触控卡片采用大圆角胶囊造型（`border-radius: 20px ~ 26px`），消除方表情境下的硬直角，与物理圆盘同心呼应。

## API 等级

- 目标机型 GT 5 / FIT 4 一代的 Lite Wearable 运行在 API 12。
- 工程仍用本机 SDK 26 编译；`compatibleSdkVersion` 设为 `5.0.0(12)`，`targetSdkVersion` 保持 `26.0.0`。
- 已验证：生成的 Lite `config.json` 内 `app.apiVersion.compatible = 50000012`，`compileSdkVersion = 26.0.0.105`。
- 页面只使用 `@system.storage`、`@system.file`、`@system.vibrator`、`@system.brightness`、`@system.wearengine` 等旧接口，没有 API 12 之后才引入的调用；新增接口必须查“起始版本”，高于 12 的要用能力判断并降级。

## 目录与产物

| 路径 | 作用 |
|---|---|
| `frontend/harmony/watch/entry/src/main/js/default/` | 唯一页面模板（HML/JS/CSS），方表基线 |
| `.../pages/index/round.css` | 圆表覆盖样式，只在暂存圆表模块时追加 |
| `harmonywatch/entry/` | 方表 Entry 模块，产物 `entry-default-unsigned.hap` |
| `harmonywatch/round/` | 圆表 Entry 模块，产物 `round-default-unsigned.hap` |
| `harmonywatch/build-profile.example.json5` | 两个模块的产品与构建配置 |
| `harmonywatch/phone-debug-identity.json` | 本机手机包名与证书 SHA-256，Git 忽略 |
| `harmonywatch/watch-debug-identity.json` | 本机手表包名与叶证书 SHA-256，Git 忽略（示例见 `watch-debug-identity.example.json`） |
| `scripts/harmony/prepare.mjs` | 模板暂存、形态差异、权限与 peer 身份写入 |
| `scripts/harmony/build-local.ps1` | 两模块构建、48 KB 检查、BIN/HAP 封装 |

## 开发流程

### P0 环境与身份

1. Windows DevEco Studio（本机 `E:\Program Files\Huawei\DevEco Studio`，SDK 26），WSL 通过 `powershell.exe` 调用。
2. 仓库外准备手表 Profile、证书链、私钥与 `key-info.json`；仓库内 Git 忽略的 `harmonywatch/phone-debug-identity.json` 填手机包名和证书 SHA-256。
3. 验收：`node scripts/harmony/prepare.mjs --help` 以外的空参数调用打印用法；`prepare.mjs` 在 `--sdk` 模式下缺少身份时明确报错。

### P1 模板改造

1. 只改 `frontend/harmony/watch/entry/src/main/js/default/` 下的模板；不改 `harmonywatch/*/src/main/js/` 的暂存产物。
2. 方表样式保持现状；圆表差异写入 `round.css`，只覆盖尺寸、内边距和圆内安全列，颜色与字号层级继承基线。
3. 页面内无法用 CSS 覆盖的常量（首页计划列表高度及数字框拟合尺寸 `FIT`）按形态在暂存阶段替换字符串；新增此类常量前先评估能否改成 CSS。
4. 禁止新增正则字面量、`class` 数据绑定、无高度容器；这些在 Lite 引擎中会静默失败。
5. 验收：`cd frontend/harmony && npm test` 全通过（模板条件、布局回归、通信与存储用例）。

### P2 模块与配置

1. `harmonywatch/entry/src/main/config.json`：`distroFilter.screenShape = ["rect"]`。
2. `harmonywatch/round/src/main/config.json`：同 `bundleName`，`distro.moduleName = "round"`，`screenShape = ["circle"]`，`designWidth = 466`。
3. `harmonywatch/build-profile.example.json5` 的 `modules` 同时包含 `entry` 与 `round`，两者都挂到 `default` 产品。
4. 验收：`prepare.mjs` 后两个模块的 `config.json` 仅按表内差异变化，权限均为 `VIBRATE` 且含 `reason` 与 `usedScene.when`。

### P3 暂存

```sh
node scripts/harmony/prepare.mjs \
  --project harmonywatch --round-project harmonywatch/round \
  --bundle host.msknet.opengym.fit
```

- 不带 `--offline`：使用模板内官方 Wear Engine SDK，写入 `supportLists` 与 `common/peer.js`，产物可用于真机通信。
- 带 `--offline`：仅用于无身份/无 SDK 的界面构建，无线电显式禁用。
- 验收：输出两行 `Staged ... (entry, rect)` 与 `(round, circle)`；`diff -r` 两模块页面树应只差 `index.css`、`index.hml`、`index.js`（仅 `FIT` 常量行）和 `config.json`。

### P4 构建

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File scripts\harmony\build-local.ps1 `
  -DevEcoRoot 'E:\Program Files\Huawei\DevEco Studio' `
  -ProjectPath <Windows 本地工程副本>\harmonywatch -Module all
```

流程：`hvigor assembleHap`（release）→ 逐模块 Terser ES5 优化 → 48 KB 检查 → 模块内 `haptobin_tool` 转 BIN → `app_packing_tool` 封装 HAP。

验收：

- `app.js`、`pages/index/index.js` 均 ≤ 49,152 B。
- `entry-default-unsigned.hap`、`round-default-unsigned.hap` 均存在。
- `python3 scripts/harmony/verify-hap.py <hap>` 通过。
- 解包/解析 Lite BIN 的 `config.json`：`compatible = 50000012`，两模块 `distroFilter` 分别为 `rect`/`circle`，`designWidth` 分别为 408/466。

### P5 签名

使用 `scripts/harmony/sign-local.sh`：校验 Profile → 签 BIN → 封装 HAP → 验签与容器校验。未签名的 HAP 不能安装到真机；签名材料缺失时只交付未签名构建并明确标注。

### P6 双形态验证

1. 方表：FIT 5 Pro 走既有流程，确认计划下发、训练、休息、退出、心率显示与离线同步无回归。
2. 圆表：至少一台 466×466 圆表；先看模拟器/预览器截图，再真机确认以下位置不被圆边裁切：首页计划按钮与列表、训练页标题/标签/主按钮/分页点、休息页圆环与两行按钮、结束/总结页底部按钮。
3. 记录设备型号、系统版本、API、屏幕分辨率、HAP 提交与结果到 [兼容性记录](COMPATIBILITY_ZH.md)。
4. 未完成真机验证前，文档只写“待验”，不写“已适配”。

### P7 分发

1. 应用市场按 `deviceType` + `distroFilter.screenShape` 选择 HAP；不得把两个 HAP 合并成一个无 `distroFilter` 的包，否则圆屏会拿到方表布局。
2. 发布前核对：两 HAP 的 `bundleName` 一致、`moduleName` 不同、版本号一致、签名一致。
3. 商店支持“一个应用多个 Entry HAP”的前提是工程按多模块构建；不要用改包名的方式拆成两个应用。

## 风险与边界

| 风险 | 处理 |
|---|---|
| 圆边裁切 | 所有宽度收窄到圆内安全列（顶底 240~260 px、赤道 310~316 px，分页点 180 px）；真机/预览确认 |
| 页面包超 48 KB | 形态差异只进 CSS/HML 暂存；新增文案优先删语言包，不加运行时分支 |
| 旧设备 API 缺能力 | 只用 API 12 及以下接口；新增接口按 `sdkApiVersion`/`canIUse` 判断 |
| 手机身份变化 | `supportLists` 绑定手机包名+证书 SHA-256；换签名后重新暂存并重装手表 HAP |
| 多分辨率圆表 | 先按形态匹配，等比缩放；出现溢出再按 `screenWindow` 拆分 |
| 未签名包 | 仅用于构建验证；真机安装必须走 Profile 签名 |

## 维护规则

- 模板只有一份，形态差异集中在 `round.css` 与 `prepare.mjs` 的形态分支。
- 新增屏幕形态或分辨率时，先加配置与验收项，再改布局；不在页面 JS 中堆条件。
- 每次改动后重跑：模板测试 → 双模块构建 → 48 KB 检查 → BIN 配置解析 → 真机回归。
